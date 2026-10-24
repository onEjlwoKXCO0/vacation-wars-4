// The crew's friends who live on the Moon. Photos: assets/npc/<photo>.jpg.
// `deal` NPCs change a player flag through the server ('npc:deal'), so it shows in the final contract.

const A = (presentation, skin, hairStyle, hairColor, facial = 'none', eyewear = 'none', accessory = 'none', outfit = 7) =>
  ({ presentation, skin, hairStyle, hairColor, facial, eyewear, accessory, outfit });

export const NPCS = [
  {
    id: 'hicham', name: 'Hicham', title: 'Black Market Dealer', photo: 'hicham', scene: 'in_black', x: 10, y: 3.9, dir: 'down', color: '#c77dff',
    look: { appearance: A('masc', 4, 'buzz', 0, 'beard'), look: { build: 'broad', top: '#1b1a22', topStyle: 'jacket', accent: '#6b1f4f', pants: '#18171e', pantsStyle: 'trousers', shoes: '#0e0d12', shoeStyle: 'shoe', extras: { chain: true, watch: true } } },
    lines: [
      'Officially? I sell cards. Unofficially? I sell possibilities…',
      'You got the VC? Good. Let\'s make it interesting.',
      'These powers aren\'t cheap, but they\'re worth it. Find my terminal on the spacecraft.',
      'Trust me, I\'m not here to help you. I\'m here to profit.',
      'Shhh… this stays between us, yeah?',
      'Come back at the end, my friend. The shop opens when the Pharaoh is done with you.',
    ],
  },
  {
    id: 'joseph', name: 'Joseph', title: 'Intergalactic Traveller · Hicham\'s supplier', photo: 'joseph', scene: 'campus', x: 57.7, y: 56.9, dir: 'left', color: '#e8a24a',
    look: { appearance: A('masc', 1, 'short', 2), look: { top: '#5d6b4a', topStyle: 'sherpa', accent: '#1d2340', pants: '#8a6a45', pantsStyle: 'cargo', shoes: '#f4f6fb', extras: { backpack: true, watch: true } } },
    lines: [
      'Don\'t worry, I\'ve got what you need. Just don\'t ask too many questions.',
      'Hicham told me about you. You\'re serious, you.',
      'We don\'t go to the other end of the world for nothing. Every trip has a price.',
      'France? It\'s nice. But Morocco is the real thing.',
      'Ready to take a risk? Good deals don\'t come without risk.',
      'Tip from the road: a Shield is cheap, and a Veto hurts. Pack both.',
      'The world is a map, and I\'m filling it in.',
    ],
  },
  {
    id: 'alice_nico', name: 'Alice & Nico', title: 'The Converters · ambassadors of France', photo: 'alice_nico', photoPos: '78% 50%', scene: 'campus', x: 30.3, y: 39.6, dir: 'down', color: '#5b8cff', pair: true,
    look: { appearance: A('fem', 0, 'long', 2), look: { top: '#d8c3a5', topStyle: 'jacket', accent: '#e85b5b', pants: '#4a6fa5', pantsStyle: 'jeans', extras: { headband: true, bag: true, baguette: true } } },
    look2: { appearance: A('masc', 1, 'curly', 0), look: { top: '#22242e', topStyle: 'jacket', accent: '#9aa2b5', pants: '#7d828f', pantsStyle: 'cargo', extras: { croissant: true } } },
    lines: [
      '« Venez en France, c\'est le meilleur pays du monde ! » — Come to France, the best country in the world!',
      'Honestly, in France you\'ll love it. Good food, culture, zero stress.',
      'Come on, we take you to Paris? Just once, promise!',
      'A croissant in the morning changes a life.',
      'France isn\'t just a country, it\'s a state of mind.',
      'OK, maybe it\'s a bit cliché… but it\'s true anyway!',
    ],
    deal: { id: 'france', ask: 'Promise to put 🇫🇷 France on your wishlist?', yes: 'Promise! 🥐', no: 'Not this time', done: 'You promised. France will be waiting on your wishlist. 🥐' },
  },
  {
    id: 'imane', name: 'Imane “Cléopâtre”', title: 'Owner of the Interplanetary Club', photo: 'imane', scene: 'in_club', x: 21.5, y: 5.1, dir: 'down', color: '#f0c35a',
    look: { appearance: A('fem', 2, 'wavy', 0, 'none', 'none', 'earrings'), look: { top: '#f2ead8', topStyle: 'dress', accent: '#e0b13a', shoes: '#e0b13a', shoeStyle: 'sandal', extras: { laurel: true, necklace: true, armband: true } } },
    lines: [
      'Welcome to the Club Interplanétaire, darling. A great queen never walks alone.',
      'I don\'t just dream, I have a plan. And this plan is ours.',
      'Life is too short for bad plans — so let\'s make them with good people.',
    ],
    deal: { id: 'vip', ask: 'Imane offers you a VIP pass to her club… “The price? You obey me for 3 days of the holiday.”', yes: 'Accept VIP 👑', no: 'Decline', done: 'You are VIP. And you belong to Cléopâtre for 3 days of the holiday. It\'s in the contract. 👑' },
  },
  {
    id: 'plami', name: 'Plami', title: 'The Dreamer', photo: 'plami', scene: 'in_bio', x: 17, y: 8.6, dir: 'down', color: '#ff8fb8',
    look: { appearance: A('fem', 1, 'wavy', 1, 'none', 'none', 'earrings'), look: { top: '#d8c3a5', topStyle: 'crop', pants: '#f2ede4', pantsStyle: 'wide', shoes: '#c9a27a', extras: { bracelets: true, flower: true } } },
    lines: [
      'Heyyy! Ready for a new adventure? Take this — a flower bracelet. Good luck and happy holidays! 🌸',
      'Don\'t worry, everything will be fine. We\'ve got this!',
      'Travelling isn\'t only seeing places, it\'s seeing yourself better.',
      'Life is more beautiful with a smile and a little tea.',
    ],
    deal: { id: 'bracelet', auto: true, done: 'Plami tied a flower bracelet on your wrist. 🌸 Good luck and happy holidays!' },
  },
  {
    id: 'moumanou', name: 'Moumanou', title: 'The Seer', photo: 'moumanou', scene: 'in_seer', x: 7, y: 3.6, dir: 'down', color: '#9b8cff',
    look: { appearance: A('fem', 5, 'braids', 0, 'none', 'none', 'earrings'), look: { top: '#2a1f3d', topStyle: 'robe', accent: '#e8b84a', shoes: '#e8b84a', shoeStyle: 'sandal', extras: { orb: true, beads: true } } },
    lines: [
      'I see things before they happen… like a premonition.',
      'The future isn\'t written, but it whispers to those who listen.',
      'You doubt too much. The universe sends you signs — look closer.',
    ],
    deal: { id: 'premonition', auto: true },
  },
  {
    id: 'alessandro', name: 'Alessandro', title: 'Chef de salle · Moon Arcade', photo: 'alessandro', scene: 'in_tower', x: 13, y: 8.6, dir: 'down', color: '#5ff2ff',
    look: { appearance: A('masc', 0, 'short', 0), look: { top: '#141418', accent: '#2a2a32', pants: '#1d2333', pantsStyle: 'jeans', shoes: '#f4f6fb', extras: { chain: true } } },
    lines: [
      'Benvenuti! Quiz, memory, duels — and the most beautiful Earth on the Moon.',
      'Barcelona to forget, or a chicha with the tonton? Choose wisely.',
      'A perfect quiz is worth one chip. Glory is worth more.',
    ],
  },
];

export const npcById = (id) => NPCS.find((n) => n.id === id) || null;

/** Vague-but-fun premonition text for a country (the country itself is drawn by the server). */
export function premonitionText(country) {
  if (!country) return 'The cards are cloudy today… come back after you board.';
  const cues = [
    `I see ${country.flag}… ${country.highlights.split(',')[0].toLowerCase()}… and someone forgetting their charger.`,
    `The cards show ${country.flag}. I hear laughter, and a very late dinner.`,
    `${country.flag}… I see it clearly. Pack for ${country.temp[7] > 22 ? 'heat' : 'cool nights'}.`,
  ];
  return cues[country.name.length % cues.length] + ` — ${country.name}. Remember I said it.`;
}
