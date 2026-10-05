import type Phaser from 'phaser';
import { getOutfit } from '../config/outfits';
import {
  drawPixelMap,
  LINCOLN_MAP,
  LINCOLN_MAP_HEIGHT,
  LINCOLN_MAP_WIDTH,
  LINCOLN_PALETTE,
} from './pixelArt';

/** Lincoln's base sprite pixel size (one map cell). */
export const LINCOLN_PIXEL = 8;
export const LINCOLN_W = LINCOLN_MAP_WIDTH * LINCOLN_PIXEL;
export const LINCOLN_H = LINCOLN_MAP_HEIGHT * LINCOLN_PIXEL;

/**
 * Draw Lincoln plus his current outfit. `originX/originY` is the top-left of the
 * sprite; pass the same values you'd give the base pixel map.
 */
export function drawLincoln(
  graphics: Phaser.GameObjects.Graphics,
  originX: number,
  originY: number,
  pixel: number,
  outfitId: string,
): void {
  drawPixelMap(graphics, LINCOLN_MAP, LINCOLN_PALETTE, originX, originY, pixel);

  const outfit = getOutfit(outfitId);
  if (outfit.map.length === 0) return;

  const offset = (outfit.yOffset ?? 0) * pixel;
  drawPixelMap(graphics, outfit.map, outfit.palette, originX, originY + offset, pixel);
}
