import Phaser from 'phaser';
import { FONT } from '../config';
import { resetState, saveNow, getState } from '../state/store';

interface EndingInfo {
  emoji: string;
  title: string;
  color: number;
  body: string;
}

const ENDINGS: Record<string, EndingInfo> = {
  clean: {
    emoji: '🏆',
    title: 'Squeaky Clean',
    color: 0x5aa9d6,
    body: 'You mastered the bath struggle. Lincoln is gleaming,\nand only mildly traumatised.',
  },
  stink: {
    emoji: '💀',
    title: 'Legendary Stink',
    color: 0x9aa87b,
    body: 'You surrendered to the smell. The house will never\nbe the same. He is, at least, very happy.',
  },
  bond: {
    emoji: '💛',
    title: 'True Bond',
    color: 0xf6b23c,
    body: 'You loved him dirty or clean. Some things matter more\nthan a bath. He is your good boy.',
  },
};

/** The finale, reached on Day 15. */
export class EndingScene extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  create(): void {
    const state = getState();
    const info = ENDINGS[state.ending ?? 'bond'] ?? ENDINGS.bond;

    this.add.rectangle(0, 0, 480, 800, 0x241708, 1).setOrigin(0, 0).setDepth(0);
    const glow = this.add.graphics().setDepth(1);
    glow.fillStyle(info.color, 0.18);
    glow.fillCircle(240, 300, 220);

    this.add.text(240, 150, info.emoji, { fontSize: '72px' }).setOrigin(0.5).setDepth(5);
    this.add
      .text(240, 244, info.title, {
        fontFamily: FONT, fontSize: '36px', color: '#fff3de', fontStyle: 'bold',
        stroke: '#3a2416', strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.add
      .text(240, 320, info.body, {
        fontFamily: FONT, fontSize: '17px', color: '#d9c7a6', align: 'center', lineSpacing: 6,
      })
      .setOrigin(0.5)
      .setDepth(5);

    const stats = [
      `Days together: ${state.day - 1}`,
      `Bond: ${Math.round(state.lincoln.bond)}%`,
      `Cleanliness: ${Math.round(state.lincoln.cleanliness)}%`,
      `🪙 Coins: ${state.coins}`,
    ];
    stats.forEach((line, i) => {
      this.add
        .text(240, 420 + i * 30, line, { fontFamily: FONT, fontSize: '16px', color: '#f3e2c3' })
        .setOrigin(0.5)
        .setDepth(5);
    });

    this.createButton(240, 610, 260, 64, 'A new day, a new dog', 0x6ba84f, () => {
      resetState();
      saveNow();
      this.scene.get('Room').scene.restart();
      this.scene.stop();
    });
    this.createButton(240, 690, 220, 52, 'Keep playing', 0x6b5b46, () => {
      this.scene.stop();
      this.scene.resume('Room');
    });
  }

  private createButton(
    x: number, y: number, width: number, height: number, label: string, color: number, onClick: () => void,
  ): void {
    const container = this.add.container(x, y).setDepth(10);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-width / 2, -height / 2 + 5, width, height, 14);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    const text = this.add
      .text(0, 0, label, { fontFamily: FONT, fontSize: '20px', color: '#ffffff', fontStyle: 'bold' })
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
