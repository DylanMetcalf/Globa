# GLOBA

**Your world. Your adventures. Your story.**

*(For Dylan and Nicole.)*

GLOBA is a private travel-discovery and planning app for Dylan and Nicole: an interactive 3D globe that switches to a 2D map,
natural-language place discovery, rich destination briefs, shared saved places, a day-by-day itinerary builder (including
multi-stop long stays), and a small original 3D "miniature world" where saving a destination ends with lighting it up on the globe.

It works fully **before any API key is configured**. Where a feature needs a service you haven't connected, GLOBA shows an explicit
*Demo* / *Unavailable* state — it never presents sample data as live.

---

## Run it

Requirements: Node 20+ (developed on Node 22).

```bash
npm install
cp .env.example .env        # optional — everything works without keys
npm run dev                 # web on http://localhost:5173, API on :8787
```

Production-style (single process, serves the built app and the API):

```bash
npm run build
npm start                   # http://localhost:8787
```

### Open it on your phone

* **Same Wi-Fi (dev):** `npm run dev` already binds to all interfaces. Open `http://<your-computer-LAN-IP>:5173` on the phone
  (find the IP with `ipconfig` / `ifconfig`). Chrome/Safari treat plain `http://` LAN addresses as insecure, which is fine for GLOBA.
* **Anywhere (temporary):** `npm run build && npm start`, then tunnel port 8787 with a tool such as `cloudflared tunnel --url http://localhost:8787`
  or `ngrok http 8787`. Add it to your home screen for the app-like experience (there is a web app manifest and icons).
* Saved data is stored **per browser**. A phone and a laptop will not share places until cloud sync is added — use *Settings → Export/Import backup* to move data.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite (5173) + API (8787) with hot reload |
| `npm run build` / `npm start` | Type-check + production build / serve it with the API |
| `npm run typecheck` · `npm run lint` | `tsc -b` · ESLint |
| `npm test` | Vitest unit + API tests (73) |
| `npm run test:e2e` | Browser end-to-end checks (see *Testing*) |
| `node scripts/make-icons.mjs` | Re-render PNG app icons from `public/favicon.svg` |

---

## What is real, and what is demonstration data

| Capability | State out of the box | How it becomes "live" |
| --- | --- | --- |
| Globe, map, search, filters, saved places, itineraries, Our World, the miniature world | **Real**, fully local | — |
| Country outlines | **Real** (Natural Earth via `world-atlas`, bundled, offline) | — |
| Destination catalogue (36 destinations, 86 nearby landmarks) | **Curated sample data**, labelled *Curated* / *Estimate*. Written editorially for v1, **not live-verified**; scores are 1–5 judgements, costs are rough estimates; landmark coordinates are approximate | Replace/extend `src/data/*` or add a provider |
| Worldwide town/city lookup | **Live** (Open-Meteo geocoding, no key) | — |
| Weather forecast | **Live** on demand (Open-Meteo, no key) | — |
| Photos & summaries | **Live** Wikipedia (no key); generated illustrative artwork when none exists (labelled *Illustration*) | `UNSPLASH_ACCESS_KEY` for more photography |
| Suggest More (restaurants, cafés, markets…) | **Live** OpenStreetMap via Overpass (no key, best-effort, no prices/ratings) + curated landmarks. Honest error + search links if unreachable | A places provider implementing `PlacesProvider` |
| Currency conversion | **Live** (Frankfurter) — estimates are USD and converted only with live rates | — |
| Map tiles | OpenStreetMap standard tiles (light use). Country outlines are drawn locally so the map never renders blank | `MAP_TILE_URL` / `MAP_TILE_KEY` |
| **AI** (NL interpretation, explanations, assistant, itinerary drafting) | **Demo mode**: deterministic keyword interpretation + local ranking. Clearly badged | `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` (+`OPENAI_BASE_URL`) |
| Accommodation listings | **Not connected.** Shows search links + OSM-listed places; never invents properties, prices or availability | Implement `AccommodationProvider` in `server/providers/registry.ts` |
| Routing / travel times | **Not connected.** Straight-line distance, labelled as such | Implement `RoutingProvider` |
| Accounts / cloud sync | **None.** Browser `localStorage` only | See *Roadmap* |

`Settings → Integrations` shows this live from the server's `/api/status`.

## Architecture

```
shared/types.ts            Domain model shared by client + server (Place, Itinerary, Criteria, …)
server/                    Express API (secrets live here)
  index.ts                 routes, rate-limit, input validation (zod), static hosting in production
  providers/contracts.ts   One interface per integration
  providers/registry.ts    Where a real accommodation/routing provider plugs in
  providers/ai.ts          AI provider interface (Anthropic + OpenAI-compatible), prompts, output validation
  providers/data.ts        Geocoding, weather, Wikipedia/Unsplash, Overpass, FX
src/
  data/                    Curated catalogue (destinations.ts, pois.ts) + catalog.ts
  lib/discovery.ts         NL interpreter (demo) + ranking engine with explanations
  lib/itinerary.ts         Pure itinerary edit helpers + offline draft generator + AI → itinerary mapper
  lib/markers.ts           One marker model used by both the globe and the map
  store/index.ts           Zustand store, versioned persistence, validation/migration, backup/import
  store/ui.ts              Ephemeral UI state, search flow (retrieve → rank → explain)
  components/GlobeView.tsx three-globe (WebGL)    components/MapView.tsx  Leaflet    components/OrthoGlobe.tsx  Canvas fallback
  game/GameScene.ts        three.js miniature world (characters, bulb, camera, activation timeline)
  pages/                   Explore, Discover, Saved, Place (brief), Itineraries (+wizard, +editor), Our World, Settings, Light It Up
scripts/e2e.mjs            Browser end-to-end checks
```

Key design rules, enforced in code:

* **One place record, one coordinate pair.** Globe, map, saved places, itineraries and the mini-game all reference places by id.
  The game scene is a playful representation only — the glowing location on the globe uses the place's real coordinates.
* **Retrieve → rank → synthesise.** The AI only interprets requests and explains candidates *retrieved from the catalogue*.
  The server drops any id the AI returns that wasn't in the candidate list, and any tag outside the allowed vocabulary.
* **No fabricated businesses or listings.** Itinerary meals are generic ("Lunch — local café"); real venues come only from live sources with links.
* **Provenance everywhere:** `Live` · `Curated` · `Estimate` · `Your entry` · `Demo draft` · `AI suggestion`.
* **Activation ≠ visited.** Lighting a place up never changes its Saved/Planned/Visited status.

## Storage model (honest summary)

Everything is saved in this browser's `localStorage` under `globa:v1` (zustand `persist`, schema-validated, versioned).
It survives reloads but **is not synced between devices and has no account security**. On load, malformed records are dropped individually
(a raw copy is kept under `globa:backup:*` and you're told). Use *Settings → Export backup* regularly. The storage adapter in `src/store/index.ts`
is the only place that touches storage, so a database/cloud layer can be introduced without UI changes.

## Privacy

Private by default: no analytics, no social features, notes and plans never leave the browser except as small, explicit lookups
(place names/coordinates to Open-Meteo, Wikipedia, OpenStreetMap, and — only if you configure it — the AI provider with the context for that request).
Because there are no accounts, "Dylan" and "Nicole" are local profiles on one shared collection; this is **not** access control.

## Testing

* `npm test` — 73 unit/API tests: catalogue integrity, NL interpretation & ranking, persistence/migration/backup, itinerary editing & drafting,
  achievements are derived from real actions, the demo assistant, API validation, and the full AI path against a fake OpenAI-compatible server.
* `npm run test:e2e` — drives real Chromium (software WebGL) through: intro, all routes, search → panel, globe⇄map switching, NL discovery,
  filters, save/persist/reload, notes/tags/undo, brief sections, Suggest More, the itinerary wizard + edit/reorder/move/duplicate/delete,
  the miniature world end-to-end (walk → activate → celebrate → return → lit marker), mobile layout + joystick, reduced motion, and the no-WebGL fallbacks.
  Start the app first (`npm run build && npm start`) and run `E2E_URL=http://localhost:8787 npm run test:e2e`.

## Known limitations

* The catalogue is a hand-curated sample (36 destinations). Ranking quality is only as good as that data. Worldwide places can be added from live lookup but only have name/coordinates.
* Characters are original placeholders; "personalised from photos" is prepared (reference notes + flag) but not built.
* The miniature world is a large floating disk with 13 stylised worlds — seven continents (savanna, Asia, Europe, North America, South America, Oceania, Antarctica) plus desert, rainforest, lake, alpine, coast and volcano biomes — chosen from each place's landscape and country. They're playful, not recreations of real places. Preview any with `/light/<place-id>?theme=desert`.
* Overpass and the free Wikipedia/Open-Meteo APIs are rate-limited public services; occasional failures are expected and surfaced in the UI.
* Opening hours/prices/ratings are not available from the current sources and are never shown as if they were.
* No PWA offline caching; no cloud sync; no authentication.

## Roadmap

Auth + cloud sync (Supabase/Postgres behind the store adapter), a real accommodation provider, routing provider for travel times,
more curated destinations, photo-based character personalisation, optional narration via a TTS provider.

## Attributions

Map data © OpenStreetMap contributors (ODbL). Country geometry: Natural Earth (public domain) via `world-atlas`. Weather: Open-Meteo.
Photos/summaries: Wikipedia & Wikimedia Commons (credit shown in the UI; see each article for licences). Fonts: Outfit and Manrope (OFL) via Fontsource.
