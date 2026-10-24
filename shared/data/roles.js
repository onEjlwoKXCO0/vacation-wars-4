// Roles: chosen ONCE at the Role Market before launch, locked for the whole game.
// Every power is concrete — no small percentages. The engine reads `ability`; the renderer reads `look`.
//   uses: 'passive' (always on) | 'stage' (once per decision) | 'game' (once per game)

export const ROLES = [
  {
    id: 'rookie', name: 'Rookie', price: 0, icon: '🧑‍🚀', tagline: 'Cash is a power too.',
    power: '+400 VC',
    detail: 'You get 400 extra Vacation Coins the moment you choose this role. More chips, bigger bets, richer at the Black Market.',
    ability: { kind: 'bonusCash', amount: 400, uses: 'passive' },
    look: { body: null, accent: null, gear: 'none' },
  },
  {
    id: 'commander', name: 'Commander', price: 300, icon: '🎖️', tagline: 'Double down on a plan.',
    power: 'Double all chips on one option',
    detail: 'Once per decision, pick an option: every chip on it counts double for that decision — yours and everyone else\'s.',
    ability: { kind: 'doubleBoosts', uses: 'stage' },
    look: { body: '#24305e', accent: '#e8b84a', gear: 'cape' },
  },
  {
    id: 'hacker', name: 'Hacker', price: 300, icon: '💻', tagline: 'Nothing is secret.',
    power: 'See every bet and every chip',
    detail: 'Always on: you see who bet what, who put chips on which option, and which powers were used — live, while everyone else plays blind.',
    ability: { kind: 'seeAll', uses: 'passive' },
    look: { body: '#1d2a24', accent: '#38f28c', gear: 'visor' },
  },
  {
    id: 'bookmaker', name: 'Bookmaker', price: 250, icon: '🎲', tagline: 'The house pays twice.',
    power: 'Winning bets pay double',
    detail: 'Always on: when your bet wins, you receive twice the normal payout.',
    ability: { kind: 'betDouble', uses: 'passive' },
    look: { body: '#3c5a3a', accent: '#f2e6c4', gear: 'visorCap' },
  },
  {
    id: 'diplomat', name: 'Diplomat', price: 300, icon: '🕊️', tagline: 'No means no.',
    power: 'Veto one option from the wheel',
    detail: 'Once per game, remove one option from the wheel entirely. Only a Shield can stop you. At least two options always remain.',
    ability: { kind: 'veto', uses: 'game' },
    look: { body: '#e9ecf2', accent: '#3a7bd5', gear: 'sash' },
  },
  {
    id: 'saboteur', name: 'Saboteur', price: 300, icon: '🧨', tagline: 'Boom goes the plan.',
    power: 'Wipe all chips on one option',
    detail: 'Once per decision, blow up every chip on one option (no refunds for anyone). Only a Shield can stop you.',
    ability: { kind: 'sabotage', uses: 'stage' },
    look: { body: '#222', accent: '#e54b4b', gear: 'mask' },
  },
  {
    id: 'bodyguard', name: 'Bodyguard', price: 250, icon: '🛡️', tagline: 'Protect what you love.',
    power: 'Free Shield every decision + theft immunity',
    detail: 'Once per decision, shield one option for free (immune to veto and sabotage). Always on: thieves can\'t steal from you.',
    ability: { kind: 'shield', uses: 'stage' },
    look: { body: '#59606b', accent: '#9fd3ff', gear: 'armor' },
  },
  {
    id: 'merchant', name: 'Merchant', price: 250, icon: '💰', tagline: 'Everything is negotiable.',
    power: 'Half price at the Black Market',
    detail: 'Always on: every Black Market power costs you half, and your coins count double when you fund a Black Market item at the end.',
    ability: { kind: 'halfPrice', uses: 'passive' },
    look: { body: '#7a4a26', accent: '#f0c060', gear: 'apron' },
  },
  {
    id: 'chaos', name: 'Chaos Agent', price: 300, icon: '🌀', tagline: 'Didn\'t like that? Again!',
    power: 'Force a re-spin of the wheel',
    detail: 'Once per game, right after the Region or Country result, force a brand-new spin with the same odds. Everyone sees it happen.',
    ability: { kind: 'respin', uses: 'game' },
    look: { body: '#4b2470', accent: '#ff4fd8', gear: 'bolt' },
  },
  {
    id: 'thief', name: 'Thief', price: 250, icon: '🦝', tagline: 'Finders keepers.',
    power: 'Steal 200 VC from a crewmate',
    detail: 'Once per game, during a decision, take 200 VC from any crewmate (or everything they have if less). Bodyguards are immune.',
    ability: { kind: 'steal', amount: 200, uses: 'game' },
    look: { body: '#2e2e3a', accent: '#c9ced9', gear: 'mask' },
  },
  {
    id: 'cupid', name: 'Cupid', price: 250, icon: '💘', tagline: 'Love decides.',
    power: 'Your couple\'s score counts double',
    detail: 'Always on: in the Pharaoh\'s final test, your couple\'s satisfaction score counts twice in the final average. Single? It\'s your own score that counts twice.',
    ability: { kind: 'cupid', uses: 'passive' },
    look: { body: '#ff8fb8', accent: '#ffffff', gear: 'sash' },
  },
];

export const roleById = (id) => ROLES.find((r) => r.id === id) || null;
