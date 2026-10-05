import Phaser from 'phaser';
import { COLORS, FONT, FONT_MONO, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { audio } from '../audio/audio';
import { clamp, resolveSleep } from '../state/gameState';
import { getState, saveNow } from '../state/store';
import { drawLincoln, LINCOLN_H, LINCOLN_PIXEL, LINCOLN_W } from '../ui/lincoln';

type Stage = 'menu' | 'chase' | 'done';

interface Difficulty {
  key: string;
  label: string;
  color: number;
  speed: number;
  dashMin: number;
  dashMax: number;
  captures: number;
  /** Half-width of the grab zone (hands sit at ±tolerance). */
  tolerance: number;
  snapCooldown: number;
  bondBonus: number;
}

const DIFFICULTIES: Difficulty[] = [
  { key: 'easy', label: 'Easy', color: 0x6ba84f, speed: 110, dashMin: 1700, dashMax: 2600, captures: 1, tolerance: 95, snapCooldown: 450, bondBonus: 1 },
  { key: 'normal', label: 'Normal', color: 0x5b7fb0, speed: 160, dashMin: 1200, dashMax: 2000, captures: 2, tolerance: 72, snapCooldown: 600, bondBonus: 3 },
  { key: 'hard', label: 'Hard', color: 0xc0392b, speed: 215, dashMin: 850, dashMax: 1500, captures: 3, tolerance: 55, snapCooldown: 750, bondBonus: 5 },
];

const FLOOR_FEET_Y = 640;
const CHASE_MIN_X = 90;
const CHASE_MAX_X = 390;
const HAND_Y = 600;

/**
 * "Bedtime zoomies" — Lincoln bolts around the house before bed. You move a pair
 * of hands and snap them shut when he's between them. Difficulty changes his speed,
 * the grab window and how many grabs he needs. Catching him tucks him in for the night.
 */
export class SleepScene extends Phaser.Scene {
  private stage: Stage = 'menu';
  private diff: Difficulty = DIFFICULTIES[0];

  private backLayer!: Phaser.GameObjects.Container;
  private stageLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;

  private lincoln!: Phaser.GameObjects.Container;
  private hands!: Phaser.GameObjects.Container;
  private leftHand!: Phaser.GameObjects.Container;
  private rightHand!: Phaser.GameObjects.Container;

  private lincolnX = 240;
  private lincolnVX = 150;
  private hopT = 1;
  private bob = 0;

  private pincerX = 240;
  private targetPincerX = 240;
  private baseGap = 144;
  private handGap = 144;

  private capturesDone = 0;
  private nextDashAt = 0;
  private snapReadyAt = 0;
  private chaseStart = 0;
  private canSnap = true;

  private readonly furniture = [130, 240, 350];

  private titleText!: Phaser.GameObjects.Text;
  private subText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private pips!: Phaser.GameObjects.Graphics;

  private leftKey?: Phaser.Input.Keyboard.Key;
  private rightKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Sleep');
  }

  create(): void {
    this.stage = 'menu';
    this.capturesDone = 0;
    this.bob = 0;
    this.hopT = 1;
    this.pincerX = 240;
    this.targetPincerX = 240;
    this.canSnap = true;

    this.drawHouse();
    this.backLayer = this.add.container(0, 0).setDepth(1);
    this.lincoln = this.add.container(0, 0).setDepth(5);
    const art = this.add.graphics();
    drawLincoln(art, -LINCOLN_W / 2, -LINCOLN_H, LINCOLN_PIXEL, getState().lincoln.outfit);
    this.lincoln.add(art);
    this.lincoln.setVisible(false);

    this.hands = this.add.container(0, 0).setDepth(8).setVisible(false);
    this.createHands();

    this.stageLayer = this.add.container(0, 0).setDepth(10);
    this.uiLayer = this.add.container(0, 0).setDepth(20);

    this.createStatus();
    this.createKeys();
    this.showMenu();

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.stage === 'chase') this.targetPincerX = pointer.worldX;
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.stage !== 'chase') return;
      // On touch, taps reposition the hands; snapping is via the SNAP
      // button (otherwise every reposition fires a snap). On desktop,
      // clicks still snap directly.
      this.targetPincerX = pointer.worldX;
      if (!this.sys.game.device.input.touch) this.trySnap();
    });
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.bob += dt * 3;
    if (this.stage === 'chase') this.updateChase(dt);
    this.updateLincolnVisual();
    this.updateHands();
  }

  // ── Scenery ─────────────────────────────────────────────────────────────

  private drawHouse(): void {
    const g = this.add.graphics().setDepth(0);

    // Hallway wall
    g.fillStyle(0x6f5b46, 1);
    g.fillRect(0, 0, GAME_WIDTH, FLOOR_FEET_Y + 10);
    g.fillStyle(0x5f4c39, 1);
    g.fillRect(0, 0, GAME_WIDTH, 90);

    // Three doors
    for (const dx of [70, 240, 410]) {
      g.fillStyle(0x533f2e, 1);
      g.fillRoundedRect(dx - 40, 150, 80, 300, { tl: 10, tr: 10, bl: 0, br: 0 });
      g.fillStyle(0x7a5a3c, 1);
      g.fillRoundedRect(dx - 32, 162, 64, 288, { tl: 8, tr: 8, bl: 0, br: 0 });
      g.fillStyle(0xf4d35e, 1);
      g.fillCircle(dx + 20, 320, 6);
    }

    // Floor
    g.fillStyle(0x8a5a2b, 1);
    g.fillRect(0, FLOOR_FEET_Y, GAME_WIDTH, GAME_HEIGHT - FLOOR_FEET_Y);
    g.fillStyle(0x734a22, 1);
    for (let x = 0; x < GAME_WIDTH; x += 60) g.fillRect(x, FLOOR_FEET_Y, 4, GAME_HEIGHT - FLOOR_FEET_Y);

    // Runner rug
    g.fillStyle(0xb56a5a, 1);
    g.fillRoundedRect(40, FLOOR_FEET_Y + 26, GAME_WIDTH - 80, 90, 20);
    g.fillStyle(0x9c5548, 1);
    g.fillRoundedRect(60, FLOOR_FEET_Y + 40, GAME_WIDTH - 120, 62, 16);
  }

  private createHands(): void {
    this.leftHand = this.buildHand();
    this.rightHand = this.buildHand();
    this.rightHand.setScale(-1, 1);
    this.hands.add([this.leftHand, this.rightHand]);
  }

  private buildHand(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    const skin = 0xf0c9a0;
    const line = 0xc79a72;
    // Fingers
    for (let i = 0; i < 4; i++) {
      g.fillStyle(skin, 1);
      g.fillRoundedRect(-15 + i * 9, -46, 8, 34, 4);
      g.lineStyle(2, line, 1);
      g.strokeRoundedRect(-15 + i * 9, -46, 8, 34, 4);
    }
    // Palm
    g.fillStyle(skin, 1);
    g.fillRoundedRect(-19, -16, 38, 46, 14);
    g.lineStyle(2, line, 1);
    g.strokeRoundedRect(-19, -16, 38, 46, 14);
    // Thumb
    g.fillStyle(skin, 1);
    g.fillRoundedRect(14, -4, 16, 22, 7);
    c.add(g);
    return c;
  }

  private updateHands(): void {
    if (!this.hands.visible) return;
    this.hands.setPosition(this.pincerX, HAND_Y);
    this.leftHand.setPosition(-this.handGap / 2, 0);
    this.rightHand.setPosition(this.handGap / 2, 0);
  }

  private updateLincolnVisual(): void {
    if (!this.lincoln.visible) return;
    const hop = Math.sin(this.hopT * Math.PI) * 46;
    const idle = Math.sin(this.bob) * 3;
    const fat = clamp(getState().lincoln.fatness / 100, 0, 1);
    this.lincoln.setPosition(this.lincolnX, FLOOR_FEET_Y - hop + idle);
    this.lincoln.setScale(1 + fat * 0.5, 1 + fat * 0.28);
  }

  // ── Status ──────────────────────────────────────────────────────────────

  private createStatus(): void {
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.85);
    panel.fillRoundedRect(10, 10, GAME_WIDTH - 20, 80, 14);
    this.titleText = this.add.text(24, 20, '', {
      fontFamily: FONT, fontSize: '20px', color: '#f3e2c3', fontStyle: 'bold',
    });
    this.timerText = this.add
      .text(GAME_WIDTH - 24, 20, '', { fontFamily: FONT_MONO, fontSize: '18px', color: '#f3e2c3' })
      .setOrigin(1, 0);
    this.subText = this.add.text(24, 52, '', { fontFamily: FONT, fontSize: '14px', color: '#d9c7a6' });
    this.pips = this.add.graphics();
    this.uiLayer.add([panel, this.titleText, this.timerText, this.subText, this.pips]);
  }

  private updatePips(): void {
    this.pips.clear();
    const needed = this.diff.captures;
    const startX = GAME_WIDTH - 30 - (needed - 1) * 22;
    for (let i = 0; i < needed; i++) {
      const x = startX + i * 22;
      this.pips.fillStyle(i < this.capturesDone ? 0x9bd35a : 0x000000, i < this.capturesDone ? 1 : 0.35);
      this.pips.fillCircle(x, 62, 8);
      this.pips.lineStyle(2, 0xf3e2c3, 0.7);
      this.pips.strokeCircle(x, 62, 8);
    }
  }

  // ── Menu ────────────────────────────────────────────────────────────────

  private showMenu(): void {
    this.stage = 'menu';
    this.lincoln.setVisible(false);
    this.hands.setVisible(false);
    this.titleText.setText('🌙 Bedtime Zoomies!');
    this.timerText.setText('');
    this.subText.setText('Catch Lincoln before bed. Tap / click to snap your hands shut.');
    this.pips.clear();

    let y = 300;
    for (const diff of DIFFICULTIES) {
      this.createButton(240, y, 260, 74, `${diff.label} · ${diff.captures} grab${diff.captures > 1 ? 's' : ''}`, diff.color, () =>
        this.startChase(diff),
      );
      y += 96;
    }

    this.createButton(240, y + 10, 200, 56, 'Never mind', 0x6b5b46, () => this.leave());
  }

  // ── Chase ───────────────────────────────────────────────────────────────

  private startChase(diff: Difficulty): void {
    this.diff = diff;
    this.stage = 'chase';
    this.stageLayer.removeAll(true);
    this.capturesDone = 0;
    this.chaseStart = this.time.now;
    this.nextDashAt = this.time.now + 600;
    this.snapReadyAt = this.time.now + 350;
    this.canSnap = true;
    this.lincolnX = 240;
    this.lincolnVX = diff.speed;
    this.pincerX = 240;
    this.targetPincerX = 240;
    this.baseGap = diff.tolerance * 2;
    this.handGap = this.baseGap;

    this.drawFurniture();
    this.lincoln.setVisible(true);
    this.hands.setVisible(true);
    this.titleText.setText(`Catch him! · ${diff.label}`);
    this.subText.setText('Move with pointer / ← → · snap with tap / Space');
    this.updatePips();
    this.banner('Ready... GO!');
    if (this.sys.game.device.input.touch) {
      this.createButton(240, 730, 240, 68, '👏 SNAP!', 0xc98a2b, () => this.trySnap());
    }
  }

  private drawFurniture(): void {
    const g = this.add.graphics();
    for (const fx of this.furniture) {
      g.fillStyle(0x533f2e, 1);
      g.fillRoundedRect(fx - 30, FLOOR_FEET_Y - 56, 60, 52, 6);
      g.fillStyle(0x6f5b46, 1);
      g.fillRoundedRect(fx - 24, FLOOR_FEET_Y - 50, 48, 40, 4);
    }
    this.backLayer.add(g);
  }

  private updateChase(dt: number): void {
    const now = this.time.now;

    const speed = 360;
    if (this.leftKey?.isDown) this.targetPincerX -= speed * dt;
    if (this.rightKey?.isDown) this.targetPincerX += speed * dt;
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.trySnap();

    this.targetPincerX = clamp(this.targetPincerX, 40, GAME_WIDTH - 40);
    this.pincerX = Phaser.Math.Linear(this.pincerX, this.targetPincerX, Math.min(1, dt * 14));

    // Lincoln runs and bounces.
    this.lincolnX += this.lincolnVX * dt;
    if (this.lincolnX < CHASE_MIN_X) {
      this.lincolnX = CHASE_MIN_X;
      this.lincolnVX = Math.abs(this.lincolnVX);
    } else if (this.lincolnX > CHASE_MAX_X) {
      this.lincolnX = CHASE_MAX_X;
      this.lincolnVX = -Math.abs(this.lincolnVX);
    }

    // Escape dashes.
    if (now >= this.nextDashAt) {
      const away = this.lincolnX >= this.pincerX ? 1 : -1;
      const dir = Math.random() < 0.7 ? away : -away;
      this.lincolnVX = dir * this.diff.speed * Phaser.Math.FloatBetween(1.1, 1.8);
      this.nextDashAt = now + Phaser.Math.Between(this.diff.dashMin, this.diff.dashMax);
    }

    // Hop furniture.
    if (this.hopT >= 1) {
      for (const fx of this.furniture) {
        if (Math.abs(this.lincolnX - fx) < 26) {
          this.hopT = 0;
          this.tweens.killTweensOf(this);
          this.tweens.add({ targets: this, hopT: 1, duration: 420, ease: 'Sine.inOut' });
          break;
        }
      }
    }

    this.timerText.setText(`${((now - this.chaseStart) / 1000).toFixed(1)}s`);
  }

  private trySnap(): void {
    if (this.stage !== 'chase' || !this.canSnap) return;
    const now = this.time.now;
    if (now < this.snapReadyAt) return;

    this.canSnap = false;
    this.handGap = 12;
    audio.snap();

    const hopOffset = Math.sin(this.hopT * Math.PI) * 46;
    const touchBonus = this.sys.game.device.input.touch ? 14 : 0;
    const inZone = Math.abs(this.lincolnX - this.pincerX) <= this.diff.tolerance + touchBonus;
    const grounded = hopOffset < 40;

    if (inZone && grounded) {
      this.onCapture();
    } else {
      this.onMiss();
    }

    this.time.delayedCall(140, () => {
      this.handGap = this.baseGap;
      this.snapReadyAt = this.time.now + this.diff.snapCooldown;
      this.canSnap = true;
    });
  }

  private onCapture(): void {
    this.capturesDone += 1;
    this.updatePips();
    audio.happy();
    this.cameras.main.flash(160, 255, 244, 214);

    if (this.capturesDone >= this.diff.captures) {
      this.finish();
      return;
    }

    // He wriggles free and gets faster for the remaining grabs.
    this.lincolnVX = (this.lincolnX >= this.pincerX ? 1 : -1) * this.diff.speed * 1.4;
    this.lincolnX = clamp(this.lincolnX + (this.lincolnX >= this.pincerX ? 60 : -60), CHASE_MIN_X, CHASE_MAX_X);
    this.floatHint('Gotcha! One more…', this.lincolnX, FLOOR_FEET_Y - 150, '#9bd35a');
  }

  private onMiss(): void {
    this.cameras.main.shake(120, 0.004);
    this.floatHint('Missed!', this.pincerX, HAND_Y - 60, '#e0627c');
    this.lincolnVX = (this.lincolnX >= this.pincerX ? 1 : -1) * this.diff.speed * 1.6;
  }

  // ── Finish ──────────────────────────────────────────────────────────────

  private finish(): void {
    this.stage = 'done';
    this.lincoln.setVisible(false);
    this.hands.setVisible(false);

    const state = getState();
    const minutes = resolveSleep(state, this.diff.bondBonus);
    const hours = minutes / 60;
    saveNow();
    audio.sleepZ();

    const elapsed = ((this.time.now - this.chaseStart) / 1000).toFixed(1);
    this.titleText.setText('💤 Tucked in!');
    this.timerText.setText('');
    this.subText.setText('');
    this.pips.clear();

    this.stageLayer.removeAll(true);

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.94);
    panel.fillRoundedRect(40, 200, GAME_WIDTH - 80, 300, 18);
    panel.lineStyle(3, COLORS.brownLight, 0.6);
    panel.strokeRoundedRect(40, 200, GAME_WIDTH - 80, 300, 18);
    this.stageLayer.add(panel);

    const lines = [
      { text: `Caught in ${elapsed}s`, size: '24px', color: '#fff3de', y: 250 },
      { text: `Difficulty: ${this.diff.label}`, size: '18px', color: '#d9c7a6', y: 300 },
      { text: `+${this.diff.bondBonus} bond for the effort`, size: '18px', color: '#9bd35a', y: 340 },
      { text: `😴 Slept ~${hours.toFixed(1)}h`, size: '20px', color: '#5aa9d6', y: 392 },
      { text: 'Lincoln is dreaming of dinner.', size: '15px', color: '#d9c7a6', y: 440 },
    ];
    for (const line of lines) {
      const t = this.add
        .text(GAME_WIDTH / 2, line.y, line.text, {
          fontFamily: FONT, fontSize: line.size, color: line.color, fontStyle: 'bold', align: 'center',
        })
        .setOrigin(0.5);
      this.stageLayer.add(t);
    }

    this.createButton(240, 530, 240, 68, 'Good night', 0x5b7fb0, () => this.leave());
  }

  private leave(): void {
    this.scene.stop();
    this.scene.resume('Room');
  }

  // ── Input ───────────────────────────────────────────────────────────────

  private createKeys(): void {
    const kb = this.input.keyboard;
    this.leftKey = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.spaceKey = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private banner(text: string): void {
    const label = this.add
      .text(GAME_WIDTH / 2, 320, text, {
        fontFamily: FONT, fontSize: '34px', color: '#f4d35e', fontStyle: 'bold',
        stroke: '#3a2416', strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(90)
      .setScale(0.6);
    this.tweens.add({ targets: label, scale: 1, duration: 300, ease: 'Back.out' });
    this.tweens.add({ targets: label, alpha: 0, delay: 700, duration: 400, onComplete: () => label.destroy() });
  }

  private floatHint(text: string, x: number, y: number, color: string): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: FONT, fontSize: '20px', color, fontStyle: 'bold',
        stroke: '#3a2416', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({ targets: label, y: y - 46, alpha: 0, duration: 800, ease: 'Cubic.out', onComplete: () => label.destroy() });
  }

  private createButton(
    x: number, y: number, width: number, height: number, label: string, color: number, onClick: () => void,
  ): void {
    const container = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(-width / 2, -height / 2 + 5, width, height, 14);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    g.lineStyle(3, COLORS.cream, 0.25);
    g.strokeRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 12);
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
    this.stageLayer.add(container);
  }
}
