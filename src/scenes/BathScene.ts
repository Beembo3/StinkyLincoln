import Phaser from 'phaser';
import { COLORS, FONT, FONT_MONO, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { clamp, addCoins, hasItem } from '../state/gameState';
import { getState } from '../state/store';
import { audio } from '../audio/audio';
import { drawLincoln, LINCOLN_H, LINCOLN_PIXEL, LINCOLN_W } from '../ui/lincoln';

// Play lanes
const FLOOR_FEET_Y = 690; // where Lincoln's paws sit during the chase
const NET_CENTER_Y = 626; // net ring centre, level with Lincoln's middle
const CHASE_MIN_X = 80;
const CHASE_MAX_X = 400;

// Tuning
const CATCH_FILL_RATE = 80; // meter points per second while overlapping
const CATCH_SHAKE_PENALTY = 22;
const SCRUB_TAP_GAIN = 7;
const SCRUB_SHAKE_PENALTY = 12;
const CATCH_SCORE_WINDOW = 16; // seconds to a full score
const SCRUB_SCORE_WINDOW = 12;

type Stage = 'catch' | 'scrub' | 'result';

/**
 * The bath mini-game — the game's chaotic centrepiece.
 *
 * Stage 1 (catch): drag the net onto a sprinting, dodging, shaking Lincoln.
 * Stage 2 (scrub): mash to scrub him before he shakes it all off.
 * Then the results are applied to the shared game state and computed as a
 * cleanliness change plus a mess/water cost.
 */
export class BathScene extends Phaser.Scene {
  private stage: Stage = 'catch';

  private backLayer!: Phaser.GameObjects.Container;
  private stageLayer!: Phaser.GameObjects.Container;
  private statusLayer!: Phaser.GameObjects.Container;

  private lincoln!: Phaser.GameObjects.Container;
  private net: Phaser.GameObjects.Container | null = null;

  // Lincoln movement
  private lincolnX = 240;
  private lincolnVX = 150;
  private hopT = 1;
  private bob = 0;
  private squashX = 1;
  private squashY = 1;

  // Net control
  private netX = 240;
  private targetNetX = 240;

  // Progress
  private catchMeter = 0;
  private scrubProgress = 0;
  private catchStartTime = 0;
  private catchDuration = 0;
  private scrubStartTime = 0;
  private scrubDuration = 0;
  private shakeCount = 0;

  // Consequences
  private messAdded = 0;
  private waterAdded = 0;

  private nextDashAt = 0;
  private nextShakeAt = 0;
  private furniture: number[] = [120, 250, 380];

  private titleText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private meterG!: Phaser.GameObjects.Graphics;
  private meterLabel!: Phaser.GameObjects.Text;
  private lastMeterPct = -1;
  private lastTimerStr = '';

  private leftKey?: Phaser.Input.Keyboard.Key;
  private rightKey?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Bath');
  }

  create(): void {
    this.stage = 'catch';
    this.catchMeter = 0;
    this.scrubProgress = 0;
    this.messAdded = 0;
    this.waterAdded = 0;
    this.shakeCount = 0;
    this.lincolnX = 240;
    this.lincolnVX = 150;
    this.hopT = 1;
    this.bob = 0;
    this.net = null;

    this.drawBathroom();
    this.createLayers();
    this.createLincoln();
    this.createStatusBar();
    this.createKeys();
    this.startCatch();
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.bob += dt * 3;

    if (this.stage === 'catch') this.updateCatch(dt);
    else if (this.stage === 'scrub') this.updateScrub();

    this.updateLincolnVisual();
    this.updateStatus();
  }

  // ── Scenery ─────────────────────────────────────────────────────────────

  private drawBathroom(): void {
    const g = this.add.graphics().setDepth(0);

    // Tiled wall
    g.fillStyle(0xdfe8ea, 1);
    g.fillRect(0, 0, GAME_WIDTH, FLOOR_FEET_Y + 20);
    g.lineStyle(2, 0xc3d1d5, 1);
    for (let x = 0; x <= GAME_WIDTH; x += 48) g.lineBetween(x, 0, x, FLOOR_FEET_Y + 20);
    for (let y = 0; y <= FLOOR_FEET_Y + 20; y += 48) g.lineBetween(0, y, GAME_WIDTH, y);

    // Tiled floor
    g.fillStyle(0xc9d6d9, 1);
    g.fillRect(0, FLOOR_FEET_Y + 20, GAME_WIDTH, GAME_HEIGHT - FLOOR_FEET_Y - 20);
    g.fillStyle(0xbfced2, 1);
    for (let y = FLOOR_FEET_Y + 20; y < GAME_HEIGHT; y += 56) {
      for (let x = 0; x < GAME_WIDTH; x += 56) {
        if (((x / 56) + (y / 56)) % 2 === 0) g.fillRect(x, y, 56, 56);
      }
    }
  }

  private createLayers(): void {
    this.backLayer = this.add.container(0, 0).setDepth(1);
    this.lincoln = this.add.container(0, 0).setDepth(5);
    this.stageLayer = this.add.container(0, 0).setDepth(10);
    this.statusLayer = this.add.container(0, 0).setDepth(20);
  }

  private createLincoln(): void {
    const g = this.add.graphics();
    // Feet-origin so any fatness scaling keeps him planted.
    drawLincoln(g, -LINCOLN_W / 2, -LINCOLN_H, LINCOLN_PIXEL, getState().lincoln.outfit);
    this.lincoln.add(g);
  }

  private updateLincolnVisual(): void {
    const hop = Math.sin(this.hopT * Math.PI) * 54;
    const idle = Math.sin(this.bob) * 3;
    const feetY = this.stage === 'scrub' ? 700 : FLOOR_FEET_Y;
    const fat = Phaser.Math.Clamp(getState().lincoln.fatness / 100, 0, 1);
    const fatX = 1 + fat * 0.5;
    const fatY = 1 + fat * 0.28;
    this.lincoln.setPosition(this.lincolnX, feetY - hop + idle);
    this.lincoln.setScale(fatX * this.squashX, fatY * this.squashY);
  }

  // ── Status bar ──────────────────────────────────────────────────────────

  private createStatusBar(): void {
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.9);
    panel.fillRoundedRect(10, 10, GAME_WIDTH - 20, 92, 14);

    this.titleText = this.add.text(24, 20, '', {
      fontFamily: FONT,
      fontSize: '20px',
      color: '#f3e2c3',
      fontStyle: 'bold',
    });
    this.timerText = this.add
      .text(GAME_WIDTH - 24, 20, '0.0s', {
        fontFamily: FONT_MONO,
        fontSize: '18px',
        color: '#f3e2c3',
      })
      .setOrigin(1, 0);

    this.meterLabel = this.add.text(24, 52, '', {
      fontFamily: FONT,
      fontSize: '14px',
      color: '#d9c7a6',
    });
    this.meterG = this.add.graphics();

    this.statusLayer.add([panel, this.titleText, this.timerText, this.meterLabel, this.meterG]);
  }

  private updateStatus(): void {
    const value = this.stage === 'scrub' ? this.scrubProgress : this.catchMeter;
    const elapsed =
      this.stage === 'catch'
        ? (this.time.now - this.catchStartTime) / 1000
        : this.stage === 'scrub'
          ? (this.time.now - this.scrubStartTime) / 1000
          : this.scrubDuration;

    if (this.stage !== 'result') {
      const t = `${elapsed.toFixed(1)}s`;
      if (t !== this.lastTimerStr) {
        this.lastTimerStr = t;
        this.timerText.setText(t);
      }
    }

    const pct = Math.round(clamp(value, 0, 100));
    if (pct === this.lastMeterPct) return;
    this.lastMeterPct = pct;

    const { BAR_X, BAR_W, BAR_Y, BAR_H } = BathScene;
    const g = this.meterG;
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(BAR_X, BAR_Y, BAR_W, BAR_H, BAR_H / 2);
    const fillW = ((BAR_W - 4) * clamp(value, 0, 100)) / 100;
    if (fillW > 0) {
      g.fillStyle(this.stage === 'scrub' ? 0xb98ad6 : COLORS.water, 1);
      g.fillRoundedRect(BAR_X + 2, BAR_Y + 2, fillW, BAR_H - 4, (BAR_H - 4) / 2);
    }
  }

  private static readonly BAR_X = 24;
  private static readonly BAR_W = GAME_WIDTH - 48;
  private static readonly BAR_Y = 74;
  private static readonly BAR_H = 16;

  // ── Input ───────────────────────────────────────────────────────────────

  private createKeys(): void {
    const kb = this.input.keyboard;
    this.leftKey = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.spaceKey = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Mouse: hover moves the net. Touch: drag moves it — pointermove only
    // fires while touching, so also jump to the finger on pointerdown with
    // a vertical offset so the finger doesn't cover Lincoln.
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.stage === 'catch') this.targetNetX = pointer.worldX;
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.stage === 'catch') this.targetNetX = pointer.worldX;
    });
  }

  // ── Stage 1: Catch ──────────────────────────────────────────────────────

  private startCatch(): void {
    this.stage = 'catch';
    this.catchStartTime = this.time.now;
    this.nextDashAt = this.time.now + 700;
    this.nextShakeAt = this.time.now + 1800;
    this.titleText.setText('Catch Lincoln!');
    this.meterLabel.setText('Drag your net onto him — watch the shakes!');

    this.drawFurniture();
    this.createNet();
    this.banner('BATH TIME! 🛁');
  }

  private drawFurniture(): void {
    const g = this.add.graphics();
    // A stool, a box and a potted plant — Lincoln hops them.
    g.fillStyle(0x8a5a2b, 1);
    g.fillRoundedRect(120 - 26, FLOOR_FEET_Y - 52, 52, 44, 6);
    g.fillStyle(0x6b4520, 1);
    g.fillRect(120 - 20, FLOOR_FEET_Y - 8, 8, 10);
    g.fillRect(120 + 12, FLOOR_FEET_Y - 8, 8, 10);

    g.fillStyle(0xb08048, 1);
    g.fillRoundedRect(250 - 30, FLOOR_FEET_Y - 46, 60, 38, 5);
    g.lineStyle(2, 0x8a5a2b, 1);
    g.strokeRoundedRect(250 - 30, FLOOR_FEET_Y - 46, 60, 38, 5);

    g.fillStyle(0xb56a5a, 1);
    g.fillRoundedRect(380 - 18, FLOOR_FEET_Y - 34, 36, 34, { tl: 6, tr: 6, bl: 4, br: 4 });
    g.fillStyle(0x6ba84f, 1);
    g.fillCircle(380, FLOOR_FEET_Y - 44, 22);
    g.fillCircle(380 - 16, FLOOR_FEET_Y - 34, 14);
    g.fillCircle(380 + 16, FLOOR_FEET_Y - 36, 14);

    this.backLayer.add(g);
  }

  private createNet(): void {
    const container = this.add.container(this.netX, NET_CENTER_Y);
    const g = this.add.graphics();
    g.fillStyle(0x6b4a2a, 1);
    g.fillRoundedRect(-6, 30, 12, 78, 6);
    g.lineStyle(7, 0xe7dcc8, 1);
    g.strokeCircle(0, 0, 42);
    g.fillStyle(0xffffff, 0.16);
    g.fillCircle(0, 0, 42);
    container.add(g);
    this.stageLayer.add(container);
    this.net = container;
  }

  private updateCatch(dt: number): void {
    const now = this.time.now;

    // Net follows pointer smoothly; keyboard nudges too.
    const speed = 340;
    if (this.leftKey?.isDown) this.targetNetX -= speed * dt;
    if (this.rightKey?.isDown) this.targetNetX += speed * dt;
    this.targetNetX = clamp(this.targetNetX, CHASE_MIN_X - 20, CHASE_MAX_X + 20);
    this.netX = Phaser.Math.Linear(this.netX, this.targetNetX, Math.min(1, dt * 14));
    this.net?.setX(this.netX);

    // Lincoln runs and bounces off the walls.
    this.lincolnX += this.lincolnVX * dt;
    if (this.lincolnX < CHASE_MIN_X) {
      this.lincolnX = CHASE_MIN_X;
      this.lincolnVX = Math.abs(this.lincolnVX);
    } else if (this.lincolnX > CHASE_MAX_X) {
      this.lincolnX = CHASE_MAX_X;
      this.lincolnVX = -Math.abs(this.lincolnVX);
    }

    // Periodic escape dash, biased away from the net.
    if (now >= this.nextDashAt) {
      const away = this.lincolnX >= this.netX ? 1 : -1;
      const dir = Math.random() < 0.7 ? away : -away;
      this.lincolnVX = dir * Phaser.Math.Between(180, 300);
      this.nextDashAt = now + Phaser.Math.Between(850, 1600);
    }

    // Hop over furniture.
    if (this.hopT >= 1) {
      for (const fx of this.furniture) {
        if (Math.abs(this.lincolnX - fx) < 26) {
          this.hopT = 0;
          this.tweens.killTweensOf(this);
          this.tweens.add({ targets: this, hopT: 1, duration: 460, ease: 'Sine.inOut' });
          break;
        }
      }
    }

    // Periodic shake-off.
    if (now >= this.nextShakeAt) {
      this.doShake();
      this.nextShakeAt = now + Phaser.Math.Between(2400, 3600);
    }

    // Catch check — must be level with him, not while he's mid-hop.
    // Wider window on touch screens where the finger occludes him.
    const hopOffset = Math.sin(this.hopT * Math.PI) * 54;
    const touch = this.sys.game.device.input.touch;
    const dx = Math.abs(this.netX - this.lincolnX);
    if (dx < (touch ? 60 : 46) && hopOffset < 40) {
      this.catchMeter = clamp(this.catchMeter + CATCH_FILL_RATE * dt);
    }

    if (this.catchMeter >= 100) {
      this.catchDuration = (now - this.catchStartTime) / 1000;
      this.startScrub();
    }
  }

  // ── Stage 2: Scrub ──────────────────────────────────────────────────────

  private startScrub(): void {
    this.stage = 'scrub';
    this.scrubProgress = 0;
    this.scrubStartTime = this.time.now;

    this.stageLayer.removeAll(true);
    this.net = null;

    this.lincolnX = 240;
    this.hopT = 1;
    this.drawTubBack();

    this.titleText.setText('Scrub him clean!');
    this.meterLabel.setText('Mash SCRUB before he shakes it all off!');
    audio.happy();

    this.createButton(240, 720, 280, 96, 'SCRUB!', 0x4aa3c7, () => this.scrubTap());
    this.drawTubFront();
  }

  private drawTubBack(): void {
    const g = this.add.graphics();
    g.fillStyle(0xe9f2f4, 1);
    g.fillEllipse(240, 636, 236, 44);
    this.backLayer.add(g);
  }

  private drawTubFront(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(240 - 120, 636, 240, 92, { tl: 8, tr: 8, bl: 30, br: 30 });
    g.lineStyle(4, 0xd4e0e4, 1);
    g.strokeRoundedRect(240 - 120, 636, 240, 92, { tl: 8, tr: 8, bl: 30, br: 30 });
    // Water surface peeking over the front rim
    g.fillStyle(COLORS.water, 0.85);
    g.fillEllipse(240, 636, 228, 30);
    // Feet
    g.fillStyle(0xe4d9cb, 1);
    g.fillRoundedRect(240 - 92, 724, 30, 14, 6);
    g.fillRoundedRect(240 + 62, 724, 30, 14, 6);
    this.stageLayer.addAt(g, 0);
  }

  private updateScrub(): void {
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.scrubTap();

    const now = this.time.now;
    if (now >= this.nextShakeAt) {
      this.doShake();
      this.nextShakeAt = now + Phaser.Math.Between(2000, 3000);
    }
  }

  private scrubTap(): void {
    if (this.stage !== 'scrub') return;
    this.scrubProgress = clamp(this.scrubProgress + SCRUB_TAP_GAIN);
    this.spawnSuds(240 + Phaser.Math.Between(-70, 70), 620 + Phaser.Math.Between(-14, 10));
    this.squashX = 1.06;
    this.squashY = 0.94;
    this.tweens.add({ targets: this, squashX: 1, squashY: 1, duration: 120, ease: 'Quad.out' });

    if (this.scrubProgress >= 100) {
      this.scrubDuration = (this.time.now - this.scrubStartTime) / 1000;
      this.finish();
    }
  }

  // ── Shared effects ──────────────────────────────────────────────────────

  private doShake(): void {
    this.shakeCount += 1;
    audio.splash();
    const x = this.lincolnX;
    const y = this.stage === 'scrub' ? 610 : NET_CENTER_Y;
    this.spawnSplash(x, y);
    this.spawnSplash(x + 24, y + 12);
    this.spawnSuds(x - 30, y - 10);
    this.messAdded += this.stage === 'scrub' ? 3 : 4;
    this.waterAdded += this.stage === 'scrub' ? 4 : 5;

    if (this.stage === 'catch') {
      this.catchMeter = clamp(this.catchMeter - CATCH_SHAKE_PENALTY);
    } else if (this.stage === 'scrub') {
      this.scrubProgress = clamp(this.scrubProgress - SCRUB_SHAKE_PENALTY);
    }

    this.cameras.main.shake(140, 0.005);
    this.floatHint('Shake!', x, y - 110);
  }

  private spawnSplash(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const drop = this.add
        .circle(x, y, Phaser.Math.Between(3, 7), i % 2 ? COLORS.water : COLORS.waterDark)
        .setDepth(15);
      const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
      const dist = Phaser.Math.Between(30, 90);
      this.tweens.add({
        targets: drop,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 8,
        alpha: 0,
        duration: 550,
        ease: 'Cubic.out',
        onComplete: () => drop.destroy(),
      });
    }
  }

  private spawnSuds(x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      const suds = this.add
        .circle(x + Phaser.Math.Between(-16, 16), y + Phaser.Math.Between(-8, 8), Phaser.Math.Between(4, 9), 0xffffff)
        .setDepth(16)
        .setAlpha(0.9);
      this.tweens.add({
        targets: suds,
        y: y - Phaser.Math.Between(30, 70),
        alpha: 0,
        duration: 600,
        ease: 'Sine.out',
        onComplete: () => suds.destroy(),
      });
    }
  }

  private floatHint(text: string, x: number, y: number): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#4aa3c7',
        fontStyle: 'bold',
        stroke: '#ffffff',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.tweens.add({
      targets: label,
      y: y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.out',
      onComplete: () => label.destroy(),
    });
  }

  private banner(text: string): void {
    const label = this.add
      .text(GAME_WIDTH / 2, 300, text, {
        fontFamily: FONT,
        fontSize: '40px',
        color: '#4aa3c7',
        fontStyle: 'bold',
        stroke: '#ffffff',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({
      targets: label,
      scale: { from: 0.6, to: 1.1 },
      alpha: { from: 1, to: 0 },
      duration: 1100,
      ease: 'Cubic.out',
      onComplete: () => label.destroy(),
    });
  }

  // ── Result ──────────────────────────────────────────────────────────────

  private finish(): void {
    this.stage = 'result';
    this.stageLayer.removeAll(true);
    this.titleText.setText('All done... maybe?');
    this.meterLabel.setText('');
    audio.splash();

    const catchScore = clamp(1 - this.catchDuration / CATCH_SCORE_WINDOW, 0, 1);
    const scrubScore = clamp(1 - this.scrubDuration / SCRUB_SCORE_WINDOW, 0, 1);
    const efficiency = (catchScore + scrubScore) / 2;
    let cleanlinessDelta = -5 + efficiency * 15;

    const state = getState();
    // Shop upgrades change the outcome.
    if (hasItem(state, 'tub')) cleanlinessDelta = Math.max(cleanlinessDelta, 0);
    if (hasItem(state, 'shampoo')) cleanlinessDelta += 4;
    cleanlinessDelta = Math.round(cleanlinessDelta * 10) / 10;

    let mess = this.messAdded;
    let water = this.waterAdded;
    if (hasItem(state, 'towels')) {
      mess *= 0.5;
      water *= 0.5;
    }
    this.messAdded = Math.round(mess);
    this.waterAdded = Math.round(water);

    this.applyResults(cleanlinessDelta, mess, water);
    addCoins(state, cleanlinessDelta > 0 ? 3 : 1);
    this.showResultPanel(cleanlinessDelta, efficiency);
  }

  private applyResults(cleanlinessDelta: number, mess: number, water: number): void {
    const state = getState();
    state.lincoln.cleanliness = clamp(state.lincoln.cleanliness + cleanlinessDelta);
    state.world.roomMess = clamp(state.world.roomMess + mess);
    state.world.waterLevel = clamp(state.world.waterLevel + water);
    state.lincoln.bond = clamp(state.lincoln.bond + 1); // he endured it, bless him
  }

  private showResultPanel(cleanlinessDelta: number, efficiency: number): void {
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.94);
    panel.fillRoundedRect(40, 180, GAME_WIDTH - 80, 380, 18);
    panel.lineStyle(3, COLORS.brownLight, 0.6);
    panel.strokeRoundedRect(40, 180, GAME_WIDTH - 80, 380, 18);
    this.stageLayer.add(panel);

    const flavour =
      cleanlinessDelta >= 6
        ? 'Squeaky-ish! 🫧'
        : cleanlinessDelta >= 2
          ? 'A little cleaner!'
          : cleanlinessDelta >= 0
            ? 'Barely better...'
            : 'He shook it ALL off! 💦';

    const lines = [
      { text: flavour, size: '26px', color: '#fff3de', y: 230 },
      {
        text: `Cleanliness ${cleanlinessDelta >= 0 ? '+' : ''}${cleanlinessDelta.toFixed(1)}%`,
        size: '22px',
        color: cleanlinessDelta >= 0 ? '#9bd35a' : '#e0627c',
        y: 290,
      },
      { text: `Room mess +${Math.round(this.messAdded)}%`, size: '18px', color: '#d9c7a6', y: 340 },
      { text: `Water spilled +${Math.round(this.waterAdded)}%`, size: '18px', color: '#d9c7a6', y: 372 },
      {
        text: efficiency >= 0.7 ? 'Lincoln is unimpressed, but impressed.' : 'Lincoln wins this round.',
        size: '15px',
        color: '#d9c7a6',
        y: 420,
      },
      { text: 'Shakes survived: ' + this.shakeCount, size: '15px', color: '#d9c7a6', y: 448 },
    ];

    for (const line of lines) {
      const text = this.add
        .text(GAME_WIDTH / 2, line.y, line.text, {
          fontFamily: FONT,
          fontSize: line.size,
          color: line.color,
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 120 },
        })
        .setOrigin(0.5);
      this.stageLayer.add(text);
    }

    this.createButton(240, 510, 240, 72, 'Back to room', 0x6ba84f, () => this.leave());
  }

  private leave(): void {
    this.scene.stop();
    this.scene.resume('Room');
  }

  // ── Small button helper ─────────────────────────────────────────────────

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    onClick: () => void,
  ): void {
    const container = this.add.container(x, y);
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillRoundedRect(-width / 2, -height / 2 + 5, width, height, 14);
    // Rectangle = reliable full-area hit test (see ActionButton).
    const bg = this.add.rectangle(0, 0, width, height, color);
    bg.setInteractive({ useHandCursor: true });
    const face = this.add.graphics();
    face.fillStyle(color, 1);
    face.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    face.lineStyle(3, COLORS.cream, 0.25);
    face.strokeRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 12);

    const text = this.add
      .text(0, 0, label, {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
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
    this.stageLayer.add(container);
  }
}
