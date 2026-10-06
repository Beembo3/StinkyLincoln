import Phaser from 'phaser';
import { COLORS, FONT } from '../config';
import { OUTFITS } from '../config/outfits';
import { audio } from '../audio/audio';
import { getState, saveNow } from '../state/store';
import { drawLincoln } from '../ui/lincoln';

const PREVIEW_PIXEL = 3;
const COLS = 3;
const CELL_W = 144;
const CELL_H = 136;
const GAP = 8;
const START_X = 16;
const START_Y = 100;

/**
 * Lincoln's wardrobe. A grid of outfit previews; tap one to wear it. Overlays the
 * (paused) room; the room re-draws Lincoln with the new outfit when it resumes.
 */
export class ClosetScene extends Phaser.Scene {
  private readonly frames = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly centers = new Map<string, { x: number; y: number }>();

  constructor() {
    super('Closet');
  }

  create(): void {
    this.add.rectangle(0, 0, 480, 800, 0xf3e2c3, 1).setOrigin(0, 0).setDepth(0);

    const header = this.add.graphics().setDepth(10);
    header.fillStyle(COLORS.panel, 0.92);
    header.fillRoundedRect(10, 10, 460, 78, 14);

    this.add
      .text(24, 22, "👕 Lincoln's Closet", {
        fontFamily: FONT, fontSize: '22px', color: '#f3e2c3', fontStyle: 'bold',
      })
      .setDepth(10);
    this.add
      .text(24, 54, 'Tap an outfit to wear it', {
        fontFamily: FONT, fontSize: '14px', color: '#d9c7a6',
      })
      .setDepth(10);

    OUTFITS.forEach((outfit, index) => {
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const cx = START_X + col * (CELL_W + GAP) + CELL_W / 2;
      const cy = START_Y + row * (CELL_H + GAP) + CELL_H / 2;
      this.createCell(cx, cy, outfit.id, outfit.name);
    });

    this.createButton(240, 742, 200, 60, 'Done', 0x6ba84f, () => this.leave());
    this.refreshSelection();
  }

  private createCell(cx: number, cy: number, id: string, name: string): void {
    this.centers.set(id, { x: cx, y: cy });

    const frame = this.add.graphics().setDepth(1);
    this.frames.set(id, frame);

    const art = this.add.graphics().setDepth(2);
    drawLincoln(art, cx - 24, cy - 14, PREVIEW_PIXEL, id);

    this.add
      .text(cx, cy + 58, name, {
        fontFamily: FONT, fontSize: '14px', color: '#3a2416', fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(2);

    const zone = this.add.zone(cx, cy, CELL_W, CELL_H).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.equip(id));
  }

  private refreshSelection(): void {
    const selected = getState().lincoln.outfit;
    for (const [id, frame] of this.frames) {
      const center = this.centers.get(id);
      if (!center) continue;
      const x = center.x - CELL_W / 2;
      const y = center.y - CELL_H / 2;
      const active = id === selected;

      frame.clear();
      frame.fillStyle(active ? 0xf4d35e : 0xffffff, active ? 0.6 : 1);
      frame.fillRoundedRect(x, y, CELL_W, CELL_H, 12);
      frame.lineStyle(active ? 4 : 2, active ? 0xc98a2b : 0xd9c7a6, active ? 1 : 0.8);
      frame.strokeRoundedRect(x, y, CELL_W, CELL_H, 12);
    }
  }

  private equip(id: string): void {
    getState().lincoln.outfit = id;
    audio.equip();
    saveNow();
    this.refreshSelection();
  }

  private leave(): void {
    audio.click();
    this.scene.stop();
    this.scene.resume('Room');
  }

  private createButton(
    x: number, y: number, width: number, height: number, label: string, color: number, onClick: () => void,
  ): void {
    const container = this.add.container(x, y).setDepth(10);
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillRoundedRect(-width / 2, -height / 2 + 5, width, height, 14);
    const bg = this.add.rectangle(0, 0, width, height, color);
    bg.setInteractive({ useHandCursor: true });
    const face = this.add.graphics();
    face.fillStyle(color, 1);
    face.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    const text = this.add
      .text(0, 0, label, { fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    container.add([shadow, bg, face, text]);
    container.setSize(width, height);
    let downFired = false;
    bg.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      downFired = true;
      container.setScale(0.95);
      onClick();
    });
    bg.on('pointerup', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      container.setScale(1);
      if (!downFired) onClick();
      downFired = false;
    });
    bg.on('pointerupoutside', () => {
      downFired = false;
      container.setScale(1);
    });
  }
}
