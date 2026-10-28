import { slugify, hash01, sleep } from '../utils/helpers.js';

/**
 * Mock Qloo provider. Returns the SAME shapes as the real client so you can
 * build the whole product before your Qloo key arrives.
 * Every place is flagged is_mock: true.
 */

const ARCHETYPES = [
  { name: 'Static Bloom Record Cafe', tags: ['record store', 'cafe', 'vinyl'], desc: 'Crate-digging cafe with a rotating selection of obscure pressings and slow-drip coffee.' },
  { name: 'Neon Wire Listening Bar', tags: ['bar', 'listening bar', 'nightlife'], desc: 'Dim, hi-fi listening bar playing full albums on a vintage sound system.' },
  { name: 'Pixel Ghost Arcade', tags: ['arcade', 'retro gaming', 'entertainment'], desc: 'Cabinet arcade stocked with cult classics and import-only titles.' },
  { name: 'Midnight Cassette Ramen', tags: ['ramen', 'restaurant', 'late night'], desc: 'Counter-seat ramen shop open past 2 AM with a lo-fi soundtrack.' },
  { name: 'Subtext Books & Zines', tags: ['bookstore', 'zines', 'independent'], desc: 'Independent bookstore specializing in zines, manga, and underground print.' },
  { name: 'The Quiet Signal Gallery', tags: ['art gallery', 'contemporary art', 'digital art'], desc: 'Small gallery showing glitch art and net-art installations.' },
  { name: 'Afterimage Cinema', tags: ['cinema', 'repertory', 'film'], desc: 'Single-screen repertory theater with cult sci-fi and anime retrospectives.' },
  { name: 'Low Tide Vinyl Lounge', tags: ['lounge', 'vinyl', 'cocktails'], desc: 'Cocktail lounge built around a wall of jazz and hip-hop records.' },
  { name: 'Circuit Garden Rooftop', tags: ['rooftop', 'garden', 'view'], desc: 'Quiet rooftop garden with city views and a minimalist tea menu.' },
  { name: 'Hollow Frame Photo Walk', tags: ['experience', 'photography', 'walking tour'], desc: 'Self-guided night photography route through the most cinematic streets.' },
  { name: 'Echo Chamber Synth Shop', tags: ['music shop', 'synthesizers', 'workshop'], desc: 'Modular synth shop with a hands-on demo room.' },
  { name: 'Paper Lantern Izakaya', tags: ['izakaya', 'restaurant', 'small plates'], desc: 'Tiny back-alley izakaya with handwritten menus and no tourists.' },
  { name: 'Glitch Market Night Stalls', tags: ['night market', 'street food', 'vintage'], desc: 'Weekend night market with vintage tech, resale fashion, and street food.' },
  { name: 'Deadpan Coffee Roasters', tags: ['coffee', 'cafe', 'minimalist'], desc: 'Minimalist roaster with an all-concrete interior and single-origin flights.' },
  { name: 'Orbit Karaoke Booths', tags: ['karaoke', 'nightlife', 'entertainment'], desc: 'Private booths with deep-cut catalogs from underground and alt-rap acts.' },
  { name: 'Slow Burn Tea House', tags: ['tea house', 'quiet', 'traditional'], desc: 'Hidden tea house with low tables and ambient, rain-sound playlists.' },
  { name: 'Terminal Seven Bookbar', tags: ['bookbar', 'bar', 'late night'], desc: 'Bar-library hybrid with sci-fi shelves and low lighting.' },
  { name: 'Mirrorball Gallery Cafe', tags: ['cafe', 'art', 'brunch'], desc: 'Art-school cafe with rotating student exhibitions and excellent brunch.' },
];

async function resolveEntity(name) {
  await sleep(40);
  console.log(`[mock-qloo] resolving entity: ${name}`);
  return {
    query: name,
    id: `mock-${slugify(name)}`,
    name,
    types: ['urn:entity:mock'],
  };
}

async function fetchPlaces(entityIds, city, take = 30) {
  await sleep(120);
  console.log(`[mock-qloo] fetching places in ${city} for ${entityIds.length} entities`);

  const seed = entityIds.join('|');
  return ARCHETYPES.slice(0, Math.min(take, ARCHETYPES.length)).map((a, i) => ({
    id: `mock-place-${slugify(city)}-${i}`,
    name: `${a.name}`,
    address: `${10 + i * 3} Demo Street, ${city}`,
    description: a.desc,
    rating: Number((3.8 + hash01(`${seed}${i}r`) * 1.1).toFixed(1)),
    tags: a.tags,
    affinity: Number((0.55 + hash01(`${seed}${i}a`) * 0.44).toFixed(3)),
    explainability: null,
    lat: null,
    lng: null,
    is_mock: true,
  }));
}

export const mockQloo = { resolveEntity, fetchPlaces };
