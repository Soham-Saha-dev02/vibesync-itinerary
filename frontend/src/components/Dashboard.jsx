import { useState } from 'react';
import { ArrowLeft, Check, Copy, Database, ExternalLink, MapPin } from 'lucide-react';
import OverprintMark from './OverprintMark.jsx';

const pct = (a) => Math.max(0, Math.min(100, Math.round(Number(a) * 100)));

const mapsUrl = (name, city) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${city}`)}`;

const STEP_LABELS = {
  extract_vibe: 'Read your vibe',
  qloo_retrieval: 'Queried Qloo',
  qloo_retrieval_mock_fallback: 'Queried Qloo (sample data)',
  compose_itinerary: 'Planned the weekend',
};

function planAsText(result) {
  const { itinerary, city } = result;
  const lines = [`${itinerary.title} (${city})`, itinerary.tagline, ''];
  for (const day of itinerary.days) {
    lines.push(`${day.day}: ${day.theme}`);
    for (const s of day.stops) lines.push(`  ${s.time} - ${s.title}${s.place_name && s.place_name !== s.title ? ` @ ${s.place_name}` : ''}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

function Stop({ stop, city }) {
  const p = stop.place;
  const [clock, ...rest] = String(stop.time || '').split(' ');
  const showMap = stop.from_qloo && p && !p.is_mock;

  return (
    <li className="grid grid-cols-[4.25rem_1fr] gap-x-3 sm:grid-cols-[5.5rem_1fr] sm:gap-x-5">
      <div className="pt-0.5 text-right">
        <p className="text-xl font-extrabold leading-none sm:text-3xl">{clock}</p>
        {rest.length > 0 && <p className="mt-1 text-xs font-semibold text-ink-soft">{rest.join(' ')}</p>}
      </div>

      <div className="relative border-l-2 border-ink/15 pb-10 pl-5 sm:pl-7">
        <span
          aria-hidden="true"
          className={`absolute -left-[7px] top-1.5 size-3 rounded-full ring-4 ring-paper ${
            stop.from_qloo ? 'bg-cobalt' : 'bg-sun'
          }`}
        />

        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-xl font-bold leading-snug sm:text-2xl">{stop.title}</h4>
          {stop.category && (
            <span className="rounded-full border border-ink/25 px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
              {stop.category}
            </span>
          )}
        </div>

        {stop.place_name && stop.place_name !== stop.title && (
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-cobalt">
            <MapPin className="size-3.5" aria-hidden="true" />
            {stop.place_name}
          </p>
        )}

        {stop.description && <p className="mt-3 max-w-xl font-serif text-lg leading-relaxed text-ink/85">{stop.description}</p>}

        {stop.why_it_fits && (
          <p className="mt-4 max-w-xl border-l-4 border-flamingo bg-flamingo/10 py-2 pl-4 pr-3 font-serif text-base italic leading-relaxed">
            {stop.why_it_fits}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {stop.from_qloo && p?.affinity != null && (
            <span className="inline-flex items-center gap-2 font-semibold">
              <span className="h-2 w-20 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                <span className="block h-full bg-cobalt" style={{ width: `${pct(p.affinity)}%` }} />
              </span>
              {pct(p.affinity)}% taste match
            </span>
          )}
          {!stop.from_qloo && (
            <span className="rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold">Local pick, not from Qloo</span>
          )}
          {p?.is_mock && (
            <span className="rounded-full bg-sun px-2.5 py-0.5 text-xs font-bold">Demo place</span>
          )}
          {p?.address && <span className="text-ink-soft">{p.address}</span>}
          {showMap && (
            <a
              href={mapsUrl(stop.place_name, city)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-cobalt underline decoration-2 underline-offset-4 hover:text-ink"
            >
              Open in Maps <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </div>

        {p?.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.tags.slice(0, 4).map((t) => (
              <span key={t} className="rounded-md bg-ink/[0.06] px-2 py-0.5 text-xs font-medium text-ink-soft">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

export default function Dashboard({ result, onReset }) {
  const { vibe, itinerary, places, entities, meta, city } = result;
  const [activeDay, setActiveDay] = useState(0);
  const [copied, setCopied] = useState(false);

  const day = itinerary.days[Math.min(activeDay, itinerary.days.length - 1)];
  const sample = meta?.qloo_source === 'mock' || meta?.degraded;
  const topPlaces = [...places].sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1)).slice(0, 10);

  async function copyPlan() {
    try {
      await navigator.clipboard.writeText(planAsText(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-full border-2 border-ink px-4 py-2 text-sm font-bold hover:bg-ink hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          New itinerary
        </button>
        <button
          type="button"
          onClick={copyPlan}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-cobalt"
        >
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy plan'}
        </button>
      </div>

      {sample && (
        <div role="status" className="mt-5 flex items-start gap-3 rounded-2xl border-2 border-ink bg-sun p-4 text-sm font-semibold">
          <Database className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {meta?.degraded
              ? 'Qloo was unavailable for this run, so the places below are sample data.'
              : 'Sample data: the places below are placeholders, not live Qloo results.'}
          </span>
        </div>
      )}

      <section className="mt-10 grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm font-semibold text-ink-soft">Your vibe in {city}</p>
          <h2 className="mt-2 text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">{vibe.vibe_title}</h2>
          <p className="mt-6 max-w-2xl font-serif text-xl leading-relaxed text-ink/85">{vibe.vibe_summary}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {vibe.vibe_keywords.map((k) => (
              <span key={k} className="rounded-full border-2 border-ink px-3.5 py-1 text-sm font-bold">
                {k}
              </span>
            ))}
          </div>
        </div>

        <div className="relative flex flex-col items-center">
          <OverprintMark className="w-52 sm:w-64" />
          <div className="mt-4 w-full max-w-xs text-center">
            <p className="text-sm font-semibold text-ink-soft">
              {meta?.qloo_source === 'mock' ? 'Favorites used' : 'Matched in the Qloo taste graph'}
            </p>
            <p className="mt-1 font-serif text-lg leading-snug">{entities.map((e) => e.name).join(', ')}</p>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-12 lg:grid-cols-[1.7fr_1fr]">
        <div>
          <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{itinerary.title}</h3>
          {itinerary.tagline && <p className="mt-2 font-serif text-xl text-ink/75">{itinerary.tagline}</p>}

          <div role="tablist" aria-label="Itinerary days" className="mt-8 flex flex-wrap gap-2">
            {itinerary.days.map((d, idx) => (
              <button
                key={`${d.day}-${idx}`}
                role="tab"
                type="button"
                aria-selected={idx === activeDay}
                onClick={() => setActiveDay(idx)}
                className={`rounded-full border-2 px-5 py-2 text-base font-bold transition-colors ${
                  idx === activeDay ? 'border-cobalt bg-cobalt text-white' : 'border-ink hover:bg-ink hover:text-white'
                }`}
              >
                {d.day || `Day ${idx + 1}`}
              </button>
            ))}
          </div>

          {day?.theme && <p className="mt-6 text-xl font-bold">{day.theme}</p>}

          <ol className="mt-8">
            {day?.stops.map((s, idx) => (
              <Stop key={`${day.day}-${idx}-${s.time}`} stop={s} city={city} />
            ))}
          </ol>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[2rem] border-2 border-ink bg-white p-6 shadow-[6px_6px_0_0_var(--color-ink)]">
            <h3 className="text-xl font-extrabold">Places that match your taste</h3>
            <p className="mt-1 text-sm text-ink-soft">Ranked by Qloo affinity. {places.length} candidates considered.</p>

            <ul className="mt-5 space-y-4">
              {topPlaces.map((p) => (
                <li key={p.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-bold leading-snug">{p.name}</span>
                    {p.affinity != null && <span className="text-sm font-semibold text-cobalt">{pct(p.affinity)}%</span>}
                  </div>
                  {p.affinity != null && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
                      <div className="h-full bg-cobalt" style={{ width: `${pct(p.affinity)}%` }} />
                    </div>
                  )}
                  {p.tags?.length > 0 && <p className="mt-1.5 text-xs text-ink-soft">{p.tags.slice(0, 3).join(', ')}</p>}
                </li>
              ))}
            </ul>
          </div>

          <details className="mt-6 rounded-2xl border-2 border-ink/20 p-4 text-sm">
            <summary className="cursor-pointer font-bold">How the agent built this</summary>
            <ul className="mt-3 space-y-1.5">
              {(meta?.trace || []).map((t) => (
                <li key={t.step} className="flex justify-between gap-4">
                  <span>{STEP_LABELS[t.step] || t.step}</span>
                  <span className="text-ink-soft">{(t.ms / 1000).toFixed(1)}s</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-ink-soft">
              {Math.round((meta?.qloo_coverage ?? 0) * 100)}% of stops are tied to a taste-matched place. Total{' '}
              {((meta?.total_ms ?? 0) / 1000).toFixed(1)}s{meta?.cached ? ' (cached)' : ''}.
            </p>
          </details>
        </aside>
      </section>
    </div>
  );
}