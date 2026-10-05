import Phaser from 'phaser';

/**
 * Lincoln's placeholder sprite, drawn as a pixel map.
 * Legend: B brown · D dark brown · W cream · K ink · P pink tongue · . empty
 * Real sprite sheets will replace this in a later phase.
 */
export const LINCOLN_MAP: string[] = [
  '................',
  '..DDBBBBBBBBBDD..',
  '.BBBBBBBBBBBBBB.',
  '.BBBBBBBBBBBBBB.',
  '.BBBBKKBBKKBBBB.',
  '.BBBBKKBBKKBBBB.',
  '.BBBBWWWWWWBBBB.',
  '.BBBBWWKKWWBBBB.',
  '.BBBBWWWWWWBBBB.',
  '.BBBBWWPPWWBBBB.',
  '...BBBWWWWBBB...',
  '..BBBBWWWWBBBB..',
  '..BBBBWWWWBBBB..',
  '..BBBBWWWWBBBB..',
  '..BWWBBBBBBWWB..',
  '...WWBBBBBBWW...',
];

export const LINCOLN_PALETTE: Record<string, number> = {
  B: 0x8b5a2b,
  D: 0x5b3a1e,
  W: 0xfff3de,
  K: 0x2b1b0e,
  P: 0xe08a8a,
};

export const LINCOLN_MAP_WIDTH = LINCOLN_MAP[0]?.length ?? 0;
export const LINCOLN_MAP_HEIGHT = LINCOLN_MAP.length;

/** Stamp a pixel map onto a graphics object. */
export function drawPixelMap(
  graphics: Phaser.GameObjects.Graphics,
  map: string[],
  palette: Record<string, number>,
  originX: number,
  originY: number,
  pixel: number,
): void {
  for (let row = 0; row < map.length; row++) {
    const line = map[row] ?? '';
    for (let col = 0; col < line.length; col++) {
      const color = palette[line[col] as string];
      if (color === undefined) continue;
      graphics.fillStyle(color, 1);
      graphics.fillRect(originX + col * pixel, originY + row * pixel, pixel, pixel);
    }
  }
}
