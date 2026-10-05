export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  cost: number;
  description: string;
}

/** The doc's five upgrades: Shampoo, Towels, Treats, Better Tub, Doggy Dad Jokes. */
export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'shampoo',
    name: 'Fancy Shampoo',
    icon: '🧴',
    cost: 30,
    description: 'Baths end cleaner (+4% cleanliness).',
  },
  {
    id: 'towels',
    name: 'Fluffy Towels',
    icon: '🧺',
    cost: 25,
    description: 'Soak up the chaos — halves bath mess & water.',
  },
  {
    id: 'treats',
    name: 'Treat Jar',
    icon: '🦴',
    cost: 20,
    description: 'Feeding fills him more and warms his heart.',
  },
  {
    id: 'tub',
    name: 'Deluxe Tub',
    icon: '🛁',
    cost: 40,
    description: 'No more failed baths — never lose cleanliness.',
  },
  {
    id: 'jokes',
    name: 'Doggy Dad Jokes',
    icon: '📖',
    cost: 15,
    description: 'Playing is funnier (+fun, +bond).',
  },
];

/** Shop opens once the player reaches this day (per the design doc). */
export const SHOP_UNLOCK_DAY = 5;
/** "Calm Down" is mastered at this day. */
export const CALM_UNLOCK_DAY = 10;
/** The finale arrives at this day. */
export const ENDING_DAY = 15;

export function getShopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}
