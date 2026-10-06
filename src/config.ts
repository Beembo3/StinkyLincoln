import type { ActionKey, Mood, StatKey } from './state/types';

/** Logical resolution. The canvas scales to fit while preserving this ratio. */
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

/** Where the back wall meets the floor. */
export const FLOOR_Y = 545;

/** In-game minutes that pass per real second. */
export const MINUTES_PER_SECOND = 2;

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_MONO = '"Consolas", "Courier New", monospace';

export const COLORS = {
  wall: 0xf3e2c3,
  wallDark: 0xe6d1ab,
  floor: 0xd8a878,
  floorDark: 0xc4915f,
  rug: 0xb56a5a,
  rugDark: 0x9c5548,

  brown: 0x8b5a2b,
  brownDark: 0x5b3a1e,
  brownLight: 0xc0854f,

  cream: 0xfff3de,
  ink: 0x3a2416,
  white: 0xffffff,

  water: 0x6fb7d6,
  waterDark: 0x4a95b8,

  good: 0x7bbf6a,
  warn: 0xe0a83a,
  danger: 0xd9534f,

  panel: 0x3a2416,
  panelLight: 0x5b3a1e,
  stink: 0x9aa87b,
  heart: 0xe0627c,
} as const;

export interface StatDef {
  key: StatKey;
  label: string;
  icon: string;
  color: number;
  /**
   * Which direction is dangerous. Cleanliness hurts when it's low; fatness
   * hurts when it's high (because that's when he pops).
   */
  dangerAt?: 'low' | 'high';
}

export const STAT_DEFS: StatDef[] = [
  { key: 'hunger', label: 'Food', icon: '🍖', color: 0xd98b3a },
  { key: 'thirst', label: 'Water', icon: '💧', color: 0x5aa9d6 },
  { key: 'fun', label: 'Fun', icon: '🎾', color: 0x7bbf6a },
  { key: 'energy', label: 'Energy', icon: '⚡', color: 0xe0c23a },
  { key: 'cleanliness', label: 'Clean', icon: '🧼', color: 0xb98ad6, dangerAt: 'low' },
  { key: 'fatness', label: 'Chonk', icon: '🎈', color: 0xe08a4a, dangerAt: 'high' },
];

/** Stat points lost per real second. Tuned so a full bar empties in a few minutes. */export const DECAY: Record<StatKey, number> = {
  hunger: 0.32,
  thirst: 0.4,
  fun: 0.45,
  energy: 0.18,
  cleanliness: 0.22,
  // Digestion: he slowly deflates if you stop feeding him.
  fatness: 0.28,
};

export interface ActionEffect {
  hunger?: number;
  thirst?: number;
  fun?: number;
  energy?: number;
  cleanliness?: number;
  fatness?: number;
  bond?: number;
  /** How much mess the action adds to the room. */
  mess?: number;
  icon: string;
  toast: string;
}

export const ACTIONS: Record<ActionKey, ActionEffect> = {
  feed: { hunger: 34, thirst: -4, fun: 4, cleanliness: -5, fatness: 18, bond: 1, mess: 8, icon: '🍖', toast: 'Yum!' },
  play: { fun: 32, energy: -16, thirst: -10, hunger: -4, cleanliness: -9, bond: 2, mess: 10, icon: '🎾', toast: 'Wheee!' },
  sleep: { energy: 45, hunger: -10, thirst: -8, cleanliness: -4, bond: 1, icon: '😴', toast: 'Zzz...' },
  pet: { fun: 8, bond: 4, icon: '💛', toast: 'Good boy!' },
  bath: { icon: '🛁', toast: 'Bath time!' },
  closet: { icon: '👕', toast: 'Looking good!' },
  shop: { icon: '🛒', toast: 'Welcome!' },
  calm: { icon: '🧘', toast: 'Breathe...' },
  rival: { icon: '🐾', toast: 'Smell-off!' },
  aid: { icon: '🩹', toast: 'Patched up!' },
};

/** Lincoln's face bubble, one emoji per mood. */
export const MOOD_EMOJI: Record<Mood, string> = {
  Happy: '😄',
  Neutral: '🙂',
  Grumpy: '😠',
  Furious: '😤',
};
