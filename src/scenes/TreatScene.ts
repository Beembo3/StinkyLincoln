import Phaser from 'phaser';
import { COLORS, FONT, FONT_MONO, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { audio } from '../audio/audio';
import { addCoins, clamp, hasItem, popIfOverstuffed } from '../state/gameState';
import { getState, saveNow } from '../state/store';
import { drawLincoln, LINCOLN_H, LINCOLN_PIXEL, LINCOLN_W } from '../ui/lincoln';

const BOWL_Y = 648;
const CATCH_Y_MIN = 600;
const CATCH_Y_MAX = 692;
const ROUND_TIME = 45;

const GOOD = ['🦴', '🍖', '🍪', '🧀', '🍎'];
const BAD = ['💩', '🧦', '🟤'];

interface Falling {
  obj: Phaser.GameObjects.Text;
  vy: number;
  good: boolean;
}

/**
 * Treat Toss (Pou Food Drop, Lincoln edition).
 * Slide the bowl / Lincoln left-right, catch snacks, dodge mud & socks.
 * Too many snacks raises Chonk — he can pop mid-results, just like feeding.
 */
export class TreatScene extends Phaser.Scene {
  private ui!: Phaser.GameObjects.Container;
  private layer!: Phaser.GameObjects.Container;

  private lincoln!: Phaser.GameObjects.Container;
  private bowl!: Phaser.GameObjects.Container;
  private bowlX = 240;
  private targetX = 240;

  private items: Falling[] = [];
  private nextSpawnAt = 0;
  private startAt = 0;
  private over = false;

  private goodCaught = 0;
  private badCaught = 0;
  private missed = 0;

  private titleText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;

  private leftKey?: Phaser.Input.Keyboard.Key;
  private rightKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Treat');
  }

  create(): void {
    this.items = [];
    this.bowlX = 240;
    this.targetX = 240;
    this.goodCaught = 0;
    this.badCaught = 0;
    this.missed = 0;
    this.over = false;
    this.startAt = this.time.now;
    this.nextSpawnAt = this.time.now + 400;

    this.drawYard();
    this.layer = this.add.container(0, 0).setDepth(5);
    this.ui = this.add.container(0, 0).setDepth(20);

    const art = this.add.graphics();
    drawLincoln(art, -LINCOLN_W / 2, -LINCOLN_H, LINCOLN_PIXEL, getState().lincoln.outfit);
    this.lincoln = this.add.container(240, BOWL_Y + 40, [art]);
    this.layer.add(this.lincoln);
    this.drawBowlGraphic();

    this.createStatus();
    const kb = this.input.keyboard;
    this.leftKey = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.targetX = p.worldX;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.targetX = p.worldX;
    });
    this.banner('Catch the snacks! 🧺');
  }

  override update(_time: number, delta: number): void {
    if (this.over) return;
    const dt = Math.min(delta, 50) / 1000;
    const elapsed = (this.time.now - this.startAt) / 1000;
    const left = Math.max(0, ROUND_TIME - elapsed);

    // Bowl follows finger, arrows nudge too.
    const speed = 420;
    if (this.leftKey?.isDown) this.targetX -= speed * dt;
    if (this.rightKey?.isDown) this.targetX += speed * dt;
    this.targetX = clamp(this.targetX, 50, GAME_WIDTH - 50);
    this.bowlX = Phaser.Math.Linear(this.bowlX, this.targetX, Math.min(1, dt * 14));
    this.lincoln.setX(this.bowlX);
    this.bowl.setX(this.bowlX);

    // Spawn faster as the round goes on.
    if (this.time.now >= this.nextSpawnAt) {
      this.spawnOne(elapsed / ROUND_TIME);
      const gap = Phaser.Math.Linear(850, 420, elapsed / ROUND_TIME);
      this.nextSpawnAt = this.time.now + gap * Phaser.Math.FloatBetween(0.7, 1.2);
    }

    const vyScale = dt;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.obj.y += it.vy * vyScale;
      // Catch?
      if (it.obj.y >= CATCH_Y_MIN && it.obj.y <= CATCH_Y_MAX && Math.abs(it.obj.x - this.bowlX) < 58) {
        this.collect(i, it);
        continue;
      }
      if (it.obj.y > GAME_HEIGHT - 60) {
        if (it.good) this.missed += 1;
        it.obj.destroy();
        this.items.splice(i, 1);
      }
    }

    this.timerText.setText(`${left.toFixed(0)}s`);
    this.scoreText.setText(`😋 ${this.goodCaught} · 🤢 ${this.badCaught}`);

    if (left <= 0) this.finish();
  }

  private spawnOne(progress: number): void {
    const good = Math.random() > 0.28;
    const emoji = good ? Phaser.Math.RND.pick(GOOD) : Phaser.Math.RND.pick(BAD);
    const obj = this.add
      .text(Phaser.Math.Between(40, GAME_WIDTH - 40), -30, emoji, { fontSize: '34px' })
      .setOrigin(0.5)
      .setDepth(6);
    this.layer.add(obj);
    const vy = Phaser.Math.Linear(240, 430, clamp(progress, 0, 1)) * Phaser.Math.FloatBetween(0.9, 1.2);
    this.items.push({ obj, vy, good });
  }

  private collect(index: number, it: Falling): void {
    it.obj.destroy();
    this.items.splice(index, 1);
    if (it.good) {
      this.goodCaught += 1;
      audio.coin();
      this.popText('+1 😋', this.bowlX, BOWL_Y - 120, '#9bd35a');
    } else {
      this.badCaught += 1;
      audio.splash();
      this.cameras.main.shake(120, 0.004);
      this.popText('ew! 🤢', this.bowlX, BOWL_Y - 120, '#e0627c');
    }
  }

  private finish(): void {
    this.over = true;
    for (const it of this.items) it.obj.destroy();
    this.items = [];

    const state = getState();
    const l = state.lincoln;
    const jokes = hasItem(state, 'jokes');

    const funGain = clamp(12 + this.goodCaught * 2 + (jokes ? 4 : 0), 0, 40);
    l.fun = clamp(l.fun + funGain);
    l.hunger = clamp(l.hunger + Math.min(30, this.goodCaught * 3));
    l.fatness = clamp(l.fatness + this.goodCaught * 2);
    l.energy = clamp(l.energy - 12);
    l.thirst = clamp(l.thirst - 8);
    l.cleanliness = clamp(l.cleanliness - (5 + this.badCaught * 2));
    l.bond = clamp(l.bond + 2 + (this.goodCaught >= 12 ? 2 : 0));
    state.world.roomMess = clamp(state.world.roomMess + 4 + this.badCaught * 3 + this.goodCaught * 0.5);
    const coins = 1 + Math.min(6, Math.floor(this.goodCaught / 4));
    addCoins(state, coins);
    const popped = popIfOverstuffed(state);
    if (popped) audio.pop();
    else audio.happy();
    saveNow();

    this.showResults(funGain, coins, popped);
  }

  private showResults(funGain: number, coins: number, popped: boolean): void {
    const panel = this.add.graphics().setDepth(30);
    panel.fillStyle(COLORS.panel, 0.95);
    panel.fillRoundedRect(40, 190, GAME_WIDTH - 80, popped ? 400 : 360, 18);
    this.ui.add(panel);

    const lines = popped
      ? ['💥 HE POPPED!', `Ate ${this.goodCaught} snacks... too many!`, `Fun +${Math.round(funGain)} · 🪙 +${coins}`, 'Mess everywhere. Worth it?']
      : this.goodCaught >= 15
        ? ['Snack champion! 🏆', `😋 ${this.goodCaught} caught · 🤢 ${this.badCaught} oops`, `Fun +${Math.round(funGain)} · 🪙 +${coins}`, 'Lincoln is thrilled (and round).']
        : [`😋 ${this.goodCaught} snacks!`, `🤢 ${this.badCaught} yucky · missed ${this.missed}`, `Fun +${Math.round(funGain)} · 🪙 +${coins}`, 'Chonk grew a little...'];
    lines.forEach((text, i) => {
      const t = this.add
        .text(GAME_WIDTH / 2, 250 + i * 52, text, {
          fontFamily: FONT, fontSize: i === 0 ? '26px' : '18px', color: i === 0 ? '#fff3de' : '#d9c7a6',
          fontStyle: 'bold', align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(31);
      this.ui.add(t);
    });

    this.panelButton(240, popped ? 540 : 510, 240, 64, 'Play again', 0xc98a2b, () => this.scene.restart());
    this.panelButton(240, popped ? 616 : 586, 240, 64, 'Back', 0x6ba84f, () => this.leave());
  }

  private leave(): void {
    this.scene.stop();
    if (this.scene.isPaused('Play')) this.scene.resume('Play');
    else {
      this.scene.resume('Room');
    }
  }

  private drawYard(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x9fd4e8, 1);
    g.fillRect(0, 0, GAME_WIDTH, 560);
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(120, 110, 110, 34);
    g.fillStyle(0x6ba84f, 1);
    g.fillRect(0, 560, GAME_WIDTH, GAME_HEIGHT - 560);
  }

  private drawBowlGraphic(): void {
    const g = this.add.graphics();
    g.fillStyle(0x8a5a2b, 1);
    g.fillEllipse(0, 22, 110, 34);
    g.fillStyle(0xc0854f, 1);
    g.fillEllipse(0, 26, 96, 28);
    this.bowl = this.add.container(this.bowlX, BOWL_Y + 56, [g]).setDepth(4);
    this.layer.add(this.bowl);
  }

  private createStatus(): void {
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.panel, 0.9);
    bg.fillRoundedRect(10, 10, GAME_WIDTH - 20, 80, 14);
    this.titleText = this.add.text(24, 20, '🧺 Treat Toss!', {
      fontFamily: FONT, fontSize: '20px', color: '#f3e2c3', fontStyle: 'bold',
    });
    this.timerText = this.add
      .text(GAME_WIDTH - 24, 20, `${ROUND_TIME}s`, { fontFamily: FONT_MONO, fontSize: '18px', color: '#f3e2c3' })
      .setOrigin(1, 0);
    this.scoreText = this.add.text(24, 50, '', { fontFamily: FONT, fontSize: '16px', color: '#d9c7a6' });
    this.ui.add([bg, this.titleText, this.timerText, this.scoreText]);
  }

  private banner(text: string): void {
    const label = this.add
      .text(GAME_WIDTH / 2, 320, text, {
        fontFamily: FONT, fontSize: '34px', color: '#f4d35e', fontStyle: 'bold',
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
