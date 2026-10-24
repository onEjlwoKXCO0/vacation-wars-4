// Where each player flies from: any of the 193 countries (its main airport city).
import { UN_COUNTRIES, unById, FAVOURITE_DEPARTURES } from './un.js';

const LEGACY = { BRU: '056', CRL: '056', SKP: '807', BEG: '688', PAR: '250', AMS: '528', LIS: '620', WAW: '616', CMN: '504' };

export const DEPARTURES = UN_COUNTRIES.map((c) => ({ id: c.id, city: c.city, country: c.name, lat: c.lat, lon: c.lon, hub: c.hub, iso2: c.iso2 }));
export const DEPARTURE_IDS = new Set(DEPARTURES.map((d) => d.id));
export const normalizeHome = (id) => (DEPARTURE_IDS.has(id) ? id : LEGACY[id] || '056');
export const departureById = (id) => { const c = unById(normalizeHome(id)); return { id: c.id, city: c.city, country: c.name, lat: c.lat, lon: c.lon, hub: c.hub, iso2: c.iso2 }; };
export { FAVOURITE_DEPARTURES };
