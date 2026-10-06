import Phaser from 'phaser';
import { COLORS, FONT, FONT_MONO, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { audio } from '../audio/audio';
import { addCoins, clamp } from '../state/gameState';
import { getState, saveNow } from '../state/store';
import { drawLincoln, LINCOLN_PIXEL, LINCOLN_W } from '../ui/lincoln';

const ROUND_TIME = 40;
const GAP_Y = 112;
const GAP_X = 132;
const PLAT_W = 120;
const HOP_WINDOW_START = 1.8;

interface Plat {
  c: Phaser.GameObjects.Container;
  side: number; // -1 left, 0 center(start), 1 right (relative to previous)
  x: number;
  y: number;
}

/**
 * Fence Hop (Pou Sky Hop, Lincoln edition).
 * Platforms climb upward; tap ◀ / ▶ (or arrow keys, or screen halves)
 * to hop to the matching side before the hop timer runs out.
 * Wrong side or timeout = tumble, lose a heart. 3 hearts, 40s.
 */
export class FenceScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private ui!: Phaser.GameObjects.Container;

  private lincoln!: Phaser.GameObjects.Container;
  private plats: Plat[] = [];
  private lincolnIndex = 0;
  private score = 0;
  private lives = 3;
  private startAt = 0;
  private hopDeadline = 0;
  private hopWindow = HOP_WINDOW_START;
  private over = false;
  private hopping = false;

  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private hopBar!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Fence');
  }

  create(): void {
    this.plats = [];
    this.lincolnIndex = 0;
    this.score = 0;
    this.lives = 3;
    this.over = false;
    this.hopping = false;
    this.startAt = this.time.now;
    this.hopWindow = HOP_WINDOW_START;
    this.hopDeadline = this.time.now + this.hopWindow * 1000;

    this.drawSky();
    this.layer = this.add.container(0, 0).setDepth(5);
    this.ui = this.add.container(0, 0).setDepth(20);

    this.buildPlatforms();
    const art = this.add.graphics();
    drawLincoln(art, -LINCOLN_W / 2, -96, LINCOLN_PIXEL, getState().lincoln.outfit);
    this.lincoln = this.add.container(this.plats[0].x, this.plats[0].y - 10, [art]);
    this.layer.add(this.lincoln);

    this.createStatus();
    this.createTouchControls();

    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.tryHop(-1));
    kb?.on('keydown-RIGHT', () => this.tryHop(1));

    // Tap screen halves to hop (but not on the bottom buttons).
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > 640) return;
      this.tryHop(p.worldX < GAME_WIDTH / 2 ? -1 : 1);
    });

    this.banner('Tap ◀ ▶ to climb!');
  }

  override update(): void {
    if (this.over) return;
    const left = Math.max(0, ROUND_TIME - (this.time.now - this.startAt) / 1000);
    this.timerText.setText(`${left.toFixed(0)}s`);

    // Hop timer bar + timeout fall.
    const frac = clamp((this.hopDeadline - this.time.now) / (this.hopWindow * 1000), 0, 1);
    this.hopBar.clear();
    this.hopBar.fillStyle(0x000000, 0.35);
    this.hopBar.fillRoundedRect(24, 92, GAME_WIDTH - 48, 10, 5);
    if (frac > 0) {
      this.hopBar.fillStyle(frac > 0.35 ? 0x9bd35a : 0xd9534f, 1);
      this.hopBar.fillRoundedRect(26, 94, (GAME_WIDTH - 52) * frac, 6, 3);
    }
    if (this.time.now >= this.hopDeadline) {
      this.fumble('Too slow!');
    }
    if (left <= 0) this.finish();
  }

  private buildPlatforms(): void {
    // 6 platforms: start center-bottom, then zigzag up.
    let x = GAME_WIDTH / 2;
    let y = 600;
    const first = this.makePlat(x, y, 0);
    this.plats.push(first);
    for (let i = 1; i < 6; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      x = clamp(x + side * GAP_X, 90, GAME_WIDTH - 90);
      y -= GAP_Y;
      this.plats.push(this.makePlat(x, y, side));
    }
  }

  private makePlat(x: number, y: number, side: number): Plat {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    // Fence plank.
    g.fillStyle(0x8a5a2b, 1);
    g.fillRoundedRect(-PLAT_W / 2, -10, PLAT_W, 20, 6);
    g.fillStyle(0xc0854f, 1);
    g.fillRoundedRect(-PLAT_W / 2, -10, PLAT_W, 7, 5);
    // Posts.
    g.fillStyle(0x6b4520, 1);
    g.fillRect(-PLAT_W / 2 + 8, -26, 10, 18);
    g.fillRect(PLAT_W / 2 - 18, -26, 10, 18);
    // Hint arrow for the NEXT required direction.
    c.add(g);
    this.layer.add(c);
    const p: Plat = { c, side, x, y };
    this.refreshHint(p);
    return p;
  }

  private refreshHint(p: Plat): void {
    // Only the next platform shows an arrow.
    const isNext = this.plats.indexOf(p) === this.lincolnIndex + 1;
    // Clear old hint text (child index 1 if present).
    if (p.c.length > 1) p.c.removeAt(1, true);
    if (!isNext || p.side === 0) return;
    const t = this.add
      .text(0, -52, p.side < 0 ? '◀' : '▶', {
        fontFamily: FONT, fontSize: '30px', color: '#f4d35e', fontStyle: 'bold',
        stroke: '#3a2416', strokeThickness: 5,
      })
      .setOrigin(0.5);
    p.c.add(t);
  }

  private refreshAllHints(): void {
    for (const p of this.plats) this.refreshHint(p);
  }

  private tryHop(dir: -1 | 1): void {
    if (this.over || this.hopping) return;
    const next = this.plats[this.lincolnIndex + 1];
    if (!next) return;
    if (next.side !== dir) {
      this.fumble('Wrong way!');
      return;
    }
    this.hopping = true;
    this.score += 1;
    audio.click();
    const tx = next.x;
    const ty = next.y - 10;
    this.tweens.add({
      targets: this.lincoln,
      x: (this.lincoln.x + tx) / 2,
      y: Math.min(this.lincoln.y, ty) - 70,
      duration: 130,
      ease: 'Quad.out',
      onComplete: () => {
        this.tweens.add({
          targets: this.lincoln,
          x: tx,
          y: ty,
          duration: 130,
          ease: 'Quad.in',
          onComplete: () => {
            this.hopping = false;
            this.lincolnIndex += 1;
            this.scoreText.setText(`🚧 ${this.score}`);
            this.recycle();
            this.refreshAllHints();
          },
        });
      },
    });
    // Faster as you climb.
    this.hopWindow = Math.max(0.85, HOP_WINDOW_START - this.score * 0.05);
    this.hopDeadline = this.time.now + this.hopWindow * 1000;
  }

  private recycle(): void {
    // Scroll everything down one step so Lincoln stays low on screen.
    for (const p of this.plats) {
      p.y += GAP_Y;
      p.c.setY(p.y);
    }
    this.lincoln.y += GAP_Y;
    // Drop the platform we left, add a fresh one on top.
    const dropped = this.plats.shift();
    dropped?.c.destroy(true);
    this.lincolnIndex -= 1;
    const top = this.plats[this.plats.length - 1];
    const side = Math.random() < 0.5 ? -1 : 1;
    const nx = clamp(top.x + side * GAP_X, 90, GAME_WIDTH - 90);
    const ny = top.y - GAP_Y;
    this.plats.push(this.makePlat(nx, ny, side));
  }

  private fumble(msg: string): void {
    if (this.over) return;
    this.lives -= 1;
    this.livesText.setText('❤️'.repeat(Math.max(0, this.lives)) + '🤍'.repeat(3 - Math.max(0, this.lives)));
    this.cameras.main.shake(150, 0.005);
    audio.whine();
    this.popText(`${msg} (${Math.max(0, this.lives)} ❤️)`, GAME_WIDTH / 2, 320, '#e0627c');
    this.hopDeadline = this.time.now + this.hopWindow * 1000;
    if (this.lives <= 0) {
      this.finish();
    }
  }

  private finish(): void {
    if (this.over) return;
    this.over = true;

    const state = getState();
    const l = state.lincoln;
    const funGain = clamp(10 + this.score * 1.6, 0, 38);
    l.fun = clamp(l.fun + funGain);
    l.energy = clamp(l.energy - 14);
    l.thirst = clamp(l.thirst - 8);
    l.hunger = clamp(l.hunger - 4);
    l.cleanliness = clamp(l.cleanliness - (6 + (3 - Math.max(0, this.lives)) * 2));
    l.bond = clamp(l.bond + 2 + (this.score >= 15 ? 2 : 0));
    state.world.roomMess = clamp(state.world.roomMess + 4 + (3 - Math.max(0, this.lives)) * 2);
    const coins = 1 + Math.min(6, Math.floor(this.score / 6));
    addCoins(state, coins);
    audio.happy();
    saveNow();

    const title = this.lives <= 0 ? 'Tumbled off! 🤕' : this.score >= 20 ? 'Mountain goat! 🏆' : 'Nice climbing! 🚧';
    this.panel(title, [
      `Hops: ${this.score} · ❤️ ${Math.max(0, this.lives)}/3`,
      `Fun +${Math.round(funGain)} · 🪙 +${coins}`,
      this.score >= 15 ? 'Lincoln is pooped but proud.' : 'Practice those hops!',
    ]);
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
    this.panelButton(240, 472, 240, 60, 'Hop again', 0x5b7fb0, () => this.scene.restart());
    this.panelButton(240, 494 + 48, 240, 60, 'Back', 0x6ba84f, () => this.leave());
  }

  private leave(): void {
    this.scene.stop();
    if (this.scene.isPaused('Play')) this.scene.resume('Play');
    else this.scene.resume('Room');
  }

  private drawSky(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x9fd4e8, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0xf4d35e, 1);
    g.fillCircle(400, 90, 30);
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(120, 130, 120, 36);
    g.fillEllipse(300, 220, 90, 28);
    g.fillStyle(0x6ba84f, 1);
    g.fillRect(0, GAME_HEIGHT - 60, GAME_WIDTH, 60);
  }

  private createStatus(): void {
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.panel, 0.9);
    bg.fillRoundedRect(10, 10, GAME_WIDTH - 20, 80, 14);
    const title = this.add.text(24, 20, '🚧 Fence Hop!', {
      fontFamily: FONT, fontSize: '20px', color: '#f3e2c3', fontStyle: 'bold',
    });
    this.timerText = this.add
      .text(GAME_WIDTH - 24, 20, `${ROUND_TIME}s`, { fontFamily: FONT_MONO, fontSize: '18px', color: '#f3e2c3' })
      .setOrigin(1, 0);
    this.scoreText = this.add.text(24, 50, '🚧 0', { fontFamily: FONT, fontSize: '16px', color: '#d9c7a6' });
    this.livesText = this.add
      .text(GAME_WIDTH - 24, 50, '❤️❤️❤️', { fontFamily: FONT, fontSize: '16px', color: '#fff' })
      .setOrigin(1, 0);
    this.hopBar = this.add.graphics();
    this.ui.add([bg, title, this.timerText, this.scoreText, this.livesText, this.hopBar]);
  }

  private createTouchControls(): void {
    const mk = (x: number, label: string, dir: -1 | 1): void => {
      const b = this.add
        .text(x, 700, label, {
          fontFamily: FONT, fontSize: '44px', color: '#ffffff', fontStyle: 'bold',
          backgroundColor: '#3a2416cc', padding: { x: 22, y: 10 },
        })
        .setOrigin(0.5)
        .setDepth(21)
        .setInteractive({ useHandCursor: true });
      b.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.tryHop(dir);
      });
      this.ui.add(b);
    };
    mk(140, '◀', -1);
    mk(340, '▶', 1);
  }

  private banner(text: string): void {
    const label = this.add
      .text(GAME_WIDTH / 2, 320, text, {
        fontFamily: FONT, fontSize: '32px', color: '#f4d35e', fontStyle: 'bold',
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
      .text(x, y, text, { fontFamily: FONT, fontSize: '19px', color, fontStyle: 'bold', stroke: '#3a2416', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({ targets: t, y: y - 44, alpha: 0, duration: 800, onComplete: () => t.destroy() });
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
}
