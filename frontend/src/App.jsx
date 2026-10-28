import { useCallback, useRef, useState } from 'react';
import Hero from './components/Hero.jsx';
import Loading from './components/Loading.jsx';
import Dashboard from './components/Dashboard.jsx';
import { generateItinerary } from './lib/api.js';

const REQUEST_TIMEOUT_MS = 90_000;

export default function App() {
  const [status, setStatus] = useState('idle'); // idle | loading | done
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [request, setRequest] = useState(null);
  const abortRef = useRef(null);

  const handleSubmit = useCallback(async (payload) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setRequest(payload);
    setError('');
    setStatus('loading');

    try {
      const data = await generateItinerary(payload, controller.signal);
      setResult(data);
      setStatus('done');
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err.name === 'AbortError') {
        if (!timedOut) return;
        setError('That took too long. Please try again.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
      setStatus('idle');
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const handleCancel = () => {
    abortRef.current?.abort();
    setStatus('idle');
  };

  const handleReset = () => {
    setStatus('idle');
    setError('');
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-6 sm:px-8">
      <header className="flex items-center gap-2.5">
        <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
          <circle cx="12" cy="16" r="10" fill="#2F3CF0" />
          <circle cx="20" cy="16" r="10" fill="#FF4F9A" className="mix-blend-multiply" />
        </svg>
        <span className="text-xl font-extrabold tracking-tight">VibeSync</span>
      </header>

      <main>
        {status === 'idle' && <Hero onSubmit={handleSubmit} error={error} initial={request} />}
        {status === 'loading' && <Loading request={request} onCancel={handleCancel} />}
        {status === 'done' && result && <Dashboard result={result} onReset={handleReset} />}
      </main>

      <footer className="mt-24 border-t border-ink/15 pt-6 text-sm text-ink-soft">
        Built for the Qloo Agentic Hackathon. Taste data by Qloo, reasoning by Groq.
      </footer>
    </div>
  );
}