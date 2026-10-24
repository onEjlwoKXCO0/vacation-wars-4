# VACATION WARS 4 — The Lunar Gambit

A browser multiplayer game for a crew of friends in different countries (desktop **and** phone). You land on Mahmoud's Moon campus, visit your embassy, choose one role for the whole game, board the spacecraft, make wishes, fight over the Region Roulette and the Country Clash, survive the Pharaoh of Discord's final test, and finish at Baby Mahmoud's Black Market — where you spend, pool and trade your coins for real holiday privileges, or buy a full restart.

---

## Quick start

```bash
npm install
npm start            # builds the client and serves http://localhost:3000
npm test             # rule & engine tests (probabilities, wallets, roles, powers, tests, final shot, market)
npm run build:demo   # dist/vacation-wars-4-solo.html — solo demo with bot crewmates (needs ./assets next to it)
```

Requires Node 18+.

### Playing with friends in other countries

**See [DEPLOY.md](DEPLOY.md)** — a 15-minute, no-command-line guide to put the game online for free (GitHub + Render + Upstash), plus your-own-computer, Fly.io and Docker options. Ready-made files: `render.yaml`, `Dockerfile`, `fly.toml`.

**Saved games:** every crew is saved a moment after each change (Upstash Redis if `UPSTASH_REDIS_REST_URL`/`TOKEN` are set, otherwise JSON files in `DATA_DIR`, default `./data`). After a restart, redeploy or a free host going to sleep, crews come back with their timers resumed, and players get their seat back by simply reloading. If the host is away for 60 s, another connected player becomes host.

### Controls

| | Computer | Phone |
|---|---|---|
| Walk | WASD / ZQSD / arrows, or click where to go | joystick, or tap where to go |
| Jump | **Space** | **X** button |
| Talk / enter / interact | **E**, **A** (AZERTY) or Enter — or click the person / door | **GO** button, or tap the person / door |
| Answer in a conversation | click, or keys **1–4** | tap |
| Emotes | 1–7 | emote bar |
| Kiss (special pairs & couples, when close) | **K** or 💋 | 💋 |

---

## The flow (as implemented)

1. **Intro** — the Star Wars-style opening crawl (yellow text), then the descent to the Moon.
2. **Arrival** — the camera glides over the campus to Mahmoud's statue, then **Mahmoud's 1-minute briefing** (7 cards, auto-advancing, with a tiny ON FIRE / JACKPOT playground; replay it from the checklist, the ☰ menu, the ? button or by talking to Mahmoud). A checklist (top-left) and a blue arrow guide first-timers.
   Every building has an interior: the 4 embassies (2 floors each — upstairs is a private cosy bedroom), Mahmoud's Control Centre (a gold-and-glass palace on its own forecourt: live billboard, MAHMOUD crown, searchlights, helipad, office windows where people walk the corridors, red carpet and droid guards; inside a calm gold-and-navy hall: video wall, the Pharaoh's gold desk, a pharaoh bust, holo table, dolphin tank, bookshelf, trophies, espresso bar), the Role Market, the Black Market, Club Cléopâtre, the Biodome garden, Moumanou's tent and the **Control Tower · Moon Arcade**.
   - **Control Tower** (south-east, next to the launch pad; music *The Mountain — Snowfall*): **Alessandro**, the chef de salle, explains every game — and offers to fly you to Barcelona to forget, or to smoke a chicha with *le tonton* (Hicham).
     - **The Living Earth**: a 3D globe with a flag on all 175 destinations; tap one for its card — capital, languages, money, the most beautiful place, 3 fun facts, what to eat, weather month by month, cost per day, your flight time.
     - **Country Quiz** (922 questions, easy / medium / hard, 5 per game, 20 s each), **Flag Memory** (8 pairs), **Globe Duel** (5 "which one?" duels from the game data) and a crew leaderboard. All checked by the server. Each player's arcade result for this Moon visit floats over their head in the tower and on the TOP CREW screen.
     - Rewards stay small next to Black Market prices (400–700 VC): quiz 0–1/5 −15 · 2/5 −5 · 3/5 0 · 4/5 +8/+10/+15 · 5/5 +15/+20/+30 (easy/medium/hard); memory ≤10 tries +20 … >21 −10; duel −10 … +20. Net arcade result capped at **±100 VC per Moon visit** (before launch, and again at the Black Market).
3. **Embassy** — walk into your embassy. The ambassador greets you in your language (Portuguese, Macedonian; French for the Polish and Moroccan players). Ground floor is public: travel board with % of the world visited, per continent and with your partner. **Upstairs** (bedroom, cosy room) only opens for that embassy's player and their partner — enforced by the server.
4. **Role Market** — a cyberpunk tower (role pods behind glass, scrolling billboard, hologram counter). **Mandatory stop**: nobody can board — and the host cannot launch — until every human crewmate has chosen a role here. One role, locked for the whole game (Rookie is free and gives +400 VC).
5. **Spacecraft** — board on the launch pad; when everyone is aboard the launch cinematic plays.
6. **Wishlist** — each player secretly picks 1–5 countries (each wish = +10 weight for that country, its region and its comfy months, and pre-fills that player's picks) and can privately block up to 4 **impossible months** — they leave the Season wheel, nobody sees who blocked them.
7. **Season Spin** — the month wheel (the WHEN), minus the blocked months. Each crewmate adds up to +10: `10 × share of their wishes that are comfortable (18–29 °C) that month`. The winning month drives every temperature shown afterwards. Music: `season_game.mp3`.
8. **Region Roulette** — 11 regions (Europe, North America, Central America & Caribbean, South America, Africa, Middle East & Caucasus, South Asia, South-East Asia, East Asia, Oceania, Antarctica): picks, chips, secret bets, role powers and Black Market powers. The reveal is the spinning Earth plus a slot-machine counter naming the option under the beam (the drawn wheel is only used for the months).
9. **Country Clash** — the countries of the winning region, with travel time & fare per player, flexibility index and ease-of-reach.
10. **The Pharaoh** — Mahmoud's sprite transforms into the Pharaoh of Discord. Test 1: couples call each other on WhatsApp and tap a score 1–10 (the screen shows each couple / solo side). Test 2: girls' and boys' group calls (two columns), score 1–10. The couples result is shown after test 1; girls', boys' and couples' averages are shown with the final shot.
11. **Probability Shot** — chosen country keeps `90% × satisfaction / 10`; the rest is shared by the countries on the crew's **wishlists** (wished by more crewmates = bigger slice). One last bet, one spin. (The old "three countries each" step is gone: the wishlist already says where people would rather go.)
12. **Black Market** — exit the ship, Baby Mahmoud bumps into you and leads you there: Airbnb powers, activities, daily-life privileges, pools between players, coin gifts & requests, and the **Restart** (price = every coin the crew still owns). Then the host prints the vacation contract.

### The Moon's residents (NPCs)

Every conversation is a branching dialogue with multiple-choice answers (pixel portraits, no photos). The ambient residents have their own stories, told in chapters: conversations **remember you** (on this device only — they never change the game), so coming back continues the story, and some stories cross over between characters.

| Resident | Where | Their story |
|---|---|---|
| Cmdr. Vega | walking the campus | Lost a bet with Mahmoud 3 years ago, missed her sister's wedding. A solar-flare emergency where you pull the lever; next visit she asks your advice about calling her sister. |
| Cmdr. Orion | walking the campus | Retired, convinced the wheel is rigged and that Mahmoud's shadow wears a crown. Explain how the draw works and he finally sleeps. |
| Unit B-0P | walking the campus | A sweeping droid that has 4,212 photos of the sea and has never seen it. Describe it, then hear his first poem. |
| Unit Z-3D | walking the campus | Paranoid security droid with three anomalies (Hicham's container, chanting in the HQ, Nova). Become his informal partner, code name "Tourist". |
| Nova | walking the campus | Born on the Moon, has never felt rain; saving for 10 years for a ticket to Earth. |
| Rex | walking the campus | Ex-DJ who lost everything on one 2% long shot — the responsible-betting lesson, without the lecture. |
| Zara · Leo · Mia | Club Cléopâtre | Zara ran away from ballet school. Leo is in love with Mia: carry his message, bring back her answer. |
| DJ Bot · HQ Bot · Role Clerk | club, HQ, Role Market | The DJ bot wonders why humans cry on the dance floor; the HQ bot suspects its boss; the clerk gives a 3-question personality reading that suggests one of the 11 roles. |

| Who | Where | What the conversation can lead to |
|---|---|---|
| **Hicham** — Black Market dealer | inside the Black Market | explains chips & powers; at the end he opens the shop |
| **Joseph** — intergalactic traveller, Hicham's supplier | by the launch pad | road tips (visited malus, Shield vs Veto) |
| **Alice & Nico** — the Converters | Café de Paris, west of the fountain | they pitch France; promise them and 🇫🇷 France is pre-filled on your wishlist (you can break the promise later) |
| **Imane “Cléopâtre”** | VIP throne in Club Cléopâtre | VIP 👑 in exchange for 3 days of obedience during the holiday (written in the contract; can be cancelled) |
| **Plami** — the Dreamer | Biodome garden | ties a flower bracelet 🌸 on your wrist |
| **Moumanou** — the Seer | her tent (east, under the Role Market) | a premonition about your destination; the contract reveals if she was right |

### When do you spend?

Roles: once, before launch. Picks, chips, bets and Black Market **powers**: during the Season, Region and Country decisions, from the spacecraft terminal (buying = using). The Black Market **building** opens only at the end, for holiday privileges and the restart.

---

## The rules

- **VC**: everyone starts with 1,000 fictional Vacation Coins (no real money).
- **Picks ★ (free)**: 3 per wheel (2 on wheels of 5–6 options, 1 on wheels of 3–4), pre-filled from the wishlist. One pick = +12 (small). Same pick as friends = 🔥 **ON FIRE**: +25 for 2 pickers, +100 for 3, +225 for 4. Picked by **everyone** = 🎰 **JACKPOT**: whole weight ×2.5 (≈ 68 % chance on any wheel size: the crowd wins most of the time, never always).
- **Odds**: all the options of a wheel share one fixed base of 150 (12 months → 12.5 each, 27 countries → 5.6 each, min 5; Antarctica gets 40 % of a normal region). Each crewmate's wish adds +10. **Luck always keeps 15 %**: no option can pass 85 %. Casino labels next to each %: 🔥 HOT, ⭐ CONTENDER, ⚖️ IN THE MIX, 🎯 LONG SHOT, 🧊 COLD (vs a fair share), plus a HYPE meter showing how close the crew is to a jackpot. A chip costs 50 VC and adds +25 — placed like a casino chip and withdrawable until the timer ends. **Already-visited malus**: a country's total weight × `(1 − 30% × share of the crew who has been there)`, shown as “👣 visited · malus −X%”. Chance = weight ÷ total — the shown % is exactly the % used, and every row shows what one more chip would do.
- **Chips**: 50 VC = +25 weight; 5 per player per decision, 15 per option; anonymous; taking a chip back refunds it.
- **Bets**: 10–400 VC, WIN pays `stake × clamp(0.9 / p, 1.02, 10)` (never a sure profit), BUST loses the stake; multiplier frozen when the wheel locks. The landing screen shows each player's WIN / BUST.
- **Draw**: the server draws one `u ∈ [0,1)` with `crypto.randomInt`, publishes it, and the option whose band contains `u` wins.
- **Roles** (real powers): Rookie (+400 VC), Commander (double all chips on one option, per decision), Hacker (see every bet & chip), Bookmaker (winning bets ×2), Diplomat (veto one option, per game), Saboteur (wipe all chips on one option, per decision), Bodyguard (free Shield per decision, theft-immune), Merchant (half-price powers; coins count double in market pools), Chaos Agent (force a re-spin, per game), Thief (steal 200 VC, per game), Cupid (your couple's score counts double).
- **Black Market (end of game)**: shape the trip (choose where we stay, the exact dates, road trip or one base, a second stop, one more day, the flights, the budget cap), where we sleep (Airbnb, own room, first pick, pool/view), the days (plan a whole day, must-do activity, veto, dinners, adventure/party/beach days), daily perks (never drive, no dishes, sleep-in, car DJ, porter, a drink) and the Restart.
- **Black Market powers** (during decisions): Veto 220, Shield 120, Sabotage 150, Golden Ticket 200 (+3 chips), Spyglass 80, Double Down 120, Insurance 80, Time Loop 350 (spin the same wheel ONE more time with the same odds, right after the result).
- **Results screen**: one scrolling card — the winner, your WIN / BUST, what each crewmate picked / chipped / bet, and the top odds before the spin.
- **Satisfaction** = average of the couples average (Cupid ×2) and the girls/boys group average.

---

## Architecture

```
shared/              pure game logic, runs on the server AND in the browser (solo)
  config.js          every tunable number
  rules.js           odds, travel estimates, flexibility, bets, satisfaction, final distribution
  engine.js          authoritative state machine + redacted per-player views
  host.js            RoomHost: clients, timers, bots, positions (scene-aware, upstairs privacy)
  bots.js            bots that play every stage with the same validated actions
  map.js / interiors.js   campus and embassy layouts, collision, zones, waypoints
  data/              roles, powers, market items, countries (175 destinations — every safe UN country, 193 UN countries for travel history), countryInfo (encyclopedia cards), quiz (922 generated + hand-written questions), regions, nations, dialogue, world list
server/index.js      Node http + ws: static files, /assets, rooms, invite codes, reconnect tokens, crypto RNG
server/store.js      saved games: Upstash Redis (REST) or JSON files
client/              rendering only — never decides an outcome
  world/world.js     Moon campus + embassy interiors: movement, jump, footprints, dust, NPCs, Baby Mahmoud
  ship/              Three.js Earth with region/country beams and reveal camera
  gfx/               procedural pixel art (campus, buildings, interiors, sprites, pixel font)
  ui/                intro, title, onboarding, HUD, panels, rules, game stages, roulette, market, cinematics
assets/music/*.mp3   the crew's tracks (campus, embassies, Role Market, Mahmoud's HQ, club, Moumanou's tent, biodome, casinos, final wheel, Black Market, Pharaoh laugh)
assets/cine/<slot>.jpg  optional full-screen images for the films (see below)
tests/               node:test suites
```

## Cinematics: image slots

Every cinematic is a film of 10-second shots (`client/ui/film.js`). Each shot is rendered in-engine (pixel art, live) **unless** an image with the slot's name exists in `assets/cine/` — then that image is shown full screen for 10 s with a slow push-in, and the subtitles play on top. Images: **16:9, at least 1920×1080, JPG, no text in the image** (subtitles are added by the game).

| Slot | What the image should show |
|---|---|
| `arrival_1_campus` | Wide shot of the cyberpunk Moon campus: embassies, fountain, Mahmoud's golden statue |
| `arrival_2_mahmoud` | Mahmoud (dolphin shirt, sunglasses, curly hair, beard) welcoming the crew with open arms |
| `launch_1_boarding` | The crew walking up the ramp into MAHMOUD-1 |
| `launch_2_liftoff` | Lift-off: flames, smoke, the ship leaving the pad |
| `launch_3_cockpit` | Cockpit view, Earth growing in the window, holographic HUD |
| `season_1` | Casino with a giant 12-month wheel (snow, flowers, sun, autumn leaves) |
| `region_1` | Casino roulette with the Earth spinning in the middle |
| `country_1` | Darts flying at a globe / dartboard map |
| `pharaoh_1_doubt` | Mahmoud smirking, “you think you've decided?” |
| `pharaoh_2_transform` | Mahmoud's dolphin shirt glowing, lightning, half-transformed |
| `pharaoh_3_reveal` | The Pharaoh of Discord (Mahmoud as a pharaoh) in front of a pyramid |
| `pharaoh_4_test` | Couples on WhatsApp video calls, scores 1–10 floating |
| `pharaoh_5_berserk` | Chaos: everyone throwing three country flags on a table |
| `final_1` | The Pharaoh before a giant golden probability wheel |
| `exit_1_landing` | The ship landing back on the Moon |
| `exit_2_baby_bump` | Baby Mahmoud running into a crew member, stars around their heads |
| `exit_3_market` | Baby Mahmoud pointing at Hicham's neon Black Market container |
| `telescope_1` | Earthrise seen through the campus telescope |

Server timers match the films (launch 31 s, each roulette 11 s, Pharaoh 51 s, exit 31 s). Late joiners jump to the right moment.

## Assumptions

- Running crews live in memory and are saved continuously; a crew idle for 6 h is unloaded but stays saved for 7 days (its invite link wakes it up).
- Country scores and costs are editorial estimates; flight times and fares are great-circle estimates — labelled in the UI.
- Partner trips are private by default. Visited countries are visible to the crew because they change the odds.
- All sprites, buildings, interiors, cinematics and sound effects are generated in code (HD pixel art, 32 px tiles); music and optional cinematic images are the crew's own files.
- Flag emojis use the "Twemoji Country Flags" font (Twemoji art © Twitter, CC-BY 4.0) so they also show on Windows; it is embedded in the build.
- Destinations: countries under widespread "do not travel" advisories (war or armed conflict) are left out on purpose.
- Couples by default: the Macedonian with the Polish, the Moroccan with the Portuguese (pre-selected in the passport, can be changed).
