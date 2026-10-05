import { createInitialState } from './gameState';
import { clearSave, loadGame, saveGame } from './save';
import type { GameState } from './types';

/**
 * Single source of truth for the running game's state.
 *
 * Stored in a module-level variable (not a Phaser scene) so every scene reads and
 * writes the same object. Backed by localStorage via `save.ts`.
 */
let current: GameState | null = null;

export function getState(): GameState {
  if (!current) current = loadGame() ?? createInitialState();
  return current;
}

export function setState(state: GameState): void {
  current = state;
}

/** Persist the current game immediately. */
export function saveNow(): void {
  if (current) saveGame(current);
}

/** Wipe progress, clear the save, and start over from the initial day-1 state. */
export function resetState(): GameState {
  clearSave();
  current = createInitialState();
  return current;
}
