// World regions for the Region Roulette. `members` lists the candidate countries of the
// Country Clash if that region wins (a country can appear in more than one region —
// Antarctica's gateways are Argentina and Chile).
import { COUNTRIES } from './countries.js';

const byRegion = (r) => COUNTRIES.filter((c) => c.region === r).map((c) => c.id);

export const REGIONS = [
  { id: 'europe', name: 'Europe', icon: '🏰', color: '#5b8cff', lat: 45, lon: 12, base: 100, blurb: 'Close, cheap flights, endless variety.' },
  { id: 'north_america', name: 'North America', icon: '🗽', color: '#ff7a5c', lat: 40, lon: -100, base: 100, blurb: 'Big cities, bigger parks, Caribbean Mexico.' },
  { id: 'caribbean', name: 'Central America & Caribbean', icon: '🏝️', color: '#2bd4c0', lat: 17, lon: -78, base: 100, blurb: 'Islands, rainforest, volcanoes, rum.' },
  { id: 'south_america', name: 'South America', icon: '🦙', color: '#48e08f', lat: -15, lon: -60, base: 100, blurb: 'Andes, Amazon, tango, salt flats.' },
  { id: 'africa', name: 'Africa', icon: '🦁', color: '#f0c35a', lat: 2, lon: 20, base: 100, blurb: 'Safaris, deserts, island paradises.' },
  { id: 'middle_east', name: 'Middle East & Caucasus', icon: '🐪', color: '#e8a24a', lat: 32, lon: 45, base: 100, blurb: 'Petra, Cappadocia, Georgian wine.' },
  { id: 'south_asia', name: 'South Asia', icon: '🐘', color: '#ff9f43', lat: 20, lon: 78, base: 100, blurb: 'Himalaya, tea hills, Maldives water.' },
  { id: 'southeast_asia', name: 'South-East Asia', icon: '🌴', color: '#5ff2ff', lat: 8, lon: 108, base: 100, blurb: 'Islands, temples, street food, cheap.' },
  { id: 'east_asia', name: 'East & Central Asia', icon: '🏯', color: '#ff4fd8', lat: 38, lon: 100, base: 100, blurb: 'Tokyo neon, Seoul nights, Silk Road cities, yurts.' },
  { id: 'oceania', name: 'Oceania', icon: '🦘', color: '#9b8cff', lat: -25, lon: 150, base: 100, blurb: 'Far, expensive, unforgettable.' },
  { id: 'antarctica', name: 'Antarctica', icon: '🐧', color: '#e9f3ff', lat: -75, lon: -60, base: 40, blurb: 'Rare on the wheel. Penguins guaranteed.', extraMembers: ['032', '152'] },
].map((r) => ({ ...r, members: [...byRegion(r.id), ...(r.extraMembers || [])] }));

export const regionById = (id) => REGIONS.find((r) => r.id === id) || null;
export const regionOfCountry = (cid) => REGIONS.find((r) => r.members.includes(cid)) || null;
