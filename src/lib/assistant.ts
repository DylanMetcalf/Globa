import type { Itinerary, Place, SavedPlace } from '../../shared/types';
import { emptyCriteria, findArea, hasStructure, interpretQuery, nameSearch, norm, rankPlaces, buildAreas, explainMatch } from './discovery';
import { REASON_LABELS, STAY_LABELS, MONTHS } from './labels';

export interface AssistantContext {
  places: Place[];
  current?: Place;
  saved: SavedPlace[];
  itineraries: Itinerary[];
  toUSD?: Record<string, number>;
}

export interface AssistantReply {
  text: string;
  placeIds: string[];
  followUps: string[];
  caveats: string[];
  links?: { label: string; to: string }[];
}

const byName = (places: Place[], text: string): Place[] => {
  const areas = buildAreas(places).filter((a) => a.kind === 'place');
  const t = norm(text);
  const found: Place[] = [];
  for (const a of areas.sort((x, y) => y.norm.length - x.norm.length)) {
    if (` ${t} `.includes(` ${a.norm} `)) { const p = places.find((q) => q.kind === 'destination' && norm(q.name.replace(/\(.*?\)/g, '')) === a.norm); if (p && !found.includes(p)) found.push(p); }
  }
  return found;
};

const stars = (n: number) => `${n}/5`;

export function compareText(a: Place, b: Place): string {
  const rows: [string, string, string][] = [
    ['Internet (curated)', stars(a.scores.internet), stars(b.scores.internet)],
    ['Monthly cost for two (estimate)', a.monthlyCostUSD ? `$${a.monthlyCostUSD[0].toLocaleString()}–$${a.monthlyCostUSD[1].toLocaleString()}` : 'n/a', b.monthlyCostUSD ? `$${b.monthlyCostUSD[0].toLocaleString()}–$${b.monthlyCostUSD[1].toLocaleString()}` : 'n/a'],
    ['Crowds (5 = busiest)', stars(a.scores.crowds), stars(b.scores.crowds)],
    ['Walkability', stars(a.scores.walkability), stars(b.scores.walkability)],
    ['Coworking', a.practical.includes('coworking') ? 'likely' : 'limited', b.practical.includes('coworking') ? 'likely' : 'limited'],
    ['Good months', a.bestMonths.map((m) => MONTHS[m - 1]).join(', ') || 'n/a', b.bestMonths.map((m) => MONTHS[m - 1]).join(', ') || 'n/a'],
    ['Ideal stay', a.idealStay.map((s) => STAY_LABELS[s]).join(' / '), b.idealStay.map((s) => STAY_LABELS[s]).join(' / ')],
  ];
  return rows.map(([k, x, y]) => `• **${k}:** ${a.name} ${x} — ${b.name} ${y}`).join('\n');
}

/** Deterministic, offline assistant. It only restates catalogue data and your own saved items. */
export function demoReply(text: string, ctx: AssistantContext): AssistantReply {
  const t = norm(text);
  const caveats = ['Based on GLOBA’s curated sample data and your own entries — not live-verified.'];
  const places = ctx.places;
  const savedPlaces = ctx.saved.map((s) => places.find((p) => p.id === s.placeId)).filter(Boolean) as Place[];
  const named = byName(places, text);

  // compare
  if (/\bcompare\b|\bversus\b|\bvs\b/.test(t)) {
    let pair = named.slice(0, 2);
    if (pair.length < 2 && ctx.current) pair = [ctx.current, ...savedPlaces.filter((p) => p.id !== ctx.current!.id && p.kind === 'destination')].slice(0, 2);
    if (pair.length < 2) pair = savedPlaces.filter((p) => p.kind === 'destination').slice(0, 2);
    if (pair.length < 2) return { text: 'Tell me which two places to compare (for example “compare Lisbon and Chiang Mai for remote work”), or save a couple of destinations first.', placeIds: [], followUps: ['Compare Lisbon and Chiang Mai for remote work'], caveats: [] };
    const remote = /remote|work|wifi|internet/.test(t);
    const [a, b] = pair;
    const winner = remote ? (a.scores.internet >= b.scores.internet ? a : b) : undefined;
    return {
      text: `Here is **${a.name}** versus **${b.name}**${remote ? ' with remote work in mind' : ''}:\n${compareText(a, b)}${winner ? `\n\nOn the curated internet score alone, **${winner.name}** edges it — but test real speeds with the host before committing.` : ''}`,
      placeIds: [a.id, b.id], followUps: [`What are the downsides of ${a.name}?`, `Build a three-day itinerary for ${b.name}`], caveats,
    };
  }

  // places like this one
  if (/\b(like this|similar|more like|alternatives? to)\b/.test(t) && (ctx.current || named[0])) {
    const base = named[0] ?? ctx.current!;
    const c = emptyCriteria();
    c.env = base.env.slice(0, 2); c.lifestyle = base.lifestyle.slice(0, 2); c.kind = base.kind;
    const ms = rankPlaces(places.filter((p) => p.id !== base.id && p.kind === base.kind), c).slice(0, 5);
    if (!ms.length) return { text: `I couldn’t find anything in the catalogue that resembles ${base.name}.`, placeIds: [], followUps: [], caveats };
    return {
      text: `Five places that share ${base.name}’s character (${[...base.env.slice(0, 2), ...base.lifestyle.slice(0, 2)].join(', ')}):\n${ms.map((m, i) => `${i + 1}. **${m.place.name}** (${m.place.country}) — ${explainMatch(m)}`).join('\n')}`,
      placeIds: ms.map((m) => m.place.id), followUps: [`Compare ${base.name} and ${ms[0].place.name}`], caveats,
    };
  }

  // best of saved
  if (/\bsaved\b|\bour places\b/.test(t) && /\b(stay|months?|live|living|best|which)\b/.test(t)) {
    const dest = savedPlaces.filter((p) => p.kind === 'destination');
    if (!dest.length) return { text: 'You haven’t saved any destinations yet. Save a few from the globe or Discover and I can rank them for a long stay.', placeIds: [], followUps: [], caveats: [], links: [{ label: 'Discover places', to: '/discover' }] };
    const c = interpretQuery(text);
    if (!c.stay) c.stay = 'three-months';
    const ms = rankPlaces(dest, { ...c, kind: 'destination' }, { toUSD: ctx.toUSD });
    const ordered = ms.length ? ms : dest.map((p) => ({ place: p, score: 0, reasons: ['No strong signal for those criteria'], gaps: [] }));
    return {
      text: `Ranking your saved destinations for a ${STAY_LABELS[c.stay].toLowerCase()} stay:\n${ordered.slice(0, 5).map((m, i) => `${i + 1}. **${m.place.name}** — ${explainMatch(m as never)}`).join('\n')}`,
      placeIds: ordered.slice(0, 5).map((m) => m.place.id), followUps: ['Compare the top two for remote work'], caveats,
    };
  }

  // itinerary
  if (/\b(itinerary|plan|schedule)\b/.test(t)) {
    const days = t.match(/\b(\d+|one|two|three|four|five|six|seven)\s*day/);
    return {
      text: `I can draft that in the itinerary builder, using ${savedPlaces.length ? `your ${savedPlaces.length} saved place${savedPlaces.length === 1 ? '' : 's'}` : 'places you choose'} and your pace and budget.${days ? ` You asked for ${days[0]}s — set that duration in step 4.` : ''} Times are suggestions and nothing is booked.`,
      placeIds: savedPlaces.slice(0, 5).map((p) => p.id), followUps: [], caveats, links: [{ label: 'Start the itinerary builder', to: '/itineraries/new' }],
    };
  }

  // food / places to eat
  if (/\b(restaurants?|food|eat|coffee|cafe|takeaway|dinner|lunch|brunch)\b/.test(t)) {
    const p = ctx.current ?? named[0];
    return {
      text: `${p ? `Open ${p.name}’s brief and use **Suggest More** to pull real restaurants and cafés from OpenStreetMap near it.` : 'Open a destination and use **Suggest More** at the bottom of its brief to retrieve real restaurants and cafés nearby.'} I won’t name businesses from memory — they must come from a live source.`,
      placeIds: p ? [p.id] : [], followUps: [], caveats: [], links: p ? [{ label: `Suggest More near ${p.name}`, to: `/place/${p.id}#sm-title` }] : [],
    };
  }

  // describe a named place
  if (named.length === 1 && !hasStructure(interpretQuery(text.replace(new RegExp(named[0].name, 'i'), '')))) {
    const p = named[0];
    return {
      text: `**${p.name}** (${p.country}): ${p.summary}\n\nMain reason to go: ${REASON_LABELS[p.primaryReason]}.\nWatch for: ${p.cons.slice(0, 2).join('; ') || 'nothing flagged in our data'}.`,
      placeIds: [p.id], followUps: [`Find five places like ${p.name}`], caveats,
    };
  }

  // general discovery
  const areas = buildAreas(places);
  const c = interpretQuery(text, areas);
  if (hasStructure(c)) {
    const ms = rankPlaces(places, c, { toUSD: ctx.toUSD }).slice(0, 5);
    if (ms.length) {
      return {
        text: `Here are the best matches I can find in the catalogue:\n${ms.map((m, i) => `${i + 1}. **${m.place.name}** (${m.place.country}) — ${explainMatch(m)}`).join('\n')}`,
        placeIds: ms.map((m) => m.place.id), followUps: ['Compare the top two'], caveats,
      };
    }
    return { text: 'Nothing in the curated catalogue fits all of that. Try relaxing one requirement, or look up a specific town in Explore.', placeIds: [], followUps: [], caveats: [] };
  }
  const direct = nameSearch(places, text, 3);
  if (direct.length) return { text: `Did you mean ${direct.map((d) => `**${d.name}**`).join(', ')}?`, placeIds: direct.map((d) => d.id), followUps: [], caveats: [] };
  const area = findArea(text, buildAreas(places));
  return { text: `${area ? `I only have curated places in some countries, and ${area.label} may not be one.` : 'I’m in demonstration mode, so I understand structured requests like “quiet mountain town for three months with good hiking”, “compare Lisbon and Funchal”, or “find five places like this one”.'} Connect an AI key on the server for open-ended answers.`, placeIds: [], followUps: ['Find a quiet mountain town where we could live for three months'], caveats: [] };
}

/** Compact, grounded context for the AI chat endpoint. */
export function aiContext(ctx: AssistantContext, latest: string) {
  const slim = (p: Place) => ({ id: p.id, name: p.name, country: p.country, region: p.region, kind: p.kind, summary: p.summary, env: p.env, lifestyle: p.lifestyle, practical: p.practical, scores: p.scores, monthlyCostUSD_estimate: p.monthlyCostUSD, climate: p.climateNote, bestMonths: p.bestMonths, idealStay: p.idealStay, pros: p.pros, cons: p.cons, provenance: p.provenance, lat: p.lat, lng: p.lng });
  const c = interpretQuery(latest, buildAreas(ctx.places));
  const candidates = hasStructure(c) ? rankPlaces(ctx.places, c, { toUSD: ctx.toUSD }).slice(0, 8).map((m) => ({ ...slim(m.place), matchedBecause: m.reasons })) : nameSearch(ctx.places, latest, 4).map(slim);
  return {
    note: 'provenance: curated = editorial sample data (not live), estimate = rough figure. No live listings, prices or opening hours are included.',
    currentPlace: ctx.current ? { ...slim(ctx.current), special: ctx.current.special, localLife: ctx.current.localLife } : null,
    saved: ctx.saved.map((s) => { const p = ctx.places.find((x) => x.id === s.placeId); return p ? { ...slim(p), status: s.status, userNotes: s.notes, tags: s.tags } : null; }).filter(Boolean),
    itineraries: ctx.itineraries.map((i) => ({ id: i.id, name: i.name, purpose: i.purpose, durationDays: i.durationDays, status: i.status, stays: i.stays.map((s) => s.title), stops: i.days.flatMap((d) => d.stops.map((s) => s.title)).slice(0, 40) })),
    candidates,
  };
}
