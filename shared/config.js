// All tunable numbers for a VW4 room. Overridable per room (host settings) without touching logic.

export const DEFAULT_CONFIG = {
  startingVC: 1000,
  maxPlayers: 8,

  // Seconds.
  timers: {
    launchCountdown: 10,   // auto-launch once everyone is aboard with a role
    launchCinematic: 31,   // boarding film (3 shots × 10 s) before the wishlist opens
    wishlist: 180,
    stageCinematic: 11,    // one 10 s shot before each roulette
    strategy: 300,         // talk, place chips, use powers, place a secret bet
    revealLeadIn: 1.5,     // lets every client receive the draw before the synchronized spin
    reveal: 13,
    results: 40,           // time to read results; Time Loop / Chaos re-spins happen here
    pharaoh: 51,           // transformation film (5 shots × 10 s)
    couples: 900,
    groups: 900,
    nominate: 240,
    finalStrategy: 120,    // last bets before the probability shot
    exitCinematic: 31,     // landing, Baby Mahmoud, Black Market (3 × 10 s)
  },

  weights: {
    base: 25,                // reference value of ONE chip (kept for old saves)
    baseTotal: 150,          // all options share this fixed base: 12 months → 12.5 each, 41 countries → 3.7 each (min 3)
    minBase: 3,
    familiarityPenalty: 0.3, // already-visited malus: country weight × (1 − 0.3 × share of crew who visited)
    wishWeight: 10,          // each crewmate's wish adds +10 weight (months: +10 × the share of your wishes that are comfy that month)
    boostWeight: 25,         // one chip = +25 weight (doubles an untouched option)
    pickWeight: 12,          // each of your (up to 3) free picks adds +12 — small on its own
    crowdWeight: 25,         // ON FIRE: an option picked by k crewmates gets +25 × (k − 1)² on top (2 → +25, 3 → +100, 4 → +225)
    unanimityMult: 2.5,      // JACKPOT: picked by EVERY crewmate → the option's whole weight × 2.5
    maxShare: 0.85,          // luck always keeps ≥ 15 %: no option can take more than 85 % of the wheel
    maxPicks: 3,             // on wheels with ≥ 7 options; 5–6 options → 2 picks; 3–4 options → 1 pick
  },

  boosts: { price: 50, perPlayer: 5, perOption: 15 },

  betting: { minStake: 10, maxStake: 400, margin: 0.1, minMultiplier: 1.02, maxMultiplier: 10 },

  // Pharaoh's final shot: chosen country gets maxLeader × (satisfaction / 10).
  final: { maxLeader: 0.9, wishFactor: 0.10, nominationsPerPlayer: 3 },

  wishlist: { min: 1, max: 5, maxBlocked: 4 },

  round: { month: 7 }, // 0 = January. Travel month used for temperatures.

  presence: { hostMigrationSec: 60 },
};

export function mergeConfig(base, patch) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') out[k] = mergeConfig(out[k], v);
    else out[k] = v;
  }
  return out;
}
