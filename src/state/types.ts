export type Mood = 'Happy' | 'Neutral' | 'Grumpy' | 'Furious';

/** Lincoln's own needs. All values are 0–100, where 100 = fully satisfied. */
export interface LincolnState {
  hunger: number;
  thirst: number;
  fun: number;
  energy: number;
  /** The hard one. Drops like the others, but is a pain to raise. */
  cleanliness: number;
  /** How stuffed he is (0–100). Feeds him into a blimp; hits 100 and he POPS. */
  fatness: number;
  mood: Mood;
  /** Grows as you care for him (clean or dirty). */
  bond: number;
  /** Selected outfit id from the Closet. */
  outfit: string;
}

/** Everything about the room / world around Lincoln. All values 0–100. */
export interface WorldState {
  roomMess: number;
  waterLevel: number;
  /** Rises as cleanliness dips. Feeds the stink cloud visual. */
  stinkMeter: number;
}

export interface GameState {
  lincoln: LincolnState;
  world: WorldState;
  /** Minutes since midnight, in game time. */
  minutesElapsed: number;
  day: number;
  /** Today's weather (re-rolls each day). */
  weather: string;
  /** The rival pet's stink, for the smell-off. */
  rivalStink: number;
  /** Last day a smell-off reward was collected, so it can't be farmed. */
  smellOffDay: number;
  /** True while Lincoln has hidden the shampoo (his revenge). */
  shampooHidden: boolean;
  /** Shop currency earned by caring for Lincoln. */
  coins: number;
  /** Purchased shop item ids. */
  owned: string[];
  /** Which ending was reached (null until the finale). */
  ending: string | null;
}

export type StatKey = 'hunger' | 'thirst' | 'fun' | 'energy' | 'cleanliness' | 'fatness';
export type ActionKey = 'feed' | 'play' | 'sleep' | 'pet' | 'bath' | 'closet' | 'shop' | 'calm' | 'rival';
