import { useState } from 'react';
import { ArrowRight, CalendarClock, MapPin, Sparkles, TriangleAlert, X } from 'lucide-react';
import OverprintMark from './OverprintMark.jsx';

const EXAMPLE = { favorites: ['Serial Experiments Lain', 'Hotline Miami', 'MF DOOM'], city: 'Tokyo' };
const CITIES = ['Tokyo', 'New York', 'London', 'Berlin', 'Paris', 'Seoul', 'Los Angeles', 'Mumbai'];
const MAX_FAVORITES = 8;

export default function Hero({ onSubmit, error, initial }) {
  const [favorites, setFavorites] = useState(initial?.favorites ?? []);
  const [draft, setDraft] = useState('');
  const [city, setCity] = useState(initial?.city ?? '');
  const [days, setDays] = useState(initial?.days ?? 2);
  const [localError, setLocalError] = useState('');

  function addFavorites(text) {
    const parts = text
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return favorites;

    const next = [...favorites];
    for (const p of parts) {
      const exists = next.some((f) => f.toLowerCase() === p.toLowerCase());
      if (!exists && next.length < MAX_FAVORITES) next.push(p.slice(0, 100));
    }
    setFavorites(next);
    setDraft('');
    return next;
  }

  function handleKeyDown(e) {
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
      e.preventDefault();
      addFavorites(draft);
    } else if (e.key === 'Backspace' && !draft && favorites.length) {
      setFavorites(favorites.slice(0, -1));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const finalFavorites = addFavorites(draft);
    const finalCity = city.trim();

    if (!finalFavorites.length) {
      setLocalError('Add at least one favorite: an anime, a game, an artist, anything.');
      return;
    }
    if (!finalCity) {
      setLocalError('Pick the city you want to explore.');
      return;
    }
    setLocalError('');
    onSubmit({ favorites: finalFavorites, city: finalCity, days });
  }

  function fillExample() {
    setFavorites(EXAMPLE.favorites);
    setCity(EXAMPLE.city);
    setDraft('');
    setLocalError('');
  }

  const shownError = localError || error;

  return (
    <section className="relative grid items-start gap-12 pt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-20">
      <div className="relative">
        <OverprintMark className="pointer-events-none absolute -left-24 -top-24 -z-0 w-[26rem] opacity-70 sm:w-[34rem]" />
        <div className="relative z-10">
          <h1 className="max-w-2xl text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
            Your taste, mapped onto a city.
          </h1>
          <p className="mt-6 max-w-lg font-serif text-xl leading-relaxed text-ink/80">
            Tell us the anime, games, and records you can&rsquo;t stop talking about. We read the vibe underneath,
            find the places that feel the same, and plan your weekend hour by hour.
          </p>

          <ul className="mt-10 grid max-w-xl gap-4 text-sm sm:grid-cols-3">
            {[
              { icon: Sparkles, text: 'Reads the mood behind your favorites' },
              { icon: MapPin, text: 'Matches it to real places via Qloo' },
              { icon: CalendarClock, text: 'Schedules your weekend by the hour' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 size-4 shrink-0 text-cobalt" aria-hidden="true" />
                <span className="text-ink/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="relative z-10 rounded-[2rem] border-2 border-ink bg-white p-6 shadow-[8px_8px_0_0_var(--color-ink)] sm:p-8"
      >
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="favorites-input" className="text-lg font-bold">
            What are you into?
          </label>
          <button
            type="button"
            onClick={fillExample}
            className="text-sm font-semibold text-cobalt underline decoration-2 underline-offset-4 hover:text-ink"
          >
            Try an example
          </button>
        </div>

        <div
          className="mt-3 flex min-h-[3.5rem] flex-wrap items-center gap-2 rounded-2xl border-2 border-ink/20 bg-paper/60 p-2.5 focus-within:border-cobalt"
          onClick={() => document.getElementById('favorites-input')?.focus()}
        >
          {favorites.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink py-1.5 pl-3.5 pr-2 text-sm font-semibold text-white"
            >
              {f}
              <button
                type="button"
                onClick={() => setFavorites(favorites.filter((x) => x !== f))}
                aria-label={`Remove ${f}`}
                className="rounded-full p-0.5 hover:bg-white/20"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            id="favorites-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => draft.trim() && addFavorites(draft)}
            placeholder={favorites.length ? 'Add another…' : 'Serial Experiments Lain, MF DOOM…'}
            disabled={favorites.length >= MAX_FAVORITES}
            className="min-w-[10rem] flex-1 bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-ink-soft/70"
          />
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          Press Enter or comma after each one. Up to {MAX_FAVORITES}. Obscure is good.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_auto]">
          <div>
            <label htmlFor="city-input" className="text-lg font-bold">
              Which city?
            </label>
            <input
              id="city-input"
              list="city-options"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Tokyo"
              autoComplete="off"
              className="mt-3 w-full rounded-2xl border-2 border-ink/20 bg-paper/60 px-4 py-3 text-base outline-none focus:border-cobalt"
            />
            <datalist id="city-options">
              {CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <fieldset>
            <legend className="text-lg font-bold">Days</legend>
            <div className="mt-3 inline-flex rounded-2xl border-2 border-ink/20 bg-paper/60 p-1">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  aria-pressed={days === d}
                  className={`rounded-xl px-4 py-2 text-base font-bold transition-colors ${
                    days === d ? 'bg-cobalt text-white' : 'text-ink hover:bg-ink/10'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {shownError && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-2xl border-2 border-flamingo bg-flamingo/10 p-4 text-sm font-medium"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-flamingo" aria-hidden="true" />
            <span>{shownError}</span>
          </div>
        )}

        <button
          type="submit"
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cobalt px-6 py-4 text-lg font-bold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          Build my weekend
          <ArrowRight className="size-5" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}