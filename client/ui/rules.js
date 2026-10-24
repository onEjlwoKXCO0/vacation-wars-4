// The rules, explained once, clearly. Used by Mahmoud's Control Centre and the help menu.
import { h } from './dom.js';

export const FLOW = [
  ['🏛️', 'Visit your embassy', 'Your ambassador greets you in your language. Upstairs is your private bedroom (you + your partner only).'],
  ['🎭', 'Choose your role', 'Role Market, east side. One role for the whole game — it is your superpower. Choose carefully: it is final.'],
  ['🚀', 'Board the spacecraft', 'Launch pad, south-east. When the whole crew is aboard, Mahmoud launches.'],
  ['💖', 'Wishlist', 'Secretly pick 1 to 5 dream countries. Each wish adds +10% weight to that country, and pushes its region too.'],
  ['📅', 'Season Spin', 'First the WHEN: a wheel of 12 months. Wished countries push the months when they are comfortable (18–29 °C). The winning month sets the weather shown everywhere after.'],
  ['🎰', 'Region Roulette', 'The wheel picks a region of the world (Europe, South-East Asia, Oceania, Middle East, Antarctica…).'],
  ['🎯', 'Country Clash', 'Inside the winning region, the wheel picks a country. This is where vetoes and sabotage fly.'],
  ['🏺', 'The Pharaoh\'s test', 'Mahmoud reveals himself. Couples call each other on WhatsApp and rate the country 1–10; then girls and boys do group calls and rate again.'],
  ['🎲', 'The Probability Shot', 'The chosen country keeps 90% × (satisfaction ÷ 10). Everything else is shared by the countries on everyone\'s wishlists (wished by more crewmates = bigger slice). One last spin.'],
  ['🕶️', 'Black Market', 'Back on the Moon, Baby Mahmoud takes you to the Black Market: spend coins on real holiday privileges, pool coins, or buy a full restart.'],
];

export const MECHANICS = [
  ['Vacation Coins (VC)', 'Everyone starts with 1,000 VC. Coins are fictional — never real money. Spend them on chips, bets, powers and, at the end, holiday privileges.'],
  ['The odds', 'All the options of a wheel share one small base (150 weight in total, so 12 months get 12.5 each and 27 countries 5.6 each — Antarctica is rarer). Wishes add +10. Already-visited malus: up to −30% if everyone has been there. Your chance = weight ÷ total, and luck always keeps at least 15%: no option can pass 85%. Labels: 🔥 HOT (clear favourite), ⚖️ IN THE MIX, 🎯 LONG SHOT, 🧊 COLD.'],
  ['Chips', '1 chip = 50 VC = +25 weight on an option. Up to 5 chips per player per decision, 15 per option. Chips are anonymous. Take a chip back before the spin and the coins come back.'],
  ['Picks ★ (free)', 'Up to 3 free picks per wheel (2 on wheels of 5–6 options, 1 on wheels of 3–4), pre-filled from your wishlist. One pick alone is small (+12). Same pick as friends → 🔥 ON FIRE: +25 for 2 pickers, +100 for 3, +225 for 4. Picked by EVERYONE → 🎰 JACKPOT: weight ×2.5. The crowd usually wins — never 100%.'],
  ['Secret bet', 'Bet 10–400 VC on the option you think will win: WIN = stake × multiplier, BUST = stake lost. Long shots pay more (×1.02 to ×10). The multiplier is fixed when the wheel locks. Nobody sees your bet until the result.'],
  ['Ready', 'The wheel spins when everyone presses Ready, or when the timer ends. The server draws one random number between 0 and 1 and publishes it.'],
  ['Role powers', 'Real powers, no small percentages: veto an option, wipe chips, double chips, see every bet, steal 200 VC, force a re-spin, double your bet wins…'],
  ['Black Market powers', 'From the terminal on the spacecraft, during a decision: Veto, Shield, Sabotage, Golden Ticket (+3 chips), Spyglass, Double Down, Insurance, Time Loop. Bought = used immediately.'],
  ['Impossible months', 'During the wishlist, block up to 4 months you cannot travel. They quietly leave the Season wheel; nobody sees who blocked them.'],
  ['Final shot', 'No chips, picks or powers in the Pharaoh\'s final shot — only a last bet. Satisfaction 10/10 → the chosen country keeps 90%. 5/10 → only 45%.'],
];

export function rulesBlock({ compact = false } = {}) {
  return h('div', { class: 'stack rules' },
    h('h3', {}, 'How a game goes'),
    h('ol', { class: 'flow-list' }, FLOW.map(([icon, title, text]) => h('li', {}, h('span', { class: 'fi' }, icon), h('div', {}, h('b', {}, title), compact ? null : h('div', { class: 'small muted' }, text))))),
    h('h3', {}, 'The mechanics'),
    h('dl', { class: 'kv rules-kv' }, MECHANICS.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
    h('div', { class: 'privacy' }, 'When to spend? Roles are bought once, before launch. Picks, chips, bets and Black Market powers are used DURING the Season, Region and Country decisions, from the spacecraft. The Black Market building on the Moon only opens at the very end, for holiday privileges and the restart.'),
  );
}
