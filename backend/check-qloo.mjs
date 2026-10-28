import { config } from './src/config.js';
import { realQloo } from './src/services/qlooClient.js';

if (!config.qloo.apiKey) {
  console.error('QLOO_API_KEY is missing in backend/.env');
  process.exit(1);
}

const [city = 'Tokyo', ...names] = process.argv.slice(2);
const favorites = names.length ? names : ['MF DOOM', 'Hotline Miami', 'Serial Experiments Lain'];

console.log(`\nBase URL: ${config.qloo.baseUrl}`);
console.log(`City: ${city}`);
console.log(`Favorites: ${favorites.join(', ')}\n`);

try {
  console.log('1) Resolving favorites via /search ...');
  const resolved = (await Promise.all(favorites.map((n) => realQloo.resolveEntity(n)))).filter(Boolean);
  console.table(
    resolved.map((r) => ({ you_typed: r.query, qloo_matched: r.name, id: r.id, types: (r.types || []).join(', ') }))
  );
  if (!resolved.length) {
    console.error('No favorites were recognized. See troubleshooting.');
    process.exit(1);
  }

  console.log('2) Fetching places via /v2/insights ...');
  const places = await realQloo.fetchPlaces(resolved.map((r) => r.id), city, 10);
  console.log(`Places returned: ${places.length}\n`);
  console.table(
    places.slice(0, 10).map((p) => ({
      name: p.name,
      address: p.address,
      affinity: p.affinity,
      tags: (p.tags || []).slice(0, 3).join('|'),
      lat: p.lat,
    }))
  );

  const filled = (f) => places.filter((p) => p[f] !== null && p[f] !== undefined && p[f] !== '').length;
  console.log('Field coverage (filled / total):');
  for (const f of ['name', 'address', 'description', 'affinity', 'rating', 'lat']) {
    console.log(`  ${f.padEnd(12)} ${filled(f)} / ${places.length}`);
  }
  console.log('\nDone.');
} catch (err) {
  console.error('\nCheck failed:', err.message);
  process.exit(1);
}
