// Black Market powers, bought DURING a decision from the terminal on the spacecraft.
// Buying a power uses it immediately — no hand to manage.
//   target: 'option' | 'player' | 'self'
//   window: 'strategy' (while the decision is open) | 'results' (right after a draw)

export const POWERS = [
  { id: 'veto', name: 'Veto', icon: '🚫', price: 220, target: 'option', window: 'strategy', color: '#ff5a6e',
    text: 'Remove one option from the wheel. Blocked by a Shield. At least two options always stay.' },
  { id: 'shield', name: 'Shield', icon: '🛡️', price: 120, target: 'option', window: 'strategy', color: '#48e08f',
    text: 'Protect one option from Veto and Sabotage for this decision.' },
  { id: 'sabotage', name: 'Sabotage', icon: '💣', price: 150, target: 'option', window: 'strategy', color: '#ff7a5c',
    text: 'Destroy every chip on one option. Blocked by a Shield.' },
  { id: 'golden_ticket', name: 'Golden Ticket', icon: '🎟️', price: 200, target: 'option', window: 'strategy', color: '#f0c35a',
    text: '+3 free chips on one option, on top of your normal chip limit.' },
  { id: 'spyglass', name: 'Spyglass', icon: '🔭', price: 80, target: 'self', window: 'strategy', color: '#5ff2ff',
    text: 'See every crewmate\'s bet for this decision.' },
  { id: 'double_down', name: 'Double Down', icon: '✖️2', price: 120, target: 'self', window: 'strategy', color: '#c77dff',
    text: 'If your bet wins this decision, it pays double. (Bookmakers already have this.)' },
  { id: 'insurance', name: 'Insurance', icon: '☂️', price: 80, target: 'self', window: 'strategy', color: '#9fd3ff',
    text: 'If your bet loses this decision, you get your stake back.' },
  { id: 'time_loop', name: 'Time Loop', icon: '⏳', price: 350, target: 'self', window: 'results', color: '#ff4fd8',
    text: 'Right after the result: force a new spin with the same odds. Only one re-spin per decision.' },
];

export const powerById = (id) => POWERS.find((p) => p.id === id) || null;
