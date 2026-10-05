import { createInitialState, tick } from './gameState';
import type { GameState } from './types';

const SAVE_KEY = 'stinky-lincoln-save-v1';

/**
 * Caps how much time-away is simulated on load. Without this, coming back after
 * a week would leave Lincoln a starving, filthy wreck. 180s ≈ 6 in-game hours.
 */
const OFFLINE_CAP_SECONDS = 180;

interface SaveBlob {
  version: 1;
  savedAt: number;
  state: GameState;
}

export function saveGame(state: GameState): void {
  try {
    const blob: SaveBlob = { version: 1, savedAt: Date.now(), state };
    localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
  } catch {
    // Storage can be unavailable (private mode, quota) — persistence is best-effort.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Load the saved game (if any), advance it for the time spent away, and return it.
 * Returns null when there's nothing valid to load.
 */
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const blob = JSON.parse(raw) as Partial<SaveBlob>;
    if (!blob.state) return null;

    const state = normalizeState(blob.state);
    const elapsedSeconds = Math.min(
      Math.max(0, (Date.now() - (blob.savedAt ?? Date.now())) / 1000),
      OFFLINE_CAP_SECONDS,
    );
    advance(state, elapsedSeconds);
    return state;
  } catch {
    return null;
  }
}

/** Simulate `seconds` of elapsed time in small steps so nothing overshoots. */
function advance(state: GameState, seconds: number): void {
  const step = 0.5;
  for (let t = 0; t < seconds; t += step) {
    tick(state, Math.min(step, seconds - t));
  }
}

/** Fill in any missing fields from a partial/legacy save so old saves keep working. */
function normalizeState(partial: GameState): GameState {
  const base = createInitialState();
  return {
    lincoln: { ...base.lincoln, ...partial.lincoln },
    world: { ...base.world, ...partial.world },
    minutesElapsed: partial.minutesElapsed ?? base.minutesElapsed,
    day: partial.day ?? base.day,
    weather: partial.weather ?? base.weather,
    rivalStink: partial.rivalStink ?? base.rivalStink,
    smellOffDay: partial.smellOffDay ?? base.smellOffDay,
    shampooHidden: partial.shampooHidden ?? base.shampooHidden,
    coins: partial.coins ?? base.coins,
    owned: Array.isArray(partial.owned) ? partial.owned : base.owned,
    ending: partial.ending ?? base.ending,
  };
}
