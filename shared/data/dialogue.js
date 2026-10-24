// Scripted, state-aware lines. {placeholders} are filled by the engine/client.
// Text never affects rules.

export const MAHMOUD_LINES = {
  welcome: [
    'Welcome to the Moon, {name}! First stop: your embassy. Then the Role Market. Then my spacecraft. Simple. Like me.',
    '{name} has landed! Visit your embassy, pick a role, board my ship. In that order. I am watching.',
  ],
  roleBought: [
    '{name} is now a {role}. Very fashionable. Very suspicious.',
    'A new {role} walks among us. {name}, I expect drama.',
  ],
  roleRookie: ['{name} chose Rookie and pocketed 400 extra coins. Cheap. Smart. Cheap.'],
  boarded: ['{name} is aboard. Seatbelts are decorative, by the way.', '{name} boarded. The ship smells of sunscreen and ambition.'],
  allAboard: ['Everyone is aboard! Launching in a few seconds… unless the host gets nervous.'],
  launch: ['Engines on! Before anything: each of you, whisper me up to five dream countries — and any months you simply cannot travel. Every wish gives that country, its region and its comfy months a push.'],
  wishDone: ['Wishes recorded. Your picks are pre-filled from them — change them if you like. Then talk, stack chips, bet!'],
  monthStart: ['THE SEASON SPIN! WHEN do we fly? Pick the same month as your friends and it catches FIRE. Everyone on it? JACKPOT.'],
  regionStart: ['REGION ROULETTE! Pick ★ for free, stack chips on what you want most, bet on what you think will win. When everyone is ready, the wheel spins.'],
  countryStart: ['{region} it is! Now the COUNTRY CLASH. This is where friendships end. Pick, stack, veto, sabotage, bet.'],
  boost: ['Chips on {option}! I saw nothing. NOTHING.', 'The stack on {option} grows… someone has been generous.', '{option} gets a push. Anonymous, of course.'],
  power: ['{name} used {power}! {detail}', 'Black Market activity: {name} → {power}. {detail}'],
  consensus: ['JACKPOT! EVERYONE picked {option}! Weight ×2.5 — the wheel is almost yours. Almost.'],
  lock: ['Bets are locked! The odds are frozen. Watch the wheel.'],
  reveal: ['The odds you saw are the odds I use. Mahmoud does not cheat. Mahmoud is merely dramatic.', 'Silence. The universe is spinning.'],
  winnerFavourite: ['{option}! The favourite delivers at {pct}.', 'It is {option}! Predictable? Yes. Beautiful? Also yes.'],
  winnerUnderdog: ['{option}!!! Only {pct}! The underdog bites!', 'WHAT?! {option} at {pct}! This is why we don\'t trust spreadsheets.'],
  winnerMiddle: ['{option} it is, at {pct}. Not a miracle, not a sure thing.'],
  respin: ['{name} broke the timeline! Same odds, new spin…'],
  stolen: ['{name} stole {amount} VC from {victim}! Lock your pockets.'],
  idle: [
    'Pick what your friends pick: two of you = ON FIRE, all of you = JACKPOT. The wheel spins with exactly the odds you see.',
    'Bets are secret and lock together. Payouts use the odds frozen when bets lock.',
    'Your role is your superpower. Use it. Mahmoud rewards chaos.',
  ],
};

export const PHARAOH_LINES = {
  reveal: [
    'MORTALS! You thought Mahmoud was a sweet man in a dolphin shirt? I am the PHARAOH OF DISCORD. For three thousand years I have waited… to ruin ONE group holiday.',
  ],
  test: 'One last test. Fail it and your vacation is cursed with delayed flights, lost luggage and an Airbnb with no Wi-Fi.',
  couples: 'LOVERS FIRST. Call each other on WhatsApp. Whisper. Argue. Then tell me, out of 10, how happy you really are with {country}.',
  groups: 'Now: girls with girls, boys with boys. Group calls on WhatsApp. Then each of you rates {country} out of 10. I can smell lies. And sunscreen.',
  berserk: 'AN AVERAGE OF {score}?! I AM BERSERK! Then {country} must FIGHT your wishlists. Every dream country you whispered at the start gets a slice of my final wheel.',
  berserkHappy: 'A {score}?! Disgusting. Such harmony. Still — {country} must face your wishlists one last time. My wheel. My rules.',
  final: 'THE PROBABILITY SHOT. {country} keeps {pct}. The rest of you fight over the crumbs. Let the wheel judge you.',
  verdict: 'It is decided. {country}. Now get out of my ship.',
};

export const BABY_LINES = [
  'Oof! Sorry legends, tiny legs. I\'m Baby Mahmoud!',
  'You survived the Pharaoh? Impressive. Come, come — the Black Market is open!',
  'Spend your coins on the real holiday: Airbnb powers, activities, never doing the dishes…',
  'You can send coins to each other and pool them on anything. The biggest prize? Restarting the whole game. It costs every coin you all own.',
];

/** Ambassador greeting, in the visitor's language. Polish and Moroccan players are greeted in French. */
export const AMBASSADOR = {
  pt: 'Bem-vindo(a) à Embaixada de Portugal, {name}! Explora à vontade — lá em cima fica o teu quarto. Depois da visita, vai ao Mercado de Papéis (Role Market) escolher o teu papel. A seguir, a nave do Mahmoud espera por ti.',
  mk: 'Добредојде во Амбасадата на Македонија, {name}! Разгледај слободно — горе е твојата соба. По посетата, оди на Пазарот на улоги (Role Market) и избери ја твојата улога. Потоа те чека бродот на Махмуд.',
  fr_pl: 'Bienvenue à l\'ambassade de Pologne, {name} ! Fais le tour — ta chambre est à l\'étage. Après la visite, file au Marché des rôles (Role Market) pour choisir ton rôle. Ensuite, direction le vaisseau de Mahmoud.',
  fr_ma: 'Bienvenue à l\'ambassade du Maroc, {name} ! Fais comme chez toi — ta chambre est à l\'étage. Après la visite, va au Marché des rôles (Role Market) choisir ton rôle. Ensuite, le vaisseau de Mahmoud t\'attend.',
  guest: 'Welcome, {name}! Friends of the crew are always welcome downstairs. The upstairs rooms are private.',
};

export function ambassadorText(embassyNation, visitorNation, name) {
  const own = embassyNation === visitorNation;
  let t;
  if (!own) t = AMBASSADOR.guest;
  else if (visitorNation === 'portugal') t = AMBASSADOR.pt;
  else if (visitorNation === 'macedonia') t = AMBASSADOR.mk;
  else if (visitorNation === 'poland') t = AMBASSADOR.fr_pl;
  else if (visitorNation === 'morocco') t = AMBASSADOR.fr_ma;
  else t = AMBASSADOR.guest;
  return t.replace('{name}', name);
}
