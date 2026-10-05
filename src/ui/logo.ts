import type Phaser from 'phaser';
import { FONT } from '../config';
import { drawLincoln, LINCOLN_PIXEL, LINCOLN_W } from './lincoln';

/**
 * Draws the Stinky Lincoln logo: a wooden sign with gold lettering, a bone, a paw
 * print, flowers/leaves and Lincoln peeking over the top.
 *
 * To use the real PNG instead, drop it in `public/logo.png` and set
 * `USE_LOGO_IMAGE = true` in BootScene.
 */
export function createLogo(scene: Phaser.Scene, cx: number, cy: number, scale = 1): Phaser.GameObjects.Container {
  const container = scene.add.container(cx, cy).setScale(scale);
  const g = scene.add.graphics();

  const signW = 380;
  const signH = 190;

  // Lincoln peeking out from behind the sign (drawn first, sign covers the rest).
  const peek = scene.add.graphics();
  const peekPixel = 4;
  const peekW = LINCOLN_W / LINCOLN_PIXEL * peekPixel;
  drawLincoln(peek, -peekW / 2, -signH / 2 - peekW + 14, peekPixel, 'none');
  container.add(peek);

  // Wooden sign
  g.fillStyle(0x7a4a1e, 1);
  g.fillRoundedRect(-signW / 2 - 5, -signH / 2 - 5, signW + 10, signH + 10, 22);
  g.fillStyle(0xb5722f, 1);
  g.fillRoundedRect(-signW / 2, -signH / 2, signW, signH, 18);
  g.fillStyle(0xc9853f, 1);
  g.fillRoundedRect(-signW / 2 + 10, -signH / 2 + 10, signW - 20, signH - 20, 12);

  // Wood grain
  g.lineStyle(3, 0xa5622a, 0.5);
  for (let i = 0; i < 6; i++) {
    const y = -signH / 2 + 24 + i * 28;
    g.beginPath();
    g.moveTo(-signW / 2 + 16, y);
    g.lineTo(signW / 2 - 16, y + (i % 2 === 0 ? 4 : -4));
    g.strokePath();
  }
  // Knot
  g.fillStyle(0x8a4f22, 0.6);
  g.fillEllipse(signW / 2 - 46, -signH / 2 + 40, 16, 10);

  // Flowers + leaves at the corners
  drawLeaf(g, -signW / 2 - 6, -signH / 2 + 6, -0.5);
  drawLeaf(g, signW / 2 + 6, -signH / 2 + 6, 0.5);
  drawFlower(g, -signW / 2 + 8, signH / 2 - 30);
  drawFlower(g, signW / 2 - 10, signH / 2 - 34);

  // Bone + paw print
  drawBone(g, -30, signH / 2 - 18, 1);
  drawPaw(g, signW / 2 - 60, signH / 2 - 40, 0.9);
  container.add(g);

  // Lettering
  const makeWord = (text: string, y: number, size: number): Phaser.GameObjects.Text =>
    scene.add
      .text(0, y, text, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color: '#f6b23c',
        fontStyle: 'bold',
        stroke: '#5b3a1e',
        strokeThickness: 9,
      })
      .setOrigin(0.5);

  container.add([makeWord('Stinky', -34, 52), makeWord('Lincoln', 30, 52)]);

  return container;
}

function drawLeaf(g: Phaser.GameObjects.Graphics, x: number, y: number, rot: number): void {
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(rot);
  g.fillStyle(0x4a8b3a, 1);
  g.fillEllipse(0, 0, 34, 16);
  g.fillStyle(0x3d7530, 1);
  g.fillEllipse(-6, 0, 12, 6);
  g.restore();
}

function drawFlower(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.fillStyle(0xfdf3d6, 1);
    g.fillCircle(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7);
  }
  g.fillStyle(0xf6b23c, 1);
  g.fillCircle(x, y, 6);
}

function drawBone(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.fillStyle(0xfdf3d6, 1);
  g.fillRoundedRect(x - 26 * s, y - 7 * s, 52 * s, 14 * s, 6 * s);
  g.fillCircle(x - 26 * s, y - 7 * s, 9 * s);
  g.fillCircle(x - 26 * s, y + 7 * s, 9 * s);
  g.fillCircle(x + 26 * s, y - 7 * s, 9 * s);
  g.fillCircle(x + 26 * s, y + 7 * s, 9 * s);
}

function drawPaw(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.fillStyle(0x5b3a1e, 1);
  g.fillEllipse(x, y + 10 * s, 34 * s, 28 * s);
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI * 0.85 + (i / 3) * Math.PI * 0.7;
    g.fillCircle(x + Math.cos(a) * 20 * s, y - 14 * s + Math.sin(a) * 8 * s, 7 * s);
  }
}
