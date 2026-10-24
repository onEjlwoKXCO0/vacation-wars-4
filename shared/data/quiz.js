// Alessandro's quiz bank: built once from the country data (capitals, dishes, places, currencies,
// fun facts, climate) + hand-written geography questions. Deterministic, so the server and every
// browser hold the exact same bank. Each question: { id, d: 'easy'|'medium'|'hard', q, choices[4], a, why }.
import { COUNTRIES, countryById, MONTHS } from './countries.js';
import { COUNTRY_INFO } from './countryInfo.js';
import { mulberry32 } from '../map.js';

// Countries most people can place on a map → easy questions.
const TIER1 = new Set(['620', '724', '380', '300', '250', '276', '826', '372', '528', '756', '040', '203', '352', '578', '752', '840', '124', '484', '076', '032', '604', '152', '818', '504', '710', '404', '834', '792', '784', '356', '764', '704', '360', '392', '410', '156', '036', '554', '616', '348', '191', '192', '170', '208', '056', '246', '400', '462']);
// Tiny or rarely visited → hard questions.
const TIER3 = new Set(['492', '020', '674', '438', '498', '442', '678', '204', '768', '270', '694', '024', '174', '262', '748', '426', '430', '178', '226', '324', '624', '478', '108', '232', '659', '670', '212', '028', '308', '780', '328', '740', '600', '048', '414', '762', '795', '296', '584', '520', '798', '583', '585', '090', '626', '096', '064', '266', '120', '716', '454', '012', '566', '384', '222', '340', '558', '084']);
const tier = (id) => (TIER1.has(id) ? 1 : TIER3.has(id) ? 3 : 2);
const D = ['', 'easy', 'medium', 'hard'];

const rng = mulberry32(4242);
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** 4 choices: the answer + 3 distractors, preferably from the same region. */
function makeChoices(answer, pool, regionPool) {
  const uniq = (l) => [...new Set(l.filter((x) => x && x !== answer))];
  let d = shuffle(uniq(regionPool)).slice(0, 3);
  if (d.length < 3) d = d.concat(shuffle(uniq(pool).filter((x) => !d.includes(x))).slice(0, 3 - d.length));
  const choices = shuffle([answer, ...d]);
  return { choices, a: choices.indexOf(answer) };
}

const bank = [];
let n = 0;
const add = (d, q, answer, pool, regionPool, why) => { const { choices, a } = makeChoices(answer, pool, regionPool); if (choices.length === 4) bank.push({ id: `q${++n}`, d, q, choices, a, why }); };

const list = COUNTRIES.filter((c) => c.id !== '010' && COUNTRY_INFO[c.id]);
const sameRegion = (c) => list.filter((x) => x.region === c.region && x.id !== c.id);
const names = list.map((c) => c.name);
const count = (key) => { const m = {}; for (const c of list) { const v = COUNTRY_INFO[c.id][key]; m[v] = (m[v] || 0) + 1; } return m; };
const mentions = (text, c) => { const t = text.toLowerCase(); const info = COUNTRY_INFO[c.id]; return [c.name, info.capital.split(' ')[0]].some((w) => w.length > 3 && t.includes(w.toLowerCase().slice(0, Math.min(6, w.length)))); };

// 1. capitals
const SKIP_CAP = new Set(['068', '710', '144', '748', '520', '376', '258', '360']);
const caps = list.filter((c) => !SKIP_CAP.has(c.id));
for (const c of caps) add(D[tier(c.id)], `What is the capital of ${c.flag} ${c.name}?`, COUNTRY_INFO[c.id].capital, caps.map((x) => COUNTRY_INFO[x.id].capital), sameRegion(c).filter((x) => !SKIP_CAP.has(x.id)).map((x) => COUNTRY_INFO[x.id].capital), `${COUNTRY_INFO[c.id].capital} is the capital of ${c.name}.`);

// 2. where is this beautiful place?
for (const c of list) {
  const info = COUNTRY_INFO[c.id];
  if (mentions(info.bestPlace, c)) continue;
  add(D[Math.min(3, tier(c.id))], `${info.bestPlace} — in which country?`, c.name, names, sameRegion(c).map((x) => x.name), `${info.bestPlace} is in ${c.name}: ${info.bestWhy}`);
}

// 3. signature dishes (only dishes that belong to one country here)
const dishCount = count('dish');
for (const c of list) {
  const info = COUNTRY_INFO[c.id];
  if (dishCount[info.dish] > 1 || mentions(info.dish, c)) continue;
  add(D[tier(c.id)], `Which country is famous for “${info.dish}”?`, c.name, names, sameRegion(c).map((x) => x.name), `${info.dish} is a classic of ${c.name}.`);
}

// 4. currencies (skip the shared ones)
const curCount = count('currency');
for (const c of list) {
  const cur = COUNTRY_INFO[c.id].currency;
  if (curCount[cur] > 1 || /euro|us dollar|cfa|east caribbean|australian dollar|swiss franc/i.test(cur) || mentions(cur, c)) continue;
  add(tier(c.id) === 1 ? 'medium' : 'hard', `Which country pays with the ${cur.replace(/\s*\(.*\)/, '')}?`, c.name, names, sameRegion(c).map((x) => x.name), `${c.name} uses the ${cur}.`);
}

// 5. fun facts with the country hidden
for (const c of list) {
  for (const f of COUNTRY_INFO[c.id].facts) {
    if (mentions(f, c)) continue;
    add(tier(c.id) === 1 ? 'medium' : 'hard', `Which country? “${f}”`, c.name, names, sameRegion(c).map((x) => x.name), `${c.flag} ${c.name}.`);
  }
}

// 6. climate: warmest of four in a given month
const crng = mulberry32(77);
for (let i = 0; i < 40; i++) {
  const m = Math.floor(crng() * 12);
  const pick = []; while (pick.length < 4) { const c = list[Math.floor(crng() * list.length)]; if (!pick.includes(c) && !pick.some((p) => p.temp[m] === c.temp[m])) pick.push(c); }
  const hot = pick.reduce((a, b) => (b.temp[m] > a.temp[m] ? b : a));
  const choices = shuffle(pick.map((p) => p.name));
  bank.push({ id: `q${++n}`, d: pick.every((p) => tier(p.id) === 1) ? 'medium' : 'hard', q: `Which is the warmest in ${MONTHS[m]}?`, choices, a: choices.indexOf(hot.name), why: pick.map((p) => `${p.flag} ${p.refCity} ${p.temp[m]}°C`).join(' · ') });
}

// 7. hand-written geography
const H = [
  ['easy', 'What is the longest river in Africa?', ['The Nile', 'The Congo', 'The Niger', 'The Zambezi'], 'The Nile flows about 6,650 km to the Mediterranean.'],
  ['easy', 'Which is the largest ocean?', ['Pacific', 'Atlantic', 'Indian', 'Arctic'], 'The Pacific covers about a third of the Earth.'],
  ['easy', 'Which country has the most people?', ['India', 'China', 'United States', 'Indonesia'], 'India passed China in 2023.'],
  ['easy', 'What is the largest country by area?', ['Russia', 'Canada', 'China', 'United States'], 'Russia covers about 17 million km².'],
  ['easy', 'Which is the highest mountain on Earth?', ['Everest', 'K2', 'Kilimanjaro', 'Mont Blanc'], 'Everest is 8,849 m tall.'],
  ['easy', 'Which desert is the largest hot desert?', ['Sahara', 'Gobi', 'Kalahari', 'Atacama'], 'The Sahara covers about 9 million km².'],
  ['easy', 'In which city is the Colosseum?', ['Rome', 'Athens', 'Istanbul', 'Paris'], 'Built in the 1st century AD.'],
  ['easy', 'Which city is called the Big Apple?', ['New York', 'Los Angeles', 'Chicago', 'Boston'], 'A nickname popularised in the 1920s.'],
  ['easy', 'How many continents are usually counted?', ['7', '5', '6', '8'], 'Africa, Antarctica, Asia, Europe, North America, Oceania, South America.'],
  ['easy', 'Which ocean lies between Europe and America?', ['Atlantic', 'Pacific', 'Indian', 'Southern'], 'The Atlantic.'],
  ['easy', 'Where would you find the Eiffel Tower?', ['Paris', 'Brussels', 'Lyon', 'Geneva'], 'Built for the 1889 World Fair.'],
  ['easy', 'Which country is shaped like a boot?', ['Italy', 'Greece', 'Portugal', 'Chile'], 'Italy — with Sicily as the ball.'],
  ['medium', 'Which is the smallest country in the world?', ['Vatican City', 'Monaco', 'San Marino', 'Nauru'], 'About 0.44 km².'],
  ['medium', 'Which river flows through Budapest, Vienna and Bratislava?', ['Danube', 'Rhine', 'Elbe', 'Vistula'], 'The Danube crosses 10 countries.'],
  ['medium', 'Which is the deepest lake in the world?', ['Baikal', 'Tanganyika', 'Superior', 'Victoria'], 'Lake Baikal is about 1,640 m deep.'],
  ['medium', 'Which line divides the Earth into northern and southern halves?', ['The equator', 'The prime meridian', 'The Tropic of Cancer', 'The date line'], 'Latitude 0°.'],
  ['medium', 'Which country has the most time zones (including territories)?', ['France', 'Russia', 'United States', 'United Kingdom'], 'France has 12.'],
  ['medium', 'Which mountain range separates France and Spain?', ['Pyrenees', 'Alps', 'Apennines', 'Carpathians'], 'Andorra sits in the middle.'],
  ['medium', 'Which sea is so salty you float effortlessly?', ['Dead Sea', 'Red Sea', 'Black Sea', 'Caspian Sea'], 'About 34% salinity.'],
  ['medium', 'What is the largest island in the world (not a continent)?', ['Greenland', 'New Guinea', 'Borneo', 'Madagascar'], 'Greenland, about 2.1 million km².'],
  ['medium', 'Which waterfall is the highest in the world?', ['Angel Falls', 'Victoria Falls', 'Niagara Falls', 'Iguaçu Falls'], 'Angel Falls in Venezuela, 979 m.'],
  ['medium', 'Which country has the most islands?', ['Sweden', 'Indonesia', 'Philippines', 'Norway'], 'Sweden counts about 267,000.'],
  ['medium', 'The Strait of Gibraltar separates Spain from…', ['Morocco', 'Algeria', 'Tunisia', 'Portugal'], 'Only about 14 km wide.'],
  ['medium', 'Which country is both in Europe and Asia, with a city on both?', ['Turkey', 'Georgia', 'Cyprus', 'Greece'], 'Istanbul straddles the Bosphorus.'],
  ['medium', 'What does a passport stamp prove?', ['You crossed a border', 'You paid tax', 'You are a citizen', 'You booked a hotel'], 'Entry or exit at a border.'],
  ['medium', 'Which country gave the world the Olympic Games?', ['Greece', 'Italy', 'France', 'Egypt'], 'Ancient Olympia, 776 BC.'],
  ['hard', 'Which is the only country that borders both the Atlantic and the Indian Ocean?', ['South Africa', 'Mozambique', 'Namibia', 'Madagascar'], 'Cape Agulhas is where they meet.'],
  ['hard', 'Which capital city is the highest above sea level?', ['La Paz', 'Quito', 'Bogotá', 'Thimphu'], 'About 3,600 m.'],
  ['hard', 'Which country has the longest coastline?', ['Canada', 'Norway', 'Indonesia', 'Australia'], 'More than 200,000 km.'],
  ['hard', 'Which two countries are doubly landlocked?', ['Liechtenstein & Uzbekistan', 'Bolivia & Paraguay', 'Mongolia & Nepal', 'Austria & Hungary'], 'Surrounded only by landlocked countries.'],
  ['hard', 'Which European capital is built on 14 islands?', ['Stockholm', 'Copenhagen', 'Amsterdam', 'Venice'], 'Stockholm — "Beauty on the water".'],
  ['hard', 'Which African country was never colonised (apart from a brief occupation)?', ['Ethiopia', 'Ghana', 'Kenya', 'Nigeria'], 'Only occupied by Italy 1936–41.'],
  ['hard', 'Which country is crossed by both the equator and the Tropic of Capricorn?', ['Brazil', 'Peru', 'Kenya', 'Australia'], 'Brazil spans both.'],
  ['hard', 'What is the driest non-polar desert on Earth?', ['Atacama', 'Sahara', 'Namib', 'Gobi'], 'Some stations have never recorded rain.'],
  ['hard', 'The Ring of Fire mostly surrounds which ocean?', ['Pacific', 'Atlantic', 'Indian', 'Arctic'], 'About 75% of the world\'s volcanoes.'],
  ['hard', 'Which country has the most official languages?', ['Zimbabwe', 'South Africa', 'India', 'Switzerland'], 'Zimbabwe has 16.'],
  ['hard', 'Which is the lowest point on land?', ['The Dead Sea shore', 'Death Valley', 'Lake Assal', 'The Caspian shore'], 'About 430 m below sea level.'],
  ['hard', 'Which country uses a calendar about 7–8 years behind ours?', ['Ethiopia', 'Iran', 'Nepal', 'Thailand'], 'The Ethiopian calendar.'],
  ['hard', 'Which country\'s flag is not rectangular?', ['Nepal', 'Bhutan', 'Switzerland', 'Vatican City'], 'Two stacked pennants.'],
  ['hard', 'In which country is the world\'s largest salt flat?', ['Bolivia', 'Chile', 'Argentina', 'United States'], 'Salar de Uyuni.'],
];
for (const [d, q, [ans, ...rest], why] of H) { const choices = shuffle([ans, ...rest]); bank.push({ id: `q${++n}`, d, q, choices, a: choices.indexOf(ans), why }); }

export const QUIZ = bank;
export const quizById = new Map(bank.map((q) => [q.id, q]));
export const QUIZ_BY_LEVEL = { easy: bank.filter((q) => q.d === 'easy'), medium: bank.filter((q) => q.d === 'medium'), hard: bank.filter((q) => q.d === 'hard') };
export const countryNameOf = (id) => countryById(id)?.name || id;
