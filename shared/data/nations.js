// Nationalities / embassies and character appearance options.

/** The crew's couples by embassy: the Macedonian with the Polish, the Moroccan with the Portuguese. */
export const COUPLE_NATIONS = { poland: 'macedonia', macedonia: 'poland', portugal: 'morocco', morocco: 'portugal' };

export const NATIONS = [
  { id: 'portugal', name: 'Portugal', demonym: 'Portuguese', flag: '🇵🇹', countryId: '620', embassy: 'emb_pt', home: '056', lang: 'pt', ambassador: 'Embaixadora Amália',
    colors: { primary: '#0b6b3a', secondary: '#c8102e', trim: '#f2c94c' },
    preset: { presentation: 'fem', skin: 1, hairStyle: 'long', hairColor: 1, facial: 'none', eyewear: 'none', accessory: 'earrings', outfit: 0 } },
  { id: 'macedonia', name: 'North Macedonia', demonym: 'Macedonian', flag: '🇲🇰', countryId: '807', embassy: 'emb_mk', home: '807', lang: 'mk', ambassador: 'Амбасадор Стефан',
    colors: { primary: '#ce2028', secondary: '#f9d616', trim: '#f9d616' },
    preset: { presentation: 'fem', skin: 0, hairStyle: 'wavy', hairColor: 3, facial: 'none', eyewear: 'none', accessory: 'none', outfit: 1 } },
  { id: 'poland', name: 'Poland', demonym: 'Polish', flag: '🇵🇱', countryId: '616', embassy: 'emb_pl', home: '056', lang: 'fr', ambassador: 'Ambassadeur Kazimierz',
    colors: { primary: '#dc143c', secondary: '#ffffff', trim: '#ffffff' },
    preset: { presentation: 'masc', skin: 0, hairStyle: 'short', hairColor: 4, facial: 'none', eyewear: 'glasses', accessory: 'none', outfit: 2 } },
  { id: 'morocco', name: 'Morocco', demonym: 'Moroccan', flag: '🇲🇦', countryId: '504', embassy: 'emb_ma', home: '056', lang: 'fr', ambassador: 'Ambassadeur Youssef',
    colors: { primary: '#c1272d', secondary: '#006233', trim: '#e9c46a' },
    preset: { presentation: 'masc', skin: 2, hairStyle: 'short', hairColor: 0, facial: 'beard', eyewear: 'none', accessory: 'none', outfit: 3 } },
  { id: 'other', name: 'Elsewhere on Earth', demonym: 'Visitor', flag: '🌍', countryId: null, embassy: null, home: '056', lang: 'en', ambassador: null,
    colors: { primary: '#3a6ea5', secondary: '#e0e6f0', trim: '#9fd3ff' },
    preset: { presentation: 'neutral', skin: 3, hairStyle: 'bob', hairColor: 2, facial: 'none', eyewear: 'none', accessory: 'headphones', outfit: 4 } },
];

export const nationById = (id) => NATIONS.find((n) => n.id === id) || null;

export const APPEARANCE = {
  presentation: [
    { id: 'masc', label: 'Masculine' }, { id: 'fem', label: 'Feminine' }, { id: 'neutral', label: 'Neutral' },
  ],
  skin: ['#f6d3b8', '#e8b48c', '#c98e62', '#a86b45', '#7d4a2c', '#4f2e1b'],
  hairStyle: [
    { id: 'short', label: 'Short' }, { id: 'curly', label: 'Curly' }, { id: 'long', label: 'Long' }, { id: 'wavy', label: 'Wavy' },
    { id: 'ponytail', label: 'Ponytail' }, { id: 'bun', label: 'Bun' }, { id: 'bob', label: 'Bob' }, { id: 'buzz', label: 'Buzz' },
  ],
  hairColor: ['#151012', '#3b2418', '#5c3a22', '#8a5a36', '#c06a2e', '#e3c27a', '#c9ccd4', '#d94f8a'],
  facial: [{ id: 'none', label: 'None' }, { id: 'stubble', label: 'Stubble' }, { id: 'beard', label: 'Beard' }, { id: 'moustache', label: 'Moustache' }],
  eyewear: [{ id: 'none', label: 'None' }, { id: 'glasses', label: 'Glasses' }, { id: 'sunglasses', label: 'Sunglasses' }],
  accessory: [{ id: 'none', label: 'None' }, { id: 'earrings', label: 'Earrings' }, { id: 'scarf', label: 'Scarf' }, { id: 'cap', label: 'Cap' }, { id: 'headphones', label: 'Headphones' }],
  outfit: ['#2f8f5b', '#d64545', '#e0e3ea', '#c8963e', '#3a6ea5', '#7c4dbd', '#e07a2f', '#2b2d42'],
};

export function validateAppearance(a) {
  if (!a || typeof a !== 'object') return null;
  const pick = (list, v) => list.some((o) => o.id === v) ? v : null;
  const idx = (list, v) => Number.isInteger(v) && v >= 0 && v < list.length ? v : null;
  const out = {
    presentation: pick(APPEARANCE.presentation, a.presentation),
    skin: idx(APPEARANCE.skin, a.skin),
    hairStyle: pick(APPEARANCE.hairStyle, a.hairStyle),
    hairColor: idx(APPEARANCE.hairColor, a.hairColor),
    facial: pick(APPEARANCE.facial, a.facial),
    eyewear: pick(APPEARANCE.eyewear, a.eyewear),
    accessory: pick(APPEARANCE.accessory, a.accessory),
    outfit: idx(APPEARANCE.outfit, a.outfit),
  };
  return Object.values(out).some((v) => v === null) ? null : out;
}

// Pairs that trigger the special easter-egg interaction (hearts + smileys).
export const SPECIAL_PAIRS = [['poland', 'macedonia'], ['portugal', 'morocco']];

/** Which call group a player joins in the Pharaoh's test (they can change it in their passport). */
export const defaultGroup = (presentation) => (presentation === 'fem' ? 'girls' : 'boys');
export const isSpecialPair = (a, b) => SPECIAL_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
