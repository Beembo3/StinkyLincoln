import { ACTIONS, DECAY, MINUTES_PER_SECOND } from '../config';
import { rollWeather, weatherInfo } from '../config/weather';
import type { ActionKey, GameState, LincolnState, Mood } from './types';

export const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, value));

/** Move `current` toward `target` by at most `step`, without overshooting. */
const approach = (current: number, target: number, step: number): number =>
  current < target ? Math.min(target, current + step) : Math.max(target, current - step);

export function createInitialState(): GameState {
  return {
    lincoln: {
      hunger: 72,
      thirst: 68,
      fun: 64,
      energy: 80,
      cleanliness: 55,
      fatness: 0,
      mood: 'Neutral',
      bond: 10,
      outfit: 'none',
    },
    world: { roomMess: 12, waterLevel: 0, stinkMeter: 18 },
    minutesElapsed: 8 * 60, // start the day at 08:00
    day: 1,
    weather: 'sunny',
    rivalStink: 35,
    smellOffDay: 0,
    shampooHidden: false,
    coins: 0,
    owned: [],
    ending: null,
  };
}

export function moodFor(l: LincolnState): Mood {
  const avg = (l.hunger + l.thirst + l.fun + l.energy + l.cleanliness) / 5;
  // Neglect, grime and being stuffed to bursting all drag the mood down.
  const score =
    avg -
    (l.cleanliness < 35 ? 8 : 0) -
    (l.fun < 25 ? 5 : 0) -
    (l.fatness > 70 ? 6 : 0);
  if (score >= 72) return 'Happy';
  if (score >= 48) return 'Neutral';
  if (score >= 24) return 'Grumpy';
  return 'Furious';
}

/** Where the stink meter wants to sit, given how clean Lincoln is. */
export function computeStinkTarget(l: LincolnState): number {
  const threshold = 65;
  if (l.cleanliness >= threshold) return 0;
  return clamp(((threshold - l.cleanliness) / threshold) * 100);
}

/** Advance the simulation by `dt` real seconds. */
export function tick(state: GameState, dt: number): void {
  const l = state.lincoln;

  l.hunger = clamp(l.hunger - DECAY.hunger * dt);
  l.thirst = clamp(l.thirst - DECAY.thirst * dt);
  l.fun = clamp(l.fun - DECAY.fun * dt);
  l.energy = clamp(l.energy - DECAY.energy * dt);
  l.cleanliness = clamp(l.cleanliness - DECAY.cleanliness * weatherInfo(state.weather).cleanlinessDecay * dt);
  l.fatness = clamp(l.fatness - DECAY.fatness * dt);

  // Affection grows slowly when he's happy and erodes when he's miserable.
  const bondDrift = l.mood === 'Happy' ? 0.02 : l.mood === 'Furious' ? -0.06 : 0.005;
  l.bond = clamp(l.bond + bondDrift * dt);

  // Stink chases its target rather than snapping to it.
  state.world.stinkMeter = clamp(
    approach(state.world.stinkMeter, computeStinkTarget(l), 10 * dt),
  );

  l.mood = moodFor(l);

  // The rival's stink wanders on its own.
  state.rivalStink = clamp(state.rivalStink + (Math.random() - 0.5) * 12 * dt);

  state.minutesElapsed += dt * MINUTES_PER_SECOND;
  while (state.minutesElapsed >= 24 * 60) {
    state.minutesElapsed -= 24 * 60;
    state.day += 1;
    state.weather = rollWeather();
  }
}

/** Apply a player action's effects. Returns the toast text, or null for unknown actions. */
export function applyAction(state: GameState, key: ActionKey): string | null {
  const effect = ACTIONS[key];
  if (!effect) return null;

  const l = state.lincoln;
  l.hunger = clamp(l.hunger + (effect.hunger ?? 0));
  l.thirst = clamp(l.thirst + (effect.thirst ?? 0));
  l.fun = clamp(l.fun + (effect.fun ?? 0));
  l.energy = clamp(l.energy + (effect.energy ?? 0));
  l.cleanliness = clamp(l.cleanliness + (effect.cleanliness ?? 0));
  l.fatness = clamp(l.fatness + (effect.fatness ?? 0));
  l.bond = clamp(l.bond + (effect.bond ?? 0));

  const mess = (effect.mess ?? 0) * weatherInfo(state.weather).messGain;
  state.world.roomMess = clamp(state.world.roomMess + mess);
  l.mood = moodFor(l);

  return effect.toast;
}

export function formatClock(minutesElapsed: number): string {
  const total = Math.floor(minutesElapsed) % (24 * 60);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * If Lincoln has been stuffed to bursting, he POPS. Applies the messy fallout
 * and resets his belly. Returns true if a pop happened (so the scene can play it).
 */
export function popIfOverstuffed(state: GameState): boolean {
  const l = state.lincoln;
  if (l.fatness < 100) return false;

  l.fatness = 0;
  l.hunger = 12;
  l.energy = clamp(l.energy - 18);
  l.fun = clamp(l.fun - 8);
  l.cleanliness = clamp(l.cleanliness - 25);
  l.bond = clamp(l.bond - 3);
  state.world.roomMess = clamp(state.world.roomMess + 40);
  l.mood = moodFor(l);
  return true;
}

/** Is he dangerously close to popping? */
export function isAboutToPop(l: LincolnState): boolean {
  return l.fatness >= 85;
}

export function isNighttime(state: GameState): boolean {
  const hour = (state.minutesElapsed / 60) % 24;
  return hour >= 19 || hour < 7;
}

/**
 * Resolve a completed sleep: skip time (a night through to 7:00, or a 2-hour nap
 * in the day), apply the sleep effects, and award a bond bonus for the catch game.
 * Returns how many in-game minutes passed.
 */
export function resolveSleep(state: GameState, bondBonus = 0): number {
  let advanceMinutes: number;
  if (isNighttime(state)) {
    let toMorning = 7 * 60 - (state.minutesElapsed % (24 * 60));
    if (toMorning <= 0) toMorning += 24 * 60;
    advanceMinutes = toMorning;
  } else {
    advanceMinutes = 120;
  }

  const seconds = advanceMinutes / MINUTES_PER_SECOND;
  const step = 0.5;
  for (let t = 0; t < seconds; t += step) {
    tick(state, Math.min(step, seconds - t));
  }

  applyAction(state, 'sleep');
  state.lincoln.energy = Math.max(state.lincoln.energy, 88);
  if (bondBonus) state.lincoln.bond = clamp(state.lincoln.bond + bondBonus);
  return advanceMinutes;
}

export function hasItem(state: GameState, id: string): boolean {
  return state.owned.includes(id);
}

export function addCoins(state: GameState, amount: number): void {
  state.coins = Math.max(0, Math.round(state.coins + amount));
}

/** Pick the finale based on how the player raised him. */
export function determineEnding(state: GameState): 'bond' | 'clean' | 'stink' {
  const l = state.lincoln;
  if (l.bond >= 70) return 'bond';
  if (l.cleanliness >= 60) return 'clean';
  if (l.cleanliness <= 40) return 'stink';
  return 'bond';
}
