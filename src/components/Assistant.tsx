import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useMatch } from 'react-router-dom';
import { Icon } from './Icon';
import { useUi } from '../store/ui';
import { useStore } from '../store';
import { useCatalog } from '../lib/hooks';
import { aiContext, demoReply, type AssistantReply } from '../lib/assistant';
import { api } from '../services/api';

interface Msg { role: 'user' | 'assistant'; text: string; reply?: AssistantReply; mode?: 'demo' | 'ai'; error?: string }

function Rich({ text }: { text: string }) {
  return <div className="rich">{text.split('\n').map((line, i) => <p key={i}>{line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) => (seg.startsWith('**') ? <b key={j}>{seg.slice(2, -2)}</b> : seg))}</p>)}</div>;
}

export function Assistant() {
  const open = useUi((s) => s.assistantOpen);
  const setOpen = useUi((s) => s.setAssistantOpen);
  const status = useUi((s) => s.status);
  const fx = useUi((s) => s.fx);
  const selectedId = useUi((s) => s.selectedId);
  const { places, get } = useCatalog();
  const saved = useStore((s) => s.saved);
  const trips = useStore((s) => s.itineraries);
  const match = useMatch('/place/:id');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = get(match?.params.id) ?? get(selectedId);
  const aiLive = status?.ai.state === 'live';

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 150); }, [open]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) setOpen(false); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open, setOpen]);

  const prompts = useMemo(() => {
    const list: string[] = [];
    if (current) { list.push(`Find five places like ${current.name}`, `What are the downsides of ${current.name}?`); }
    if (Object.keys(saved).length >= 1) list.push('Which of our saved places would be best for a three-month stay?');
    list.push('Suggest unusual nature experiences near Cape Town', 'Compare Lisbon and Chiang Mai for remote work', 'Build a relaxed three-day itinerary from our saved places');
    return list.slice(0, 5);
  }, [current, saved]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    const next: Msg[] = [...msgs, { role: 'user', text }];
    setMsgs(next); setBusy(true);
    const ctx = { places, current, saved: Object.values(saved), itineraries: trips, toUSD: fx?.toUSD };
    let out: Msg;
    if (aiLive) {
      try {
        const r = await api.ai.chat(next.slice(-8).map((m) => ({ role: m.role, content: m.text })), aiContext(ctx, text));
        const known = new Set(places.map((p) => p.id));
        out = { role: 'assistant', text: r.answer, mode: 'ai', reply: { text: r.answer, placeIds: r.placeIds.filter((id) => known.has(id)), followUps: r.followUps, caveats: r.caveats } };
      } catch (e) {
        const d = demoReply(text, ctx);
        out = { role: 'assistant', text: d.text, mode: 'demo', reply: d, error: `AI unavailable (${(e as Error).message}). Answered in demo mode.` };
      }
    } else {
      const d = demoReply(text, ctx);
      out = { role: 'assistant', text: d.text, mode: 'demo', reply: d };
    }
    setMsgs((m) => [...m, out]); setBusy(false);
  };

  if (!open) return null;
  return (
    <div className="assistant-wrap" role="dialog" aria-modal="false" aria-label="GLOBA assistant">
      <div className="assistant panel night">
        <div className="row spread assistant-head">
          <div className="row"><span className="logo-dot"><Icon name="sparkles" /></span><div><b>Travel assistant</b><div className="small muted">{current ? `Looking at ${current.name}` : 'Ask about places, plans, saved items'}</div></div></div>
          <div className="row"><span className={`badge ${aiLive ? 'ai' : 'demo'}`} title={aiLive ? `${status?.ai.provider} · ${status?.ai.model}` : 'Offline deterministic mode'}>{aiLive ? 'AI' : 'Demo mode'}</span>
            <button className="btn icon sm ghost" onClick={() => setOpen(false)} aria-label="Close assistant"><Icon name="close" /></button></div>
        </div>
        <div className="assistant-body" aria-live="polite">
          {msgs.length === 0 && (
            <div className="stack">
              <p className="muted small" style={{ margin: 0 }}>{aiLive ? 'Answers are grounded in GLOBA’s catalogue, your saved places and itineraries. I won’t invent businesses, prices or bookings.' : 'Demonstration mode: I answer from the built-in catalogue and your saved data using simple rules. Connect an AI key on the server for open-ended help.'}</p>
              <div className="stack" style={{ gap: 6 }}>{prompts.map((p) => <button key={p} className="ask-card" style={{ minHeight: 0, padding: 12 }} onClick={() => send(p)}><Icon name="sparkles" /><span>{p}</span></button>)}</div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === 'assistant' ? (
                <>
                  <Rich text={m.text} />
                  {m.error && <div className="notice small"><Icon name="info" />{m.error}</div>}
                  {m.reply && m.reply.placeIds.length > 0 && <div className="row wrap" style={{ gap: 6 }}>{m.reply.placeIds.map((id) => { const p = get(id); return p ? <Link key={id} className="chip" to={`/place/${id}`} onClick={() => setOpen(false)}><Icon name="pin" width={12} height={12} />{p.name}</Link> : null; })}</div>}
                  {m.reply?.links?.map((l) => <Link key={l.to} className="btn sm primary" to={l.to} onClick={() => setOpen(false)}>{l.label}</Link>)}
                  {m.reply && m.reply.caveats.length > 0 && <div className="small muted">{m.reply.caveats.join(' ')}</div>}
                  {m.reply && m.reply.followUps.length > 0 && <div className="row wrap" style={{ gap: 6 }}>{m.reply.followUps.map((f) => <button key={f} className="chip" onClick={() => send(f)}>{f}</button>)}</div>}
                  <span className={`badge ${m.mode === 'ai' ? 'ai' : 'demo'}`} style={{ alignSelf: 'flex-start' }}>{m.mode === 'ai' ? 'AI-generated from retrieved data' : 'Demo answer · curated data'}</span>
                </>
              ) : m.text}
            </div>
          ))}
          {busy && <div className="msg assistant"><span className="spinner" /></div>}
          <div ref={end} />
        </div>
        <form className="assistant-input" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
          <input ref={inputRef} className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about places or plans…" aria-label="Message the assistant" />
          <button className="btn primary icon" disabled={!input.trim() || busy} aria-label="Send"><Icon name="send" /></button>
        </form>
      </div>
    </div>
  );
}
