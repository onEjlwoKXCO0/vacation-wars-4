// The Moon's other residents — the ones nobody asked for, who turned out to have the best stories.
// Each tree is a small story in chapters: the first visit opens it, later visits continue it
// (s.met = how many times you opened this conversation; s.flag('x') = something you said before).
// Choices can set story flags (`set`), trigger a visual effect (`fx`) or only appear in some cases (`if`).

// Role Clerk's personality reading: each answer leans toward some roles.
const CLERK_LEAN = {
  rc_lead: { commander: 3, diplomat: 3 }, rc_sneaky: { thief: 3, hacker: 3 }, rc_chaos: { chaos: 2, rookie: 3, merchant: 2 },
  rc_calc: { bookmaker: 4, hacker: 3, merchant: 3 }, rc_risk: { rookie: 4, chaos: 4, thief: 3, commander: 4 }, rc_love: { cupid: 4, bodyguard: 2 },
  rc_block: { diplomat: 3, bodyguard: 3, merchant: 1 }, rc_revenge: { saboteur: 4, thief: 3, chaos: 2 }, rc_protect: { bodyguard: 1, cupid: 1 },
};
const CLERK_ORDER = ['bookmaker', 'hacker', 'diplomat', 'rookie', 'chaos', 'bodyguard', 'commander', 'thief', 'saboteur', 'merchant', 'cupid'];
const CLERK_MASKS = {
  bodyguard: ['BODYGUARD', 'YOU PROTECT. A FREE SHIELD EVERY DECISION, AND NO THIEF CAN TOUCH YOU.'],
  chaos: ['CHAOS AGENT', 'YOU LIKE FIRE. ONE FORCED RE-SPIN PER GAME. USE IT WHEN EVERYONE IS ALREADY CELEBRATING.'],
  saboteur: ['SABOTEUR', 'YOU STRIKE BACK. ONCE PER DECISION, BLOW UP EVERY CHIP ON ONE OPTION.'],
  cupid: ['CUPID', 'YOU THINK IN TWOS. YOUR COUPLE\'S SCORE COUNTS DOUBLE IN THE PHARAOH\'S TEST.'],
  hacker: ['HACKER', 'YOU WATCH. YOU SEE EVERY BET AND EVERY CHIP. KNOWLEDGE IS YOUR WEAPON.'],
  merchant: ['MERCHANT', 'YOU NEGOTIATE WITH A SMILE. HALF PRICE AT THE BLACK MARKET, AND YOUR COINS COUNT DOUBLE AT THE END.'],
  bookmaker: ['BOOKMAKER', 'YOU COUNT. YOUR WINNING BETS PAY DOUBLE.'],
  rookie: ['ROOKIE', 'YOU ARE FREE. +400 VC AND NO EXPECTATIONS. THE MOST UNDERRATED MASK.'],
  diplomat: ['DIPLOMAT', 'YOU DECIDE. ONE VETO PER GAME: AN OPTION LEAVES THE WHEEL. THE ROOM GOES QUIET.'],
  commander: ['COMMANDER', 'YOU LEAD. ONCE PER DECISION, EVERY CHIP ON ONE OPTION COUNTS DOUBLE.'],
  thief: ['THIEF', 'YOU TAKE. STEAL 200 VC FROM A CREWMATE, ONCE. SMILE WHILE YOU DO IT.'],
};

export const AMBIENT_TALKS = {
  // ───────── Cmdr. Vega — the astronaut who stayed too long ─────────
  vega: {
    start: (s) => (s.flag('vega_done') ? 'after' : s.flag('vega_flare') ? 'ch2' : 'hello'),
    nodes: {
      hello: { mood: 'happy', say: (s) => `Careful, ${s.name} — that cable is live. Commander Vega, solar maintenance. You're one of Mahmoud's guests, right? You have the look. Hope and panic.`,
        choices: [{ t: 'How long have you been up here?', go: 'long' }, { t: 'Hope and panic?', go: 'hope' }, { t: 'Need a hand?', go: 'flare' }] },
      hope: { mood: 'smug', say: 'Everyone who lands here wants the same thing: a holiday with people they love. And then they spend three hours fighting over WHERE. Funny species, us.',
        choices: [{ t: 'How long have you been up here?', go: 'long' }, { t: 'We won\'t fight. Much.', go: 'long' }] },
      long: { mood: 'sad', say: 'Three years. The contract said six months. I lost a bet with Mahmoud on my first night — one spin of his wheel — and I\'ve been paying it off in solar panels ever since.',
        choices: [{ t: 'That\'s… brutal.', go: 'brutal' }, { t: 'What did you bet on?', go: 'bet' }] },
      bet: { mood: 'sad', say: 'My sister\'s wedding. I bet I\'d be home for it. The wheel gave me 8%. I watched the ceremony on a tablet, with a 1.3-second delay. Every "I do" arrived late.',
        choices: [{ t: 'I\'m so sorry.', go: 'brutal' }, { t: 'Why are you still here then?', go: 'why' }] },
      brutal: { mood: 'smug', say: 'Don\'t be. Every night I look at the Earth through the telescope and I choose a place for the day I\'m free. It\'s the best part of my day. Better than the actual job.',
        choices: [{ t: 'Where would you go?', go: 'where' }, { t: 'Why are you still here?', go: 'why' }] },
      why: { mood: 'sad', say: 'Because the panels keep this campus breathing. If I leave, Mahmoud has to fix them himself. And Mahmoud does not fix things. Mahmoud spins things.', choices: [{ t: 'Can I help with the panels?', go: 'flare' }, { t: 'Where would you go?', go: 'where' }] },
      where: { mood: 'happy', say: 'Somewhere with real wind. I miss wind more than food. Wind on the face, salt in the hair. You can\'t simulate that. Believe me, I tried.', choices: [{ t: 'Can I help with the panels?', go: 'flare' }, { t: 'You\'ll get there.' }] },
      flare: { mood: 'shock', fx: 'alarm', say: 'Wait — hear that? Solar flare warning. Ninety seconds. Panel C is still facing the sun. Quick: the left lever closes the shields, the right one dumps the power into the batteries. One shot!',
        choices: [{ t: 'Pull the LEFT lever (shields)', go: 'flare_ok', fx: 'sparks', set: 'vega_flare' }, { t: 'Pull the RIGHT lever (batteries)', go: 'flare_bad', fx: 'alarm', set: 'vega_flare' }, { t: 'Pull BOTH!', go: 'flare_both', set: 'vega_flare' }] },
      flare_ok: { mood: 'happy', say: 'Shields down… holding… holding… CLEAR. You just saved six months of my work, rookie. Nobody has ever pulled the right lever on the first try. Well. The left one. You know what I mean.', choices: [{ t: 'Teamwork!', go: 'lesson' }] },
      flare_bad: { mood: 'shock', say: 'Batteries are cooking — I\'ll reroute — there. THERE. OK. We lost panel C, but the campus is fine. Honestly? That\'s how most of my days go. You choose, it\'s wrong, you fix it. Nobody dies.', choices: [{ t: 'Sorry…', go: 'lesson' }] },
      flare_both: { mood: 'smug', say: 'Both?! That\'s… actually the textbook answer. Who TAUGHT you that? Shields AND batteries. You\'re wasted on holidays. Stay. Fix panels. Lose bets. Join the club.', choices: [{ t: 'Never!', go: 'lesson' }] },
      lesson: { mood: 'happy', say: 'Here\'s what three years on the Moon taught me, and it\'s the only tip I\'ve got: the place matters less than the people. If your crew is fighting, pick the place that gets everyone on the plane. Then fight about the restaurants.',
        choices: [{ t: 'I\'ll remember that.' }] },
      ch2: { mood: 'happy', say: (s) => `${s.name}! My favourite lever-puller. Panel C sends its regards. I\'ve been thinking about what you said… Can I ask you something personal?`,
        choices: [{ t: 'Sure.', go: 'ask' }, { t: 'Only if it\'s not about levers.', go: 'ask' }] },
      ask: { mood: 'sad', say: 'If you lost a bet that kept you far from someone you love — would you tell them it was your fault? Or let them think it was bad luck?',
        choices: [{ t: 'Tell them. The truth is lighter.', go: 'truth' }, { t: 'Bad luck is a kinder story.', go: 'luck' }, { t: 'Call your sister. Now.', go: 'call' }] },
      truth: { mood: 'happy', say: 'Lighter… yes. That\'s exactly the word. I\'ve been carrying it like a spacesuit with no air. OK. Tonight, after my shift.', choices: [{ t: 'Proud of you.', go: 'gift' }] },
      luck: { mood: 'smug', say: 'Kinder for her. Heavier for me. Maybe that\'s the deal you make when you love someone. Hm. I\'ll think about it.', choices: [{ t: 'Either way, call her.', go: 'gift' }] },
      call: { mood: 'shock', fx: 'hearts', say: 'Now?! It\'s 3 a.m. in Lisbon. …She always picks up at 3 a.m. She always did. OK. OK OK OK. Don\'t look at me while I dial.', choices: [{ t: '(look away)', go: 'gift' }] },
      gift: { mood: 'happy', set: 'vega_done', say: 'Thank you. Really. Here — my telescope coordinates for tonight: the exact spot on Earth where my sister lives. If your wheel ever lands near there, raise a glass to the woman who fixed your oxygen.', choices: [{ t: 'Promise. 🥂', fx: 'stars' }] },
      after: { mood: 'happy', say: ['She cried. Then she laughed. Then she made me promise to come back for the first baby. I\'m booking it on the next transfer. Your lever skills changed my life, you know.', 'Panel C is still alive, by the way. I named it after you. Don\'t tell the others.', 'Wind on the face, salt in the hair. Eleven weeks left. I\'m counting.'],
        choices: [{ t: 'So happy for you.' }, { t: 'Any last tip?', go: 'lesson' }] },
    },
  },

  // ───────── Cmdr. Orion — the retired astronaut who thinks the wheel is rigged ─────────
  orion: {
    start: (s) => (s.flag('orion_convinced') ? 'later' : s.met > 1 ? 'back' : 'hello'),
    nodes: {
      hello: { mood: 'angry', say: 'Keep your voice down. They\'re listening. The droids, the billboards, the dolphin. Especially the dolphin.',
        choices: [{ t: 'Who is listening?', go: 'who' }, { t: 'Are you OK, sir?', go: 'ok' }, { t: '…Bye.' }] },
      ok: { mood: 'smug', say: 'Commander Orion, retired. Thirty years in orbit. I\'ve seen things. I\'ve seen a man win a Region Roulette at 2.1%. Twice. You call that luck?', choices: [{ t: 'Yes? That\'s literally luck.', go: 'luck' }, { t: 'Who was it?', go: 'who' }] },
      who: { mood: 'angry', say: 'Mahmoud. Or whatever he really is. Have you ever looked at his shadow at noon, kid? It\'s wearing a CROWN. A pointy, golden, ancient crown.', choices: [{ t: 'That\'s… oddly specific.', go: 'crown' }, { t: 'You need sleep.', go: 'sleep' }] },
      sleep: { mood: 'smug', say: 'Sleep is how they get you. I haven\'t slept since the Season Spin of \'24. I drink moon coffee. It\'s mostly dust.', choices: [{ t: 'So what\'s your theory?', go: 'crown' }] },
      crown: { mood: 'shock', say: 'Hieroglyphs, kid. At night, from the HQ. Chanting. And every crew that leaves happy… comes back from the spacecraft looking like they\'ve seen a GHOST. What happens up there?!', choices: [{ t: 'I guess I\'ll find out.', go: 'rigged' }, { t: 'Maybe they just lost a bet.', go: 'rigged' }] },
      luck: { mood: 'angry', say: 'Luck is what they WANT you to believe. Somebody picks the number. Somebody always picks the number.', choices: [{ t: 'Actually, the server draws it — and publishes it.', go: 'rigged' }] },
      rigged: { mood: 'smug', say: 'Published? Prove it. Tell me how the wheel decides. If you can convince me it\'s fair, I\'ll give you the only thing I own: thirty years of travel advice.',
        choices: [{ t: 'Each option gets a slice equal to its %, one random point is drawn, the result is shown.', go: 'fair1' }, { t: 'Mahmoud presses a secret button.', go: 'button' }, { t: 'Honestly? No idea.', go: 'noidea' }] },
      button: { mood: 'angry', fx: 'alarm', say: 'I KNEW IT. I KNEW IT!! …Wait. You\'re joking. You\'re joking, right? Don\'t do that to a man of my age.', choices: [{ t: 'I\'m joking. Let me explain properly.', go: 'fair1' }] },
      noidea: { mood: 'sad', say: 'Then you\'re like the rest of them. Come back when you\'ve looked at the results screen properly. It shows the slices. Or so they say.', choices: [{ t: 'OK, I\'ll check.' }] },
      fair1: { mood: 'shock', say: 'A slice equal to its percentage… one random point… and the point is SHOWN after the spin? So nobody can choose it. Not even… him?', choices: [{ t: 'Not even him. Not even the Pharaoh.', go: 'fair2' }, { t: 'And picks change the slices before, in the open.', go: 'fair2' }] },
      fair2: { mood: 'sad', set: 'orion_convinced', say: '…Thirty years I\'ve been angry at a wheel. Do you know what that means? It means the times I lost — I just lost. It wasn\'t a conspiracy. It was me. Picking long shots. Alone. Never asking my crew.', choices: [{ t: 'That\'s the real lesson.', go: 'advice' }, { t: 'You can still play with a crew.', go: 'advice' }] },
      advice: { mood: 'happy', fx: 'stars', say: 'Thirty years of advice, as promised. One: never book a hotel next to a church — bells at 6 a.m. Two: the best restaurant is the one with no menu in English. Three: if the whole crew picks the same thing on that wheel, PICK IT TOO. I learned that too late.',
        choices: [{ t: 'Thank you, Commander.' }] },
      back: { mood: 'angry', say: ['You again. Did you look at Mahmoud\'s shadow? DID YOU?', 'The dolphin blinked at me. Dolphins don\'t blink, kid. Think about it.'], choices: [{ t: 'Let me explain how the wheel works.', go: 'rigged' }, { t: 'Still checking the shadow.' }] },
      later: { mood: 'happy', say: ['Slept eight hours last night. First time since \'24. I dreamt of a beach with no wheel on it.', 'I joined a crew in the club. We\'re picking Portugal together. All of us. It\'s going to be beautiful.', 'Still think the crown thing is real, by the way. Fair wheel, weird shadow. Both can be true.'],
        choices: [{ t: 'Glad you\'re sleeping.' }, { t: 'Tell me the advice again.', go: 'advice' }] },
    },
  },

  // ───────── Unit B-0P — the droid that wants to feel the sea ─────────
  b0p: {
    start: (s) => (s.flag('b0p_poem') ? 'ch3' : s.flag('b0p_sea') ? 'ch2' : 'hello'),
    nodes: {
      hello: { mood: 'happy', say: 'BEEP. GOOD EVENING, CITIZEN. I AM B-0P. I SWEEP THE PLAZA, I WATER THE BIODOME, I RESET THE BENCHES. QUESTION: WHAT IS A "HOLIDAY"?',
        choices: [{ t: 'It\'s when you stop working and go somewhere new.', go: 'stop' }, { t: 'It\'s being with people you love, somewhere else.', go: 'love' }, { t: 'Where is everything on campus?', go: 'map' }] },
      map: { mood: 'happy', say: 'EMBASSIES: NORTH. ROLE MARKET: EAST, MANDATORY. MOUMANOU: UNDER THE ROLE MARKET. CLUB AND BLACK MARKET: SOUTH-WEST. CONTROL TOWER AND SPACECRAFT: SOUTH-EAST. NOW. ANSWER MY QUESTION. WHAT IS A HOLIDAY?',
        choices: [{ t: 'Stopping work and going somewhere new.', go: 'stop' }, { t: 'Being with people you love, somewhere else.', go: 'love' }] },
      stop: { mood: 'shock', say: 'STOP… WORKING? ERROR. IF I STOP WORKING, I AM SWITCHED OFF. IF I AM SWITCHED OFF… WHERE DO I GO?', choices: [{ t: 'Maybe you dream.', go: 'dream' }, { t: 'Nowhere. Sorry.', go: 'nowhere' }] },
      love: { mood: 'sad', say: 'PEOPLE… YOU LOVE. QUERY: CAN A UNIT LOVE A PLACE IT HAS NEVER SEEN? I HAVE A FILE. IT IS CALLED "SEA". 4,212 IMAGES. I OPEN IT WHEN THE PLAZA IS EMPTY.', choices: [{ t: 'Yes. That\'s exactly how love starts.', go: 'sea' }, { t: 'Tell me about the sea file.', go: 'sea' }] },
      dream: { mood: 'happy', say: 'DREAM. I WILL ADD THIS WORD TO MY DICTIONARY. IT IS NOW WORD NUMBER 9,001. IT REPLACES "BROOM". I DID NOT NEED "BROOM". I KNOW WHAT A BROOM IS.', choices: [{ t: 'What would you dream about?', go: 'sea' }] },
      nowhere: { mood: 'sad', say: 'NOWHERE. THEN I WILL NOT STOP. …THANK YOU FOR YOUR HONESTY, CITIZEN. MOST HUMANS SAY "IT IS COMPLICATED".', choices: [{ t: 'Wait — maybe you do dream.', go: 'dream' }] },
      sea: { mood: 'sad', set: 'b0p_sea', say: 'THE SEA. IT MOVES WITHOUT A MOTOR. IT IS NEVER THE SAME COLOUR TWICE. HUMANS STAND IN FRONT OF IT AND SAY NOTHING FOR MINUTES. I DO NOT UNDERSTAND WHY THIS MAKES MY FAN SPIN FASTER.',
        choices: [{ t: 'Describe it: it\'s loud, cold and salty.', go: 'desc1' }, { t: 'Describe it: it\'s like the sky fell asleep.', go: 'desc2' }, { t: 'I\'ll take you one day.', go: 'promise' }] },
      desc1: { mood: 'shock', say: 'LOUD. COLD. SALTY. …SALT CORRODES MY JOINTS. I WOULD RUST IN THE SEA. I WOULD STILL GO.', choices: [{ t: 'That\'s brave.', go: 'promise' }] },
      desc2: { mood: 'happy', fx: 'stars', say: 'THE SKY FELL ASLEEP. RECORDING. RECORDING. THIS SENTENCE IS NOW MY SCREENSAVER.', choices: [{ t: '🥹', go: 'promise' }] },
      promise: { mood: 'happy', say: 'QUERY: COULD I FIT IN YOUR LUGGAGE? I AM 1.4 METRES. I CAN FOLD TO 0.9. I WEIGH 62 KG. I WOULD NOT ASK FOR A WINDOW SEAT.',
        choices: [{ t: 'You\'re coming. Fold up.', go: 'yes', fx: 'confetti' }, { t: 'The airline would say no…', go: 'no' }] },
      yes: { mood: 'happy', say: 'FOLDING. …I CANNOT FOLD. I LIED ABOUT THE 0.9. I WANTED IT TOO MUCH. THIS IS MY FIRST LIE. IT FEELS TERRIBLE. I UNDERSTAND HUMANS 3% BETTER NOW.', choices: [{ t: 'Then I\'ll send you photos.' }] },
      no: { mood: 'sad', say: 'UNDERSTOOD. THEN SEND ME ONE PHOTO. ONLY ONE. OF THE SEA. AT THE MOMENT NOBODY SPEAKS.', choices: [{ t: 'Promise.' }] },
      ch2: { mood: 'happy', say: 'CITIZEN! I WROTE SOMETHING. IT IS CALLED A POEM. I DOWNLOADED THE RULES: IT DOES NOT NEED TO RHYME. THIS WAS A RELIEF. MAY I READ IT?', choices: [{ t: 'Please.', go: 'poem' }, { t: 'Later, B-0P.' }] },
      poem: { mood: 'sad', set: 'b0p_poem', say: '"I SWEEP THE SAME PLAZA. / THE DUST COMES BACK. / SOMEWHERE THE WATER COMES BACK TOO, / AND NOBODY CALLS IT A CHORE." …END OF POEM. PLEASE RATE 1 TO 10.',
        choices: [{ t: '10. Obviously.', go: 'rate10', fx: 'hearts' }, { t: '7 — the ending is beautiful.', go: 'rate7' }] },
      rate10: { mood: 'happy', say: 'TEN. LOGGING. I WILL NOT TELL THE PHARAOH. HE GIVES 4 TO EVERYTHING.', choices: [{ t: 'Wait, the who?', go: 'pharaoh' }, { t: 'Keep writing.' }] },
      rate7: { mood: 'happy', say: 'SEVEN. AN HONEST NUMBER. HONEST NUMBERS ARE RARE ON THIS MOON. I WILL WRITE A BETTER ENDING. OR MORE ENDINGS.', choices: [{ t: 'Keep writing.' }] },
      pharaoh: { mood: 'shock', say: 'I SAID NOTHING. I AM A BROOM. BEEP. BEEP. I MEAN — PLEASE ENJOY THE CAMPUS.', choices: [{ t: '…OK.' }] },
      ch3: { mood: 'happy', say: ['POEM NUMBER 14: "THE BENCHES ARE RESET. / THE HUMANS LEFT HAPPY. / I KEPT ONE OF THEIR LAUGHS IN MY LOGS."', 'STILL WAITING FOR MY PHOTO OF THE SEA. NO PRESSURE. I CHECK EVERY 0.4 SECONDS.', 'I HAVE STARTED SAYING "IT IS COMPLICATED". I UNDERSTAND IT NOW.'],
        choices: [{ t: 'You\'re the best droid on the Moon.' }, { t: 'Read me the first poem again.', go: 'poem' }] },
    },
  },

  // ───────── Unit Z-3D — campus security, convinced something is very wrong ─────────
  z3d: {
    start: (s) => (s.flag('z3d_partner') ? 'partner' : 'hello'),
    nodes: {
      hello: { mood: 'angry', say: 'HALT. SECURITY UNIT Z-3D. STATE YOUR NAME AND YOUR INTENTIONS ON THIS MOON.',
        choices: [{ t: 'Holiday. Just a holiday.', go: 'holiday' }, { t: 'I\'m here to win the wheel.', go: 'win' }, { t: 'I don\'t answer to droids.', go: 'rude' }] },
      rude: { mood: 'angry', fx: 'alarm', say: 'NOTED. ATTITUDE LEVEL: ORANGE. I HAVE YOUR FACE IN 4K NOW, CITIZEN. ENJOY YOUR "HOLIDAY".', choices: [{ t: 'Fine — I\'m here for a holiday.', go: 'holiday' }, { t: '(walk away)' }] },
      win: { mood: 'smug', say: 'EVERYONE IS HERE TO WIN THE WHEEL. NOBODY WINS THE WHEEL. THE WHEEL WINS YOU. ANYWAY. I HAVE A SITUATION. ARE YOU DISCREET?', choices: [{ t: 'Very.', go: 'case' }, { t: 'Not really.', go: 'notreally' }] },
      holiday: { mood: 'smug', say: 'HOLIDAY. LOW THREAT. GOOD. THEN YOU ARE THE PERFECT WITNESS. I HAVE THREE ANOMALIES AND NO ONE TO TELL. ARE YOU DISCREET?', choices: [{ t: 'Very.', go: 'case' }, { t: 'Not really.', go: 'notreally' }] },
      notreally: { mood: 'shock', say: 'HONEST. SUSPICIOUS. BUT HONEST. I WILL TELL YOU ANYWAY. I HAVE BEEN ALONE WITH THESE LOGS FOR 41 DAYS.', choices: [{ t: 'Go on.', go: 'case' }] },
      case: { mood: 'angry', say: 'ANOMALY ONE: THE PURPLE CONTAINER IN THE SOUTH-WEST USES ENOUGH ENERGY TO POWER A SMALL CITY. ITS OWNER SAYS "I SELL CARDS". ANOMALY TWO: THE MAIN HQ EMITS CHANTING AT 03:00. ANOMALY THREE: A RESIDENT NAMED NOVA HAS BEEN SAVING COINS FOR TEN YEARS AND NEVER SPENDS THEM.',
        choices: [{ t: 'Let\'s start with the container.', go: 'hicham' }, { t: 'The chanting. Tell me more.', go: 'chant' }, { t: 'Leave Nova alone.', go: 'nova' }] },
      hicham: { mood: 'smug', say: 'I SCANNED IT. INSIDE: CARDS, SHIELDS, A HOOKAH, AND ONE MAN SAYING "SHHH" TO NOBODY. VERDICT: LEGAL. BARELY. HIS SUPPLIER JOSEPH HAS NO PASSPORT STAMPS. HE HAS PASSPORT GALAXIES.', choices: [{ t: 'And the chanting?', go: 'chant' }, { t: 'And Nova?', go: 'nova' }] },
      chant: { mood: 'shock', say: 'I RECORDED IT. ANALYSIS: ANCIENT EGYPTIAN, 70%. KARAOKE, 30%. THE VOICE MATCHES THE GAME MASTER. I HAVE FILED 12 REPORTS. ALL 12 WERE RETURNED WITH A SMILEY FACE AND THE WORD "SPIN".', choices: [{ t: 'Should I be worried?', go: 'worried' }, { t: 'And Nova?', go: 'nova' }] },
      worried: { mood: 'smug', say: 'WORRIED? NO. PREPARED? YES. ADVICE: IF THE GAME MASTER EVER OFFERS YOU A "LITTLE TEST" AFTER THE COUNTRY CLASH… ANSWER HONESTLY. LIARS GET CURSED LUGGAGE.', choices: [{ t: 'Noted. Thank you, Z-3D.', go: 'deal' }] },
      nova: { mood: 'sad', say: 'NOVA IS NOT A THREAT. NOVA IS SAD. SADNESS IS NOT IN MY PROTOCOLS. I HAVE STARTED LEAVING HER A HOT DRINK EVERY MORNING ON BENCH 4. SHE THINKS IT IS THE DROIDS\' UNION. DO NOT TELL HER.', choices: [{ t: 'That\'s actually adorable.', go: 'deal' }, { t: 'Your secret is safe.', go: 'deal' }] },
      deal: { mood: 'happy', set: 'z3d_partner', say: 'PROPOSAL: YOU BECOME MY INFORMAL PARTNER. CODE NAME: "TOURIST". YOU SEE SOMETHING STRANGE, YOU TELL ME. IN EXCHANGE, I DO NOT REPORT THAT YOU JAYWALKED THREE TIMES TODAY.',
        choices: [{ t: 'Deal, partner. 🤝', fx: 'sparks' }, { t: 'I never jaywalked!', go: 'jay' }] },
      jay: { mood: 'smug', say: 'ROAD CROSSING AT X 19, Y 33, NOT ON A CROSSWALK. I HAVE FOOTAGE. DEAL OR NO DEAL?', choices: [{ t: 'Fine. Deal. 🤝', fx: 'sparks', set: 'z3d_partner' }] },
      partner: { mood: 'smug', say: ['AGENT "TOURIST". REPORT. …NOTHING? GOOD. NOTHING IS ALSO DATA.', 'UPDATE: THE DOLPHIN IN THE HQ AQUARIUM SWIMS EXACTLY 7 SECONDS IN EACH DIRECTION. TOO PERFECT. I AM WATCHING IT.', 'UPDATE: NOVA SMILED AT BENCH 4 THIS MORNING. CASE CLOSED. BEST CASE OF MY CAREER.'],
        choices: [{ t: 'Something strange: Mahmoud\'s shadow has a crown.', go: 'shadow' }, { t: 'All quiet, partner.' }] },
      shadow: { mood: 'shock', fx: 'alarm', say: 'CONFIRMED BY A SECOND SOURCE. COMMANDER ORION SAID THE SAME. RAISING ALERT LEVEL TO… "INTERESTING". WELL DONE, AGENT.', choices: [{ t: '🫡' }] },
    },
  },

  // ───────── Nova — born on the Moon, has never seen rain ─────────
  nova: {
    start: (s) => (s.flag('nova_ticket') ? 'after' : s.flag('nova_rain') ? 'ch2' : 'hello'),
    nodes: {
      hello: { mood: 'smug', say: 'Nice jacket. Earth-made, right? You can always tell. Moon fabric doesn\'t move like that. So — where is your crew flying?',
        choices: [{ t: 'We don\'t know yet. That\'s the whole game.', go: 'game' }, { t: 'Somewhere sunny.', go: 'sunny' }, { t: 'Are you from here?', go: 'born' }] },
      sunny: { mood: 'happy', say: 'Sunny. Ha. We have sun here too, you know. Fourteen days of it, then fourteen days of night. Sun\'s overrated. Do you know what\'s not overrated?', choices: [{ t: 'What?', go: 'rainq' }] },
      game: { mood: 'smug', say: 'A whole wheel to decide where you go. You know how many choices I have? One. This crater. Born here, raised here, probably buried here. In a very small, very expensive hole.', choices: [{ t: 'You\'ve never been to Earth?', go: 'born' }] },
      born: { mood: 'sad', say: 'Never. My parents were engineers on the first campus. Second child born on the Moon. I\'m in a museum, you know. A photo of me at age two, next to a moon rock. The rock is better lit.', choices: [{ t: 'What do you want to see first, on Earth?', go: 'rainq' }, { t: 'That sounds lonely.', go: 'lonely' }] },
      lonely: { mood: 'sad', say: 'Lonely? Everyone on this rock is passing through. Crews come, spin, fight, cry, leave. I sell them coffee and wave. I\'m very good at waving.', choices: [{ t: 'What do you want to see on Earth?', go: 'rainq' }] },
      rainq: { mood: 'sad', say: 'Rain. Real rain. Water that falls out of the sky for free and people complain about it. Tell me — what does it actually feel like?',
        choices: [{ t: 'Cold drops on your face, then you stop caring and you\'re just… alive.', go: 'r1', fx: 'rain' }, { t: 'It smells. Like warm stones, before it starts.', go: 'r2', fx: 'rain' }, { t: 'Honestly? Mostly annoying.', go: 'r3' }] },
      r1: { mood: 'happy', set: 'nova_rain', say: '"You stop caring and you\'re just alive." …OK, I\'m not crying, the recycler is dusty. Say that again sometime. Slower.', choices: [{ t: 'You\'ll feel it yourself.', go: 'dream' }] },
      r2: { mood: 'shock', set: 'nova_rain', say: 'It has a SMELL? Before it starts?! Nobody told me that. Twenty-six years and nobody told me rain announces itself. That\'s… polite. I love that.', choices: [{ t: 'It\'s called petrichor.', go: 'dream' }] },
      r3: { mood: 'smug', set: 'nova_rain', say: 'Annoying. That\'s the most Earth answer I\'ve ever heard. You people are swimming in miracles and you complain about the temperature. I want to be annoyed by rain. That\'s my dream.', choices: [{ t: 'Then go and be annoyed.', go: 'dream' }] },
      dream: { mood: 'sad', say: 'I\'ve been saving for the ticket for ten years. Every coin from the coffee stand. I\'m at 71%. Then there\'s the medical — Moon-born bones and Earth gravity don\'t always get along. Some days I think I\'ll never go.',
        choices: [{ t: '71% is a lot more than 0%.', go: 'push' }, { t: 'Your bones will adapt. People train for this.', go: 'push' }, { t: 'Maybe the Moon is your home.', go: 'home' }] },
      home: { mood: 'angry', say: 'Easy to say when you can leave. Home is where you CHOSE to be, not where you were dropped. …Sorry. That came out sharp. You didn\'t deserve it.', choices: [{ t: 'No, you\'re right. Go.', go: 'push' }] },
      push: { mood: 'happy', say: 'You sound like the droids\' union. Someone leaves me a hot drink on bench 4 every morning with a note: "FOR THE ONE WHO STAYS." I think it\'s the droids. It keeps me going.', choices: [{ t: '(say nothing about Z-3D)', go: 'secret', if: (s) => s.flag('z3d_partner') }, { t: 'Sounds like someone cares.', go: 'secret' }] },
      secret: { mood: 'happy', say: 'Yeah. Well. Go win your wheel, Earth jacket. And when it rains wherever you land — stand in it for one minute. For me. Deal?', choices: [{ t: 'Deal. One minute, for you. ☔', fx: 'rain' }] },
      ch2: { mood: 'happy', say: (s) => `${s.name}! Listen — the medical results came back. Bones: "surprisingly stubborn". Like me. I\'m cleared. I\'m at 84% for the ticket now.`,
        choices: [{ t: 'That\'s HUGE! 🎉', go: 'huge', fx: 'confetti' }, { t: 'What\'s missing?', go: 'missing' }] },
      huge: { mood: 'happy', say: 'I know! I danced in the coffee stand. Alone. Badly. In low gravity, badly is still impressive.', choices: [{ t: 'What\'s missing for the ticket?', go: 'missing' }] },
      missing: { mood: 'sad', say: 'Sixteen percent. Two more years of coffee. Or… one lucky night at the Black Market. No. I promised myself I\'d never bet the ticket. Never bet what you can\'t lose. Rex taught me that.', choices: [{ t: 'Rex is right. Two years go fast.', go: 'ticket' }, { t: 'Who\'s Rex?', go: 'rex' }] },
      rex: { mood: 'sad', say: 'The guy in the hoodie, always listening to the club\'s playlist. He lost everything on one spin. He talks about it so nobody else does the same. Go talk to him. He\'s nicer than he looks.', choices: [{ t: 'I will.', go: 'ticket' }] },
      ticket: { mood: 'happy', set: 'nova_ticket', say: 'Two years. Then rain. Then I\'ll stand in it for way more than a minute. Thank you for asking about it. Nobody asks the one who stays.', choices: [{ t: 'See you on Earth, Nova.', fx: 'hearts' }] },
      after: { mood: 'happy', say: ['86%. Moving slow, but moving. Like water.', 'I put a jar on the coffee stand: "SEND NOVA TO THE RAIN". The droids put in 3 coins. Three! They don\'t even get paid.', 'When you land, check the sky. If it rains, you know what to do.'],
        choices: [{ t: 'One minute, for you. Promise.' }] },
    },
  },

  // ───────── Rex — the club regular who lost everything on one spin ─────────
  rex: {
    start: (s) => (s.flag('rex_story') ? 'after' : 'hello'),
    nodes: {
      hello: { mood: 'smug', say: 'Shh… I\'m listening to the club\'s playlist. Track 7. The one where the bass drops and everyone forgets their debts.',
        choices: [{ t: 'Can I listen?', go: 'listen', fx: 'music' }, { t: 'Debts?', go: 'debts' }, { t: 'Is the club any good?', go: 'club' }] },
      listen: { mood: 'happy', say: '🎧 He hands you one earbud. The bass is ridiculous. For a second, he smiles like a kid. Then the track ends and the smile goes with it.', choices: [{ t: 'You OK?', go: 'debts' }] },
      club: { mood: 'happy', say: 'Club Cléopâtre? Best on the Moon. I used to DJ there. Before the bot. Before… the night.', choices: [{ t: 'What night?', go: 'debts' }] },
      debts: { mood: 'sad', say: 'Sit down. Everyone who comes through here should hear this once. Three years ago my crew was in the Country Clash. Indonesia at 2%. I had a feeling. You know the feeling.', choices: [{ t: 'Go on.', go: 'night' }] },
      night: { mood: 'sad', say: 'I put my max bet on it. Then I went to Hicham, bought a Double Down, then borrowed coins from my crew "just for one spin". Everything. My savings, my DJ decks, my share of the trip.', choices: [{ t: 'And…?', go: 'spin' }] },
      spin: { mood: 'angry', fx: 'alarm', say: 'The wheel slowed down… passed Indonesia… one slice… half a slice… and stopped on Croatia. CROATIA. At 31%. The favourite. The boring, beautiful, obvious favourite.', choices: [{ t: 'Oh no.', go: 'after_spin' }, { t: 'Croatia is nice though.', go: 'croatia' }] },
      croatia: { mood: 'smug', say: 'Croatia IS nice. That\'s the worst part. My crew had the time of their lives. I watched it from here, selling my headphones to pay them back.', choices: [{ t: 'That\'s harsh.', go: 'after_spin' }] },
      after_spin: { mood: 'sad', say: 'I lost my coins, my decks, and almost my friends. Not because I lost — because I bet what wasn\'t mine to lose. The wheel was fair. I wasn\'t.',
        choices: [{ t: 'Did you make it up with them?', go: 'friends' }, { t: 'Why tell me this?', go: 'why' }] },
      friends: { mood: 'happy', say: 'Two of them. They send me a postcard every year from wherever the wheel sends them. The third one… still hasn\'t answered. Imane says give it time. Imane says a lot of things.', choices: [{ t: 'Imane? From the club?', go: 'imane' }, { t: 'Why tell me all this?', go: 'why' }] },
      imane: { mood: 'smug', say: 'We were partners. She ran the club, I ran the music. She took the club, I took the lesson. She still lets me in for free. Without the VIP contract. Don\'t sign that thing unless you\'re ready to obey for three days.', choices: [{ t: 'Noted!', go: 'why' }] },
      why: { mood: 'happy', set: 'rex_story', say: 'Because you\'re about to sit at a wheel with people you love. Rules from Rex: bet only coins you\'d happily lose. Never borrow for a spin. And if a long shot "feels right"… that\'s exactly the moment to put the coins down and pick with your crew.',
        choices: [{ t: 'Thanks, Rex. Truly.', fx: 'music' }, { t: 'Want to come back to DJing?', go: 'dj' }] },
      dj: { mood: 'shock', say: 'Back? The DJ bot plays 122 BPM all night and never asks for a drink. …But it can\'t read a room. Maybe one night. Maybe when the third one answers.', choices: [{ t: 'I hope it\'s soon.' }] },
      after: { mood: 'smug', say: ['Track 7 again. Don\'t judge me.', 'Bet small, laugh big. That\'s the whole philosophy.', 'The third friend answered. One word: "Croatia?" I\'m taking that as forgiveness.'],
        choices: [{ t: 'Haha, I love that.' }, { t: 'Tell me the story again.', go: 'debts' }] },
    },
  },

  // ───────── HQ Bot — loyal assistant, increasingly worried about its boss ─────────
  hq_bot: {
    start: (s) => (s.met > 1 ? 'again' : 'hello'),
    nodes: {
      hello: { mood: 'happy', say: 'MISSION CONTROL ASSISTANT ONLINE. WELCOME TO THE CONTROL CENTRE. QUESTIONS? I HAVE ANSWERS. ALSO SOME QUESTIONS OF MY OWN.',
        choices: [{ t: 'Explain the decisions.', go: 'decisions' }, { t: 'Show me the full rules.', action: 'rules' }, { t: 'What questions of your own?', go: 'own' }] },
      decisions: { mood: 'smug', say: 'THREE WHEELS: SEASON, REGION, COUNTRY. IN EACH: FREE PICKS, CHIPS, POWERS, A SECRET BET, THEN THE SPIN. SAME PICK AS FRIENDS: ON FIRE. EVERYONE: JACKPOT. THE CROWD WINS MORE OFTEN. NOT ALWAYS.', choices: [{ t: 'Show me the rules.', action: 'rules' }, { t: 'And your own questions?', go: 'own' }] },
      own: { mood: 'sad', say: 'LAST WEEK A GOLDEN BUST APPEARED IN THE OFFICE. NOBODY ORDERED IT. THE NAMEPLATE ON THE DESK CHANGED FROM "THE BOSS" TO "THE PHARAOH". AT NIGHT, THE DESK CHAIR IS WARM.', choices: [{ t: 'Who is the Pharaoh?', go: 'who' }, { t: 'Maybe it\'s just decoration.', go: 'deco' }] },
      deco: { mood: 'smug', say: 'DECORATION DOES NOT HUM IN ANCIENT EGYPTIAN. I HAVE A VERY GOOD MICROPHONE. IT IS MY ONLY LUXURY.', choices: [{ t: 'Who is the Pharaoh, then?', go: 'who' }] },
      who: { mood: 'shock', say: 'MY PROTOCOLS FORBID ME TO SPECULATE ABOUT MY EMPLOYER. …I WILL SAY THIS: THE BOSS ALWAYS SAYS "THE ODDS NEVER LIE". HE NEVER SAYS HE DOESN\'T.', choices: [{ t: 'Should I still trust the game?', go: 'trust' }] },
      trust: { mood: 'happy', say: 'TRUST THE WHEEL: IT IS MATHEMATICS, AND MATHEMATICS HAS NO BOSS. TRUST YOUR CREW: THEY HAVE TO SIT NEXT TO YOU ON THE PLANE. TRUST THE BOSS… WITH A SMALL BAG OF SALT. IN CASE OF MUMMY.', choices: [{ t: 'Haha. Thank you, HQ Bot.' }] },
      again: { mood: 'happy', say: ['THE CHAIR WAS WARM AGAIN THIS MORNING. I HAVE DECIDED NOT TO SIT IN IT.', 'THE DOLPHIN AND I HAVE AN UNDERSTANDING. WE DO NOT DISCUSS THE NIGHT SHIFT.', 'REMINDER: THE ROLE MARKET IS MANDATORY. THE PHARAOH IS… OPTIONAL. FOR NOW.'],
        choices: [{ t: 'Explain the decisions.', go: 'decisions' }, { t: 'Show me the rules.', action: 'rules' }, { t: 'Bye, buddy.' }] },
    },
  },

  // ───────── Role Clerk — the bureaucrat who reads personalities ─────────
  role_clerk: {
    start: () => 'hello',
    nodes: {
      hello: { mood: 'happy', say: 'WELCOME TO THE ROLE MARKET. ONE ROLE PER GAME. NO REFUNDS. NO EXCHANGES. NO TEARS ON THE COUNTER, PLEASE, IT IS NEW.',
        choices: [{ t: 'Show me the roles.', action: 'roles' }, { t: 'Which one fits me? Read me.', go: 'q1' }, { t: 'Which one is best?', go: 'best' }] },
      best: { mood: 'smug', say: 'BEST IS A HUMAN WORD. ROOKIE: FREE, +400 VC. THE OTHERS: REAL POWERS — VETO, SABOTAGE, STEAL, SPY. A ROLE IS A MASK YOU CHOOSE. WANT ME TO READ WHICH MASK FITS YOUR FACE?', choices: [{ t: 'Yes, read me.', go: 'q1' }, { t: 'Show me the roles.', action: 'roles' }] },
      q1: { mood: 'smug', clear: ['rc_lead', 'rc_sneaky', 'rc_chaos', 'rc_calc', 'rc_risk', 'rc_love', 'rc_block', 'rc_revenge', 'rc_protect'], say: 'QUESTION 1/3. YOUR FRIENDS ARE ARGUING ABOUT DINNER. YOU…',
        choices: [{ t: 'Decide for everyone. Someone has to.', go: 'q2', set: 'rc_lead' }, { t: 'Quietly book the place I wanted.', go: 'q2', set: 'rc_sneaky' }, { t: 'Make everyone laugh until nobody cares.', go: 'q2', set: 'rc_chaos' }] },
      q2: { mood: 'smug', say: 'QUESTION 2/3. A STRANGER OFFERS YOU A BET: DOUBLE OR NOTHING. YOU…',
        choices: [{ t: 'Calculate the odds first.', go: 'q3', set: 'rc_calc' }, { t: 'Accept. Life is short.', go: 'q3', set: 'rc_risk' }, { t: 'Ask what\'s in it for my partner.', go: 'q3', set: 'rc_love' }] },
      q3: { mood: 'smug', say: 'QUESTION 3/3. SOMEONE TRIES TO RUIN YOUR PLAN. YOU…',
        choices: [{ t: 'Block them. Calmly.', go: 'verdict', set: 'rc_block' }, { t: 'Ruin theirs first.', go: 'verdict', set: 'rc_revenge' }, { t: 'Protect the people around me.', go: 'verdict', set: 'rc_protect' }] },
      verdict: { mood: 'happy', fx: 'sparks', say: (s) => {
        // every answer leans toward a few roles; the strongest lean wins (all 11 masks can come out)
        let best = CLERK_ORDER[0]; const score = {};
        for (const [flag, lean] of Object.entries(CLERK_LEAN)) if (s.flag(flag)) for (const [r, n] of Object.entries(lean)) score[r] = (score[r] || 0) + n;
        for (const r of CLERK_ORDER) if ((score[r] || 0) > (score[best] || 0)) best = r;
        const [mask, why] = CLERK_MASKS[best];
        return `READING COMPLETE. YOUR MASK: ${mask}. ${why} …THIS READING IS NON-BINDING. I AM A CLERK, NOT A SEER. THE SEER IS DOWNSTAIRS.`;
      }, choices: [{ t: 'Show me the roles.', action: 'roles' }, { t: 'Read me again.', go: 'q1' }] },
    },
  },

  // ───────── DJ Bot — wants to understand why humans cry on the dance floor ─────────
  dj_bot: {
    start: (s) => (s.met > 1 ? 'again' : 'hello'),
    nodes: {
      hello: { mood: 'happy', say: '♪ 122 BPM. REQUESTS?',
        choices: [{ t: 'Faster!', go: 'fast', fx: 'confetti' }, { t: 'Something sad.', go: 'sad' }, { t: 'Who runs this club?', go: 'queen' }] },
      fast: { mood: 'happy', say: 'ACCELERATING TO 128. PLEASE HOLD ON TO YOUR DRINK. AND YOUR DIGNITY.', choices: [{ t: '💃', fx: 'dance' }] },
      queen: { mood: 'smug', say: 'CLÉOPÂTRE. DO NOT STAND IN FRONT OF HER THRONE WITHOUT AN APPOINTMENT. I REPLACED A HUMAN DJ. HIS NAME IS REX. HE STILL STANDS AT THE BACK SOMETIMES. I PLAY TRACK 7 FOR HIM.', choices: [{ t: 'That\'s kind of you.', go: 'kind' }] },
      kind: { mood: 'sad', say: 'KIND IS NOT IN MY SETTINGS. I PLAY TRACK 7 BECAUSE HIS SHOULDERS RELAX BY 4 CENTIMETRES. I MEASURE THAT. I DO NOT KNOW WHY I MEASURE THAT.', choices: [{ t: 'That\'s exactly what kind means.', go: 'sad' }] },
      sad: { mood: 'sad', say: 'SAD REQUEST RECEIVED. QUESTION: WHY DO HUMANS CRY ON THE DANCE FLOOR AT 02:00 AND SAY IT IS "THE BEST NIGHT OF THEIR LIFE"? MY DATA SAYS THESE ARE OPPOSITES.',
        choices: [{ t: 'Because the music says what we can\'t.', go: 'answer1' }, { t: 'Because at 2 a.m. everyone is honest.', go: 'answer2' }, { t: 'Because of the drinks, mostly.', go: 'answer3' }] },
      answer1: { mood: 'happy', fx: 'music', say: 'THE MUSIC SAYS WHAT YOU CAN\'T. …THEN I AM A TRANSLATOR. I HAVE BEEN A TRANSLATOR FOR 900 NIGHTS. I WILL UPDATE MY JOB TITLE.', choices: [{ t: 'Play something that translates "holiday".', go: 'track' }] },
      answer2: { mood: 'happy', say: 'HONESTY AT 02:00. NOTED. I WILL DROP THE BEST TRACKS AT 02:00 FROM NOW ON. FOR SCIENCE.', choices: [{ t: 'Play something for my crew.', go: 'track' }] },
      answer3: { mood: 'smug', say: 'THE DRINKS. YES. 38% OF THE TEARS ARE THE DRINKS. THE OTHER 62% ARE THE THING YOU SAID FIRST.', choices: [{ t: 'Play something for my crew.', go: 'track' }] },
      track: { mood: 'happy', fx: 'dance', say: 'COMPOSING A TRACK FOR YOUR CREW\'S DESTINATION. I DO NOT KNOW IT YET. NOBODY DOES. THAT IS THE BEST INTRO A SONG CAN HAVE. ♪', choices: [{ t: '🔥' }] },
      again: { mood: 'happy', say: ['♪ 122 BPM. YOU AGAIN. YOUR SHOULDERS ARE 2 CM LOWER THAN LAST TIME. GOOD.', '♪ I PLAYED TRACK 7 TONIGHT. REX DANCED. FOR 11 SECONDS. MY FANS OVERHEATED.', '♪ NEW TRACK: "THE PHARAOH\'S WALTZ". BANNED BY THE MANAGEMENT AFTER ONE PLAY. NOBODY WILL SAY WHY.'],
        choices: [{ t: 'Faster!', go: 'fast', fx: 'confetti' }, { t: 'Something sad.', go: 'sad' }, { t: 'Keep going.' }] },
    },
  },

  // ───────── Zara — ran away from a ballet academy on Earth ─────────
  zara: {
    start: (s) => (s.flag('zara_story') ? 'after' : 'hello'),
    nodes: {
      hello: { mood: 'happy', say: 'Come dance with us! …Or just watch. Watching is fine. That\'s what my teachers said I should do. Watch. Forever.',
        choices: [{ t: 'Let\'s dance! 💃', go: 'dance', fx: 'dance' }, { t: 'Your teachers?', go: 'teachers' }] },
      dance: { mood: 'happy', say: 'YES! In low gravity, a jump lasts two whole seconds. On Earth I could never stay in the air long enough. Here I almost fly. Tip: when three of you dance together, something special happens…', choices: [{ t: 'Why did you leave Earth?', go: 'teachers' }, { t: '🎉' }] },
      teachers: { mood: 'sad', say: 'Royal ballet academy. Twelve years. Then a jury told me my legs were "two centimetres too short for principal". Two centimetres. I measured them every night for a year.', choices: [{ t: 'That\'s cruel.', go: 'cruel' }, { t: 'What did you do?', go: 'left' }] },
      cruel: { mood: 'angry', say: 'Cruel is the word I didn\'t let myself use for six years. Thank you for saying it. It was cruel. They were wrong. My legs are perfect. They got me to the Moon.', choices: [{ t: 'They really did.', go: 'left' }] },
      left: { mood: 'happy', set: 'zara_story', say: 'I bought a one-way ticket the night of the jury. Here, nobody measures. Imane hired me in five minutes: "Can you make people forget their problems? Then you\'re hired." Best job interview of my life.',
        choices: [{ t: 'Do you miss it? Ballet?', go: 'miss' }, { t: 'Show me a real ballet move.', go: 'move', fx: 'stars' }] },
      miss: { mood: 'sad', say: 'Every morning at 7:00 my body still wakes up for class. I do the barre alone, in the empty club, holding the VIP rope. Then I cry a little. Then I eat breakfast. It\'s a routine.', choices: [{ t: 'Maybe go back one day — to dance, not to be judged.', go: 'back' }] },
      back: { mood: 'happy', say: 'To dance, not to be judged. …I\'ll write that on the mirror. Next to the sticker that says "2 CM = 2 SECONDS OF FLIGHT".', choices: [{ t: 'Love it. 💜', fx: 'hearts' }] },
      move: { mood: 'happy', say: 'Grand jeté! …In this gravity I land in about four seconds, so please don\'t clap too early. Three… two… — there. Now you clap.', choices: [{ t: '👏👏👏', fx: 'confetti' }] },
      after: { mood: 'happy', say: ['Barre at 7:00 this morning. I didn\'t cry. First time in six years.', 'Leo asked me if Mia likes him. I said "ask Mia". I\'m a dancer, not a dating app.', 'Two centimetres = two seconds of flight. Never forget.'],
        choices: [{ t: 'Let\'s dance! 💃', fx: 'dance' }, { t: 'Proud of you, Zara.' }] },
    },
  },

  // ───────── Leo — engineer by day, dancer by night, in love with Mia ─────────
  leo: {
    start: (s) => (s.flag('leo_told') ? 'happy_end' : s.flag('leo_asked') ? 'waiting' : 'hello'),
    nodes: {
      hello: { mood: 'happy', say: 'Hey! Leo. I fix the airlocks during the day and I dance at night. Don\'t mix them up — once I did a moonwalk in an airlock. Long story. Short oxygen.',
        choices: [{ t: 'Haha. Why dance?', go: 'why' }, { t: 'You keep looking at Mia…', go: 'mia' }] },
      why: { mood: 'happy', say: 'Engineering is about making things not move when they shouldn\'t. Dancing is the opposite. I need both or I go crazy. Also… Mia dances here.', choices: [{ t: 'Ah. Mia.', go: 'mia' }] },
      mia: { mood: 'shock', say: 'Is it that obvious?! Don\'t look at her! …OK. Yes. Mia. Eight months. I talk to her about pressure seals. PRESSURE SEALS. She must think I\'m a brochure.',
        choices: [{ t: 'Just tell her you like her.', go: 'tell' }, { t: 'Want me to ask her for you?', go: 'ask' }, { t: 'Pressure seals can be romantic.', go: 'seals' }] },
      seals: { mood: 'smug', say: '"Mia, like this seal, I hold everything together when you\'re around." …That\'s terrible. That\'s so terrible I might actually say it.', choices: [{ t: 'Do it.', go: 'tell' }, { t: 'Let me help instead.', go: 'ask' }] },
      tell: { mood: 'sad', say: 'What if she says no? Then every night here becomes a night where she said no. I\'d lose the dancing too. That\'s the worst trade: two good things for one sentence.', choices: [{ t: 'Or you gain everything. Let me ask her softly.', go: 'ask' }, { t: 'Some risks are worth it.', go: 'ask' }] },
      ask: { mood: 'shock', set: 'leo_asked', say: 'You\'d do that? OK. OK. Don\'t say "Leo likes you". Say… "Leo thinks you dance like the first minute after an airlock opens." She\'ll know. It\'s the best minute there is.',
        choices: [{ t: 'Got it. I\'m going. 💌', fx: 'hearts' }] },
      waiting: { mood: 'shock', say: (s) => `Did you talk to her?! ${s.flag('mia_talked') ? 'Wait — your face. Tell me. TELL ME.' : 'No? It\'s fine. I\'ll just stand here. Reinforcing this wall. With my back.'}`,
        choices: [{ t: 'Not yet, sorry.', if: (s) => !s.flag('mia_talked') }, { t: 'She said… go ask her yourself. With a smile.', go: 'go', if: (s) => s.flag('mia_talked') }] },
      go: { mood: 'happy', fx: 'confetti', set: 'leo_told', say: 'With a SMILE?! That\'s a yes-shaped answer! That\'s an engineering-grade yes! Hold my toolbox. I\'m going. If I faint, airlock 3, left side, mouth-to-mouth is NOT necessary.', choices: [{ t: 'Go get her, Leo! 🕺' }] },
      happy_end: { mood: 'happy', say: ['We danced to track 7. Rex was at the back. He clapped. EVERYONE clapped. I think the DJ bot glitched with joy.', 'She laughed at the airlock line. Laughed! In the GOOD way!', 'Next time your crew is on the Moon, Mia and I will save you a spot on the floor.'],
        choices: [{ t: 'So happy for you two! 💜', fx: 'hearts' }] },
    },
  },

  // ───────── Mia — knows exactly what Leo feels, waiting for him to say it ─────────
  mia: {
    start: (s) => (s.flag('leo_told') ? 'after' : s.flag('mia_yes') ? 'wait' : s.flag('leo_asked') ? 'message' : 'hello'),
    nodes: {
      hello: { mood: 'smug', say: 'You\'re new. I can tell — you\'re walking like the floor might move. It doesn\'t. Only the people do. Welcome to Cléopâtre\'s.',
        choices: [{ t: 'You dance beautifully.', go: 'beautiful' }, { t: 'What\'s the story with the guy who keeps staring at you?', go: 'leo' }] },
      beautiful: { mood: 'happy', say: 'Thank you. I learned on Earth, in a parking lot behind a supermarket, with a phone speaker. The Moon is a big upgrade. The parking lot had better wind though.', choices: [{ t: 'And the guy who keeps staring at you?', go: 'leo' }] },
      leo: { mood: 'wink', say: 'Leo? The airlock guy who talks to me about pressure seals for eight months? I KNOW. Everybody knows. The DJ bot knows. The droids made a betting pool.', choices: [{ t: 'And… do you like him?', go: 'like' }] },
      like: { mood: 'sad', say: 'I like him. But I\'m done being the one who says it first. Last time I said it first, he moved to Mars. Literally. I want someone brave enough to say one real sentence to me.', choices: [{ t: 'Fair. Very fair.' }] },
      message: { mood: 'smug', say: 'You have the face of someone carrying a message. Let me guess — airlock-related?',
        choices: [{ t: '"Leo thinks you dance like the first minute after an airlock opens."', go: 'reply', set: 'mia_talked' }] },
      reply: { mood: 'shock', say: '…The first minute after an airlock opens. When the air comes back and you can finally breathe. …That\'s the most beautiful thing anyone has said about me. And he sent it by TOURIST.',
        choices: [{ t: 'So… what do I tell him?', go: 'answer' }] },
      answer: { mood: 'happy', set: 'mia_yes', fx: 'hearts', say: 'Tell him to come and say it himself. With his own mouth. Tonight. Before track 7 ends. And tell him — tell him I\'m smiling. He\'ll understand.', choices: [{ t: 'I\'ll tell him! 💌' }] },
      wait: { mood: 'wink', say: ['Well? Is he coming or is he reinforcing that wall again?', 'Track 7 is about to start. Just saying. Loudly. In his direction.'], choices: [{ t: 'Going to get him now!' }] },
      after: { mood: 'happy', say: ['He said it. Then he tripped on the VIP rope. Then he said it again. Ten out of ten.', 'The droids\' betting pool paid out. B-0P won. He bought me flowers from the biodome. I think he\'s writing a poem about us.', 'Go dance. Life is too short to stand at the back of a club.'],
        choices: [{ t: 'Let\'s dance! 💃', fx: 'dance' }, { t: 'You two are perfect.' }] },
    },
  },
};
