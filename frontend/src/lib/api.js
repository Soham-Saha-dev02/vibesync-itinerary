const BASE = import.meta.env.VITE_API_URL || '';

export async function generateItinerary({ favorites, city, days }, signal) {
  let res;
  try {
    res = await fetch(`${BASE}/api/itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorites, city, days }),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Cannot reach the VibeSync server. Make sure the backend is running (npm run dev in /backend).');
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status}). Please try again.`);
  }
  return data;
}