import Phaser from 'phaser';
import { COLORS, FONT, FONT_MONO, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { audio } from '../audio/audio';
import { addCoins, clamp } from '../state/gameState';
import { getState, saveNow } from '../state/store';
import { drawLincoln, LINCOLN_H, LINCOLN_PIXEL, LINCOLN_W } from '../ui/lincoln';

const GROUND_Y = 640;
const LINCOLN_X = 140;
const ROUND_TIME = 45;
const GRAVITY = 2300;
const JUMP_V = -800;

interface Obstacle {
  obj: Phaser.GameObjects.Text;
  w: number;
  scored: boolean;
  hit: boolean;
}

interface Treat {
  obj: Phaser.GameObjects.Text;
}

/**
 * Puddle Dodge (Pou Water Hop, Lincoln edition — inverted).
 * Lincoln HATES water: auto-runs, tap / Space to jump puddles, mud and tubs.
 * Grab mid-air treats for bonus. 3 splashes and you're soaked.
 */
export class PuddleScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private ui!: Phaser.GameObjects.Container;
  private lincoln!: Phaser.GameObjects.Container;

  private feetY = GROUND_Y;
  private vy = 0;
  private grounded = true;

  private obstacles: Obstacle[] = [];
  private treats: Treat[] = [];
  private nextSpawnAt = 0;
  private startAt = 0;
  private over = false;
  private invulnUntil = 0;
  private bob = 0;

  private score = 0;
  private snacks = 0;
  private lives = 3;

  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;

  constructor() {
    super('Puddle');
  }

  create(): void {
    this.obstacles = [];
    this.treats = [];
    this.feetY = GROUND_Y;
    this.vy = 0;
    this.grounded = true;
    this.score = 0;
    this.snacks = 0;
    this.lives = 3;
    this.over = false;
    this.bob = 0;
    this.startAt = this.time.now;
    this.nextSpawnAt = this.time.now + 700;
    this.invulnUntil = 0;

    this.drawPark();
    this.layer = this.add.container(0, 0).setDepth(5);
    this.ui = this.add.container(0, 0).setDepth(20);

    const art = this.add.graphics();
    drawLincoln(art, -LINCOLN_W / 2, -LINCOLN_H, LINCOLN_PIXEL, getState().lincoln.outfit);
    this.lincoln = this.add.container(LINCOLN_X, GROUND_Y, [art]);
    this.layer.add(this.lincoln);

    this.createStatus();
    this.createJumpButton();

    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => this.jump());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > 660) return; // jump button handles its own taps
      this.jump();
    });
    this.banner('Jump the puddles! 💦');
  }

  override update(_time: number, delta: number): void {
    if (this.over) return;
    const dt = Math.min(delta, 50) / 1000;
    const elapsed = (this.time.now - this.startAt) / 1000;
    const left = Math.max(0, ROUND_TIME - elapsed);
    this.bob += dt * 10;

    // Lincoln physics.
    if (!this.grounded) {
      this.vy += GRAVITY * dt;
      this.feetY += this.vy * dt;
      if (this.feetY >= GROUND_Y) {
        this.feetY = GROUND_Y;
        this.vy = 0;
        this.grounded = true;
      }
    }
    const runBounce = this.grounded ? Math.abs(Math.sin(this.bob)) * 6 : 0;
    this.lincoln.setPosition(LINCOLN_X, this.feetY - runBounce);

    // Difficulty ramp.
    const progress = clamp(elapsed / ROUND_TIME, 0, 1);
    const speed = Phaser.Math.Linear(260, 430, progress);

    if (this.time.now >= this.nextSpawnAt) {
      this.spawnRow(progress);
      const gap = Phaser.Math.Linear(1150, 640, progress);
      this.nextSpawnAt = this.time.now + gap * Phaser.Math.FloatBetween(0.8, 1.25);
    }

    // Move obstacles; score when they pass.
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.obj.x -= speed * dt;
      if (!o.scored && o.obj.x < LINCOLN_X - 60) {
        o.scored = true;
        if (!o.hit) {
          this.score += 1;
          this.scoreText.setText(`💦 ${this.score} · 😋 ${this.snacks}`);
        }
      }
      // Hit? Low feet + overlapping x.
      const overlap = Math.abs(o.obj.x - LINCOLN_X) < o.w / 2 + 30;
      const low = this.feetY > GROUND_Y - 42;
      if (!o.hit && overlap && low && this.time.now >= this.invulnUntil) {
        o.hit = true;
        this.splash();
      }
      if (o.obj.x < -60) {
        o.obj.destroy();
        this.obstacles.splice(i, 1);
      }
    }

    // Move treats; collect mid-air.
    for (let i = this.treats.length - 1; i >= 0; i--) {
      const t = this.treats[i];
      t.obj.x -= speed * dt;
      const dx = Math.abs(t.obj.x - LINCOLN_X);
      const dy = Math.abs(t.obj.y - (this.feetY - 70));
      if (dx < 44 && dy < 50) {
        this.snacks += 1;
        audio.coin();
        this.popText('+1 😋', LINCOLN_X, this.feetY - 150, '#9bd35a');
        this.scoreText.setText(`💦 ${this.score} · 😋 ${this.snacks}`);
        t.obj.destroy();
        this.treats.splice(i, 1);
        continue;
      }
      if (t.obj.x < -40) {
        t.obj.destroy();
        this.treats.splice(i, 1);
      }
    }

    this.timerText.setText(`${left.toFixed(0)}s`);
    if (left <= 0) this.finish();
  }

  private spawnRow(progress: number): void {
    const roll = Math.random();
    const kind = roll < 0.4 ? '💧' : roll < 0.7 ? '🟤' : '🛁';
    const w = kind === '🛁' ? 84 : kind === '🟤' ? 64 : 76;
    const obj = this.add
      .text(GAME_WIDTH + 40, GROUND_Y - 22, kind, { fontSize: kind === '🛁' ? '44px' : '38px' })
      .setOrigin(0.5)
      .setDepth(6);
    this.layer.add(obj);
    this.obstacles.push({ obj, w, scored: false, hit: false });

    // Snack above gaps sometimes — reward a good jump.
    if (Math.random() < 0.55 + progress * 0.2) {
      const snack = this.add
        .text(GAME_WIDTH + 40 + Phaser.Math.Between(0, 60), GROUND_Y - Phaser.Math.Between(130, 180), '🦴', { fontSize: '30px' })
        .setOrigin(0.5)
        .setDepth(6);
      this.layer.add(snack);
      this.treats.push({ obj: snack });
    }
  }

  private jump(): void {
    if (this.over || !this.grounded) return;
    this.grounded = false;
    this.vy = JUMP_V;
    audio.click();
  }

  private splash(): void {
    this.lives -= 1;
    this.livesText.setText('❤️'.repeat(Math.max(0, this.lives)) + '🤍'.repeat(3 - Math.max(0, this.lives)));
    this.invulnUntil = this.time.now + 1000;
    audio.splash();
    this.cameras.main.shake(150, 0.005);
    this.popText('Splash! 💦', LINCOLN_X, GROUND_Y - 160, '#5aa9d6');
    if (this.lives <= 0) this.finish();
  }

  private finish(): void {
    if (this.over) return;
    this.over = true;

    const state = getState();
    const l = state.lincoln;
    const funGain = clamp(10 + this.score * 1.4 + this.snacks, 0, 38);
    l.fun = clamp(l.fun + funGain);
    l.hunger = clamp(l.hunger + Math.min(20, this.snacks * 3));
    l.fatness = clamp(l.fatness + this.snacks * 2);
    l.energy = clamp(l.energy - 14);
    l.thirst = clamp(l.thirst - 8);
    l.cleanliness = clamp(l.cleanliness - (8 + (3 - Math.max(0, this.lives)) * 3));
    l.bond = clamp(l.bond + 2 + (this.score >= 15 ? 2 : 0));
    state.world.roomMess = clamp(state.world.roomMess + 5 + (3 - Math.max(0, this.lives)) * 2);
    const coins = 1 + Math.min(6, Math.floor(this.score / 6) + Math.floor(this.snacks / 4));
    addCoins(state, coins);
    audio.happy();
    saveNow();

    const title = this.lives <= 0 ? 'Soaked! 💦' : this.score >= 20 ? 'Dry-ish champ! 🏆' : 'Nice dodging! 💦';
    this.panel(title, [
      `Dodged: ${this.score} · 😋 ${this.snacks} · ❤️ ${Math.max(0, this.lives)}/3`,
      `Fun +${Math.round(funGain)} · 🪙 +${coins}`,
      'Baths hate him. Puddles find him.',
    ]);
  }

  private drawPark(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x8fa3c7, 1);
    g.fillRect(0, 0, GAME_WIDTH, 560);
    g.fillStyle(0xffffff, 0.85);
    g.fillEllipse(120, 110, 130, 36);
    g.fillEllipse(330, 200, 100, 30);
    g.fillStyle(0x6ba84f, 1);
    g.fillRect(0, 560, GAME_WIDTH, GAME_HEIGHT - 560);
    g.fillStyle(0x5a9440, 1);
    g.fillRect(0, GROUND_Y + 40, GAME_WIDTH, 8);
  }

  private createStatus(): void {
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.panel, 0.9);
    bg.fillRoundedRect(10, 10, GAME_WIDTH - 20, 80, 14);
    const title = this.add.text(24, 20, '💦 Puddle Dodge!', {
      fontFamily: FONT, fontSize: '20px', color: '#f3e2c3', fontStyle: 'bold',
    });
    this.timerText = this.add
      .text(GAME_WIDTH - 24, 20, `${ROUND_TIME}s`, { fontFamily: FONT_MONO, fontSize: '18px', color: '#f3e2c3' })
      .setOrigin(1, 0);
    this.scoreText = this.add.text(24, 50, '💦 0 · 😋 0', { fontFamily: FONT, fontSize: '16px', color: '#d9c7a6' });
    this.livesText = this.add
      .text(GAME_WIDTH - 24, 50, '❤️❤️❤️', { fontFamily: FONT, fontSize: '16px', color: '#fff' })
      .setOrigin(1, 0);
    this.ui.add([bg, title, this.timerText, this.scoreText, this.livesText]);
  }

  private createJumpButton(): void {
    const w = 220;
    const h = 64;
    const x = GAME_WIDTH / 2;
    const y = 730;
    const c = this.add.container(x, y).setDepth(21);
    const bg = this.add.rectangle(0, 0, w, h, 0x4aa3c7).setInteractive({ useHandCursor: true });
    const face = this.add.graphics();
    face.fillStyle(0x4aa3c7, 1);
    face.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    face.lineStyle(3, COLORS.cream, 0.25);
    face.strokeRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 12);
    const t = this.add
      .text(0, 0, '⬆ JUMP', { fontFamily: FONT, fontSize: '22px', color: '#fff', fontStyle: 'bold' })
      .setOrigin(0.5);
    c.add([bg, face, t]);
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.jump();
    });
    this.ui.add(c);
  }

  private panel(title: string, lines: string[]): void {
    const bg = this.add.graphics().setDepth(30);
    bg.fillStyle(COLORS.panel, 0.95);
    bg.fillRoundedRect(40, 200, GAME_WIDTH - 80, 330, 18);
    this.ui.add(bg);
    const t = this.add
      .text(GAME_WIDTH / 2, 250, title, { fontFamily: FONT, fontSize: '26px', color: '#fff3de', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(31);
    this.ui.add(t);
    lines.forEach((s, i) => {
      const li = this.add
        .text(GAME_WIDTH / 2, 310 + i * 44, s, { fontFamily: FONT, fontSize: '18px', color: '#d9c7a6', fontStyle: 'bold', align: 'center' })
        .setOrigin(0.5)
        .setDepth(31);
      this.ui.add(li);
    });
    this.panelButton(240, 472, 240, 60, 'Dodge again', 0x4aa3c7, () => this.scene.restart());
    this.panelButton(240, 542, 240, 60, 'Back', 0x6ba84f, () => this.leave());
  }

  private panelButton(x: number, y: number, w: number, h: number, label: string, color: number, onClick: () => void): void {
    const c = this.add.container(x, y).setDepth(32);
    const bg = this.add.rectangle(0, 0, w, h, color).setInteractive({ useHandCursor: true });
    const face = this.add.graphics();
    face.fillStyle(color, 1);
    face.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    face.lineStyle(3, COLORS.cream, 0.25);
    face.strokeRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 12);
    const t = this.add
      .text(0, 0, label, { fontFamily: FONT, fontSize: '20px', color: '#fff', fontStyle: 'bold' })
      .setOrigin(0.5);
    c.add([bg, face, t]);
    let fired = false;
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      fired = true;
      onClick();
    });
    bg.on('pointerup', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (!fired) onClick();
      fired = false;
    });
    this.ui.add(c);
  }

  private leave(): void {
    this.scene.stop();
    if (this.scene.isPaused('Play')) this.scene.resume('Play');
    else this.scene.resume('Room');
  }

  private banner(text: string): void {
    const label = this.add
      .text(GAME_WIDTH / 2, 320, text, {
        fontFamily: FONT, fontSize: '30px', color: '#9fc6e0', fontStyle: 'bold',
        stroke: '#3a2416', strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(40)
      .setScale(0.6);
    this.tweens.add({ targets: label, scale: 1, duration: 300, ease: 'Back.out' });
    this.tweens.add({ targets: label, alpha: 0, delay: 800, duration: 400, onComplete: () => label.destroy() });
  }

  private popText(text: string, x: number, y: number, color: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: '18px', color, fontStyle: 'bold', stroke: '#3a2416', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }
}
