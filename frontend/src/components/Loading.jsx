import { useEffect, useState } from 'react';
import OverprintMark from './OverprintMark.jsx';

const MESSAGES = [
  'Analyzing your vibe…',
  'Reading between your favorites…',
  'Mapping your taste graph…',
  'Finding places that feel the same…',
  'Sequencing your weekend…',
  'Polishing the details…',
];

export default function Loading({ request, onCancel }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, MESSAGES.length - 1)), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <OverprintMark className="w-56 sm:w-72" />
      <p aria-live="polite" className="mt-8 text-3xl font-extrabold tracking-tight sm:text-4xl">
        {MESSAGES[i]}
      </p>
      {request && (
        <p className="mt-3 max-w-md font-serif text-lg text-ink/70">
          {request.favorites.slice(0, 3).join(', ')}
          {request.favorites.length > 3 ? ` and ${request.favorites.length - 3} more` : ''} in {request.city}
        </p>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="mt-10 text-sm font-semibold text-ink-soft underline decoration-2 underline-offset-4 hover:text-ink"
      >
        Cancel
      </button>
    </section>
  );
}