import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { audio } from '../audio/audio';
import { getState } from '../state/store';

/**
 * Playground hub (Pou-style Game Room).
 * Replaces the old instant "+fun" Play button with a picker for mini-games.
 * Room stays paused underneath; each game pauses this hub while it runs.
 */
export class PlayScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('Play');
  }

  create(): void {
    this.layer = this.add.container(0, 0).setDepth(10);
    this.drawPark();

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.94);
    panel.fillRoundedRect(30, 110, GAME_WIDTH - 60, 552, 18);
    panel.lineStyle(3, COLORS.brownLight, 0.6);
    panel.strokeRoundedRect(30, 110, GAME_WIDTH - 60, 552, 18);
    this.layer.add(panel);

    const state = getState();
    const title = this.add
      .text(GAME_WIDTH / 2, 164, '🎾 Playground!', {
        fontFamily: FONT, fontSize: '30px', color: '#fff3de', fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(
        GAME_WIDTH / 2, 206,
        `Fun ${Math.round(state.lincoln.fun)}% · Energy ${Math.round(state.lincoln.energy)}% · 🪙 ${state.coins}\nPick a game — scores earn fun + coins!`,
        { fontFamily: FONT, fontSize: '15px', color: '#d9c7a6', align: 'center', lineSpacing: 6 },
      )
      .setOrigin(0.5, 0);
    this.layer.add([title, sub]);

    this.gameCard(240, 330, '🧺 Treat Toss', 'Catch snacks, dodge mud!', 0x6ba84f, 'Treat');
    this.gameCard(240, 440, '🚧 Fence Hop', 'Tap ◀ ▶ to climb!', 0x5b7fb0, 'Fence');
    this.gameCard(240, 550, '💦 Puddle Dodge', 'Jump puddles, grab bones!', 0x4aa3c7, 'Puddle');
    this.makeButton(240, 632, 200, 50, '← Back', 0x6b5b46, () => this.leave());
  }

  private drawPark(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x9fd4e8, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0xf4d35e, 1);
    g.fillCircle(400, 90, 30);
    g.fillStyle(0x6ba84f, 1);
    g.fillRect(0, 620, GAME_WIDTH, GAME_HEIGHT - 620);
    g.fillStyle(0xffffff, 1);
    for (let x = 8; x < GAME_WIDTH; x += 44) g.fillRect(x, 550, 14, 70);
    g.fillRect(0, 550, GAME_WIDTH, 10);
    g.fillRect(0, 586, GAME_WIDTH, 10);
  }

  private gameCard(x: number, y: number, title: string, hint: string, color: number, scene: string): void {
    const c = this.add.container(x, y);
    const w = 340;
    const h = 92;
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 14);
    const bg = this.add.rectangle(0, 0, w, h, color).setInteractive({ useHandCursor: true });
    const face = this.add.graphics();
    face.fillStyle(color, 1);
    face.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    face.lineStyle(3, COLORS.cream, 0.25);
    face.strokeRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 12);
    const t = this.add
      .text(0, -14, title, { fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    const s = this.add
      .text(0, 18, hint, { fontFamily: FONT, fontSize: '14px', color: '#ffffff' })
      .setOrigin(0.5);
    c.add([shadow, bg, face, t, s]);
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      c.setScale(0.96);
      this.openGame(scene);
    });
    bg.on('pointerup', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      c.setScale(1);
    });
    this.layer.add(c);
  }

  private openGame(scene: string): void {
    if (this.scene.isActive(scene)) return;
    audio.click();
    this.scene.launch(scene);
    this.scene.pause();
  }

  private makeButton(
    x: number, y: number, w: number, h: number, label: string, color: number, onClick: () => void,
  ): void {
    const c = this.add.container(x, y);
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 14);
    const bg = this.add.rectangle(0, 0, w, h, color).setInteractive({ useHandCursor: true });
    const face = this.add.graphics();
    face.fillStyle(color, 1);
    face.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    face.lineStyle(3, COLORS.cream, 0.25);
    face.strokeRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 12);
    const t = this.add
      .text(0, 0, label, { fontFamily: FONT, fontSize: '19px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    c.add([shadow, bg, face, t]);
    let fired = false;
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      fired = true;
      c.setScale(0.95);
      onClick();
    });
    bg.on('pointerup', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      c.setScale(1);
      if (!fired) onClick();
      fired = false;
    });
    this.layer.add(c);
  }

  private leave(): void {
    audio.click();
    this.scene.stop();
    this.scene.resume('Room');
  }
}
