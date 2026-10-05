import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { COLORS, FONT, FONT_MONO } from '../config';
import { SHOP_ITEMS, SHOP_UNLOCK_DAY } from '../config/shop';
import { hasItem } from '../state/gameState';
import { getState, saveNow } from '../state/store';

const ROW_X = 20;
const ROW_W = 440;
const ROW_H = 96;
const ROW_GAP = 10;
const ROW_TOP = 108;

/** Buy upgrades with coins earned from caring for Lincoln. */
export class ShopScene extends Phaser.Scene {
  private rowsLayer!: Phaser.GameObjects.Container;
  private coinsText!: Phaser.GameObjects.Text;

  constructor() {
    super('Shop');
  }

  create(): void {
    this.add.rectangle(0, 0, 480, 800, 0xf3e2c3, 1).setOrigin(0, 0).setDepth(0);

    const header = this.add.graphics().setDepth(10);
    header.fillStyle(COLORS.panel, 0.92);
    header.fillRoundedRect(10, 10, 460, 78, 14);

    this.add
      .text(24, 22, '🛒 Lincoln\'s Shop', {
        fontFamily: FONT, fontSize: '22px', color: '#f3e2c3', fontStyle: 'bold',
      })
      .setDepth(10);

    const state = getState();
    this.coinsText = this.add
      .text(446, 34, `🪙 ${state.coins}`, {
        fontFamily: FONT_MONO, fontSize: '20px', color: '#f6b23c', fontStyle: 'bold',
      })
      .setOrigin(1, 0.5)
      .setDepth(10);

    this.rowsLayer = this.add.container(0, 0).setDepth(5);
    this.renderRows();

    this.createButton(240, 730, 200, 60, 'Done', 0x6ba84f, () => this.leave());
  }

  private renderRows(): void {
    this.rowsLayer.removeAll(true);
    const state = getState();
    const locked = state.day < SHOP_UNLOCK_DAY;

    SHOP_ITEMS.forEach((item, index) => {
      const y = ROW_TOP + index * (ROW_H + ROW_GAP);
      const owned = hasItem(state, item.id);

      const bg = this.add.graphics();
      bg.fillStyle(0xffffff, 1);
      bg.fillRoundedRect(ROW_X, y, ROW_W, ROW_H, 14);
      bg.lineStyle(2, owned ? 0x9bd35a : 0xd9c7a6, 1);
      bg.strokeRoundedRect(ROW_X, y, ROW_W, ROW_H, 14);
      this.rowsLayer.add(bg);

      this.rowsLayer.add(
        this.add.text(ROW_X + 16, y + ROW_H / 2 - 20, item.icon, { fontSize: '30px' }).setOrigin(0, 0),
      );
      this.rowsLayer.add(
        this.add.text(ROW_X + 64, y + 16, item.name, {
          fontFamily: FONT, fontSize: '18px', color: '#3a2416', fontStyle: 'bold',
        }),
      );
      this.rowsLayer.add(
        this.add.text(ROW_X + 64, y + 44, item.description, {
          fontFamily: FONT, fontSize: '14px', color: '#6b5b46', wordWrap: { width: 240 },
        }),
      );

      if (owned) {
        this.rowsLayer.add(
          this.add
            .text(ROW_X + ROW_W - 20, y + ROW_H / 2, 'Owned ✓', {
              fontFamily: FONT, fontSize: '18px', color: '#4e8b3a', fontStyle: 'bold',
            })
            .setOrigin(1, 0.5),
        );
      } else {
        this.makeBuyButton(ROW_X + ROW_W - 84, y + ROW_H / 2, item.id, item.cost, locked || state.coins < item.cost);
      }
    });

    this.coinsText.setText(`🪙 ${state.coins}`);
  }

  private makeBuyButton(cx: number, cy: number, id: string, cost: number, disabled: boolean): void {
    const w = 128;
    const h = 48;
    const color = disabled ? 0xb9ac97 : 0xc98a2b;
    const container = this.add.container(cx, cy);
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    const text = this.add
      .text(0, 0, `🪙 ${cost}`, {
        fontFamily: FONT, fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      })
      .setOrigin(0.5);
    container.add([g, text]);
    container.setSize(w, h);
    container.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    container.on('pointerdown', () => {
      if (disabled) {
        // Explain why instead of dead silence on phones.
        audio.click();
        this.tweens.add({ targets: this.coinsText, scale: { from: 1.35, to: 1 }, duration: 220, ease: 'Quad.out' });
        return;
      }
      this.buy(id, cost);
    });
    this.rowsLayer.add(container);
  }

  private buy(id: string, cost: number): void {
    const state = getState();
    if (hasItem(state, id) || state.coins < cost) return;
    state.coins -= cost;
    state.owned.push(id);
    audio.coin();
    saveNow();
    this.renderRows();
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
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(-width / 2, -height / 2 + 5, width, height, 14);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    const text = this.add
      .text(0, 0, label, { fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    container.add([g, text]);
    container.setSize(width, height);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on('pointerdown', () => {
      container.setScale(0.95);
      this.time.delayedCall(90, () => container.setScale(1));
      onClick();
    });
  }
}
