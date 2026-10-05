import Phaser from 'phaser';
import { COLORS, FONT } from '../config';

/**
 * A single labelled stat bar. Redraws only when the whole-number value changes.
 * Layout (local space, origin at the bar's vertical centre-left):
 *   [icon] [================ fill ================] [value]
 */
export class StatBar extends Phaser.GameObjects.Container {
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly valueText: Phaser.GameObjects.Text;
  private readonly barWidth: number;
  private readonly color: number;
  private readonly dangerAt?: 'low' | 'high';
  private lastPct = -1;

  private static readonly BAR_X = 26;
  private static readonly BAR_H = 16;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    barWidth: number,
    icon: string,
    color: number,
    dangerAt?: 'low' | 'high',
  ) {
    super(scene, x, y);
    this.barWidth = barWidth;
    this.color = color;
    this.dangerAt = dangerAt;

    const iconText = scene.add.text(0, 0, icon, { fontSize: '18px' }).setOrigin(0, 0.5);
    this.track = scene.add.graphics();
    this.valueText = scene.add
      .text(StatBar.BAR_X + barWidth - 8, 0, '100', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#fff3de',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5);

    this.add([iconText, this.track, this.valueText]);
    this.repaint(100);
    scene.add.existing(this);
  }

  repaint(value: number): void {
    const pct = Math.round(Phaser.Math.Clamp(value, 0, 100));
    if (pct === this.lastPct) return;
    this.lastPct = pct;

    const { BAR_X, BAR_H } = StatBar;
    const radius = BAR_H / 2;
    const g = this.track;
    g.clear();

    // Track
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(BAR_X, -BAR_H / 2, this.barWidth, BAR_H, radius);

    // Fill
    let fillColor = this.color;
    if (this.dangerAt === 'low') {
      fillColor = pct < 25 ? COLORS.danger : pct < 50 ? COLORS.warn : this.color;
    } else if (this.dangerAt === 'high') {
      fillColor = pct >= 85 ? COLORS.danger : pct >= 65 ? COLORS.warn : this.color;
    }
    const fillWidth = ((this.barWidth - 4) * pct) / 100;
    if (fillWidth > 0) {
      g.fillStyle(fillColor, 1);
      g.fillRoundedRect(BAR_X + 2, -BAR_H / 2 + 2, fillWidth, BAR_H - 4, Math.max(2, radius - 2));
    }

    this.valueText.setText(String(pct));
  }
}
