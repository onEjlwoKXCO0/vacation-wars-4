// End-of-game Black Market: real holiday privileges the crew agrees to honour.
// Items are funded by one or more players (pools). When a pool reaches the price, it is bought.
//   for: 'owner' (privilege of the player who opened the pool) | 'crew' (everyone enjoys it)

export const MARKET_ITEMS = [
  // The trip itself — the big decisions that come right after the country
  { id: 'base_city', cat: 'Shape the trip', icon: '📍', name: 'Choose where we stay', price: 700, for: 'owner', stock: 1, text: 'You choose the city or region inside the winning country where the crew is based.' },
  { id: 'dates', cat: 'Shape the trip', icon: '📅', name: 'Choose the exact dates', price: 600, for: 'owner', stock: 1, text: 'Within the winning month, you fix the departure and return dates (everyone\'s holidays respected).' },
  { id: 'format', cat: 'Shape the trip', icon: '🗺️', name: 'Road trip or one base?', price: 500, for: 'owner', stock: 1, text: 'You decide the format: one place all week, or a road trip with several stops.' },
  { id: 'extra_stop', cat: 'Shape the trip', icon: '🏙️', name: 'Add a second stop', price: 650, for: 'crew', stock: 1, text: 'The trip gets a second city / island / region for at least 2 nights.' },
  { id: 'extend', cat: 'Shape the trip', icon: '⏳', name: 'One more day', price: 550, for: 'crew', stock: 1, text: 'The trip lasts one day longer than planned.' },
  { id: 'flights', cat: 'Shape the trip', icon: '✈️', name: 'Choose the flights', price: 450, for: 'owner', stock: 1, text: 'You pick airline and schedule among reasonable options (no 5 a.m. flights unless you want them).' },
  { id: 'budget_cap', cat: 'Shape the trip', icon: '💶', name: 'Budget guardian', price: 400, for: 'owner', stock: 1, text: 'You set the maximum price per night for the stay. Nobody can book above it.' },
  // Where we sleep
  { id: 'airbnb_pick', cat: 'Where we sleep', icon: '🏡', name: 'Pick the Airbnb', price: 600, for: 'owner', stock: 1, text: 'You choose the Airbnb from the crew\'s shortlist.' },
  { id: 'own_room', cat: 'Where we sleep', icon: '🚪', name: 'A room for you (and your partner)', price: 450, for: 'owner', stock: 2, text: 'You never share your room with anyone except your partner.' },
  { id: 'best_room', cat: 'Where we sleep', icon: '🛏️', name: 'First pick of bedroom', price: 300, for: 'owner', stock: 1, text: 'You choose your room before anyone else.' },
  { id: 'pool_or_view', cat: 'Where we sleep', icon: '🏊', name: 'Pool or view guaranteed', price: 300, for: 'owner', stock: 1, text: 'The place must have a pool or a view — you decide which.' },
  // The days
  { id: 'plan_day', cat: 'The days', icon: '🗓️', name: 'Plan a whole day', price: 400, for: 'owner', stock: 2, text: 'One full day of the holiday follows your plan, from breakfast to the last drink.' },
  { id: 'activity_sponsor', cat: 'The days', icon: '🎯', name: 'Must-do activity', price: 300, for: 'owner', stock: 3, text: 'Add one activity that everyone joins. You name it.' },
  { id: 'veto_activity', cat: 'The days', icon: '✋', name: 'Veto an activity', price: 250, for: 'owner', stock: 2, text: 'Cancel one planned activity you hate.' },
  { id: 'restaurant_pick', cat: 'The days', icon: '🍽️', name: 'Choose a dinner', price: 200, for: 'owner', stock: 3, text: 'You pick the restaurant for one dinner.' },
  { id: 'adventure_day', cat: 'The days', icon: '🪂', name: 'Adventure day', price: 400, for: 'crew', stock: 1, text: 'One full day of diving, hiking, quads or similar for the whole crew.' },
  { id: 'party_night', cat: 'The days', icon: '🪩', name: 'Big night out', price: 300, for: 'crew', stock: 1, text: 'One night out together, nobody leaves before 2 a.m.' },
  { id: 'beach_day', cat: 'The days', icon: '🏖️', name: 'Lazy beach day', price: 250, for: 'crew', stock: 1, text: 'One protected day of doing absolutely nothing.' },
  // Daily-life perks
  { id: 'no_driving', cat: 'Daily-life perks', icon: '🚗', name: 'Never drive', price: 200, for: 'owner', stock: 2, text: 'You are never the driver.' },
  { id: 'no_dishes', cat: 'Daily-life perks', icon: '🍳', name: 'Dish-duty immunity', price: 150, for: 'owner', stock: 2, text: 'You never do the dishes.' },
  { id: 'sleep_in', cat: 'Daily-life perks', icon: '😴', name: 'Sleep-in pass', price: 150, for: 'owner', stock: 3, text: 'Skip one morning activity guilt-free.' },
  { id: 'dj', cat: 'Daily-life perks', icon: '🎧', name: 'Car DJ', price: 120, for: 'owner', stock: 1, text: 'You control the music in the car.' },
  { id: 'porter', cat: 'Daily-life perks', icon: '🧳', name: 'Personal porter', price: 120, for: 'owner', stock: 2, text: 'A crewmate of your choice carries your bag once, airport to door.' },
  { id: 'drink', cat: 'Daily-life perks', icon: '🥂', name: 'The crew buys you a drink', price: 100, for: 'owner', stock: 4, text: 'One drink offered by the crew, at the moment you choose.' },
  // The big one
  { id: 'restart', cat: 'Legendary', icon: '🔁', name: 'Restart Vacation Wars', price: null, for: 'crew', stock: 1, text: 'Replay the whole game from the launch. Costs every coin the crew owns at the market opening — everyone must chip in.' },
];

export const marketItemById = (id) => MARKET_ITEMS.find((i) => i.id === id) || null;
