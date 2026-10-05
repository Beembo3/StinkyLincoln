import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { COLORS, FONT, FONT_MONO, GAME_WIDTH } from '../config';
import { addCoins, clamp } from '../state/gameState';
import { getState, saveNow } from '../state/store';
import { drawLincoln, LINCOLN_H, LINCOLN_PIXEL, LINCOLN_W } from '../ui/lincoln';
import { drawPixelMap } from '../ui/pixelArt';

/** Bruno, the neighbour's scruffy grey rival. */
const RIVAL_MAP: string[] = [
  '................',
  '..GG........GG..',
  '..GGG......GGG..',
  '..GGGGGGGGGGGG..',
  '..GGGGGGGGGGGG..',
  '..GGKKGGGGKKGG..',
  '..GGKKGGGGKKGG..',
  '..GGGGWWWWGGGG..',
  '..GGGGWKKWGGGG..',
  '..GGGGWWWWGGGG..',
  '...GGGWWWWGGG...',
  '..GGGGWWWWGGGG..',
  '..GGGGGGGGGGGG..',
  '..GGGGGGGGGGGG..',
  '..GWWGGGGGGWWG..',
  '...WWGGGGGGWW...',
];
const RIVAL_PALETTE: Record<string, number> = {
  G: 0x9aa0a6,
  D: 0x6b7075,
  W: 0xffffff,
  K: 0x2b1b0e,
  P: 0xe08a8a,
};

const PREVIEW_PIXEL = 5;
const FIGHT_START_CLEAN = 60;
const FIGHT_SECONDS = 20;
const PLAYER_MIN = 6;
const PLAYER_MAX = 9;
const PLAYER_COOLDOWN_MS = 240;
const BRUNO_MIN = 5;
const BRUNO_MAX = 8;

const LINCOLN_POS = { x: 140, y: 250 };
const BRUNO_POS = { x: 340, y: 250 };

type FightStage = 'fight' | 'result';
type Winner = 'lincoln' | 'bruno' | 'draw';

/**
 * Mud Fight — a literal rival battle. Lincoln vs Bruno, dirtiest wins.
 * Mash MUD (or Space / tap Bruno) to sling mud at Bruno while his AI
 * slings it back. First to 0% Clean wins instantly, otherwise the
 * dirtier dog at 0:00 takes it.
 */
export class RivalScene extends Phaser.Scene {
  private stage: FightStage = 'fight';
  private lincolnClean = FIGHT_START_CLEAN;
  private brunoClean = FIGHT_START_CLEAN;

  private lincolnBox!: Phaser.GameObjects.Container;
  private brunoBox!: Phaser.GameObjects.Container;
  private lincolnDirt!: Phaser.GameObjects.Graphics;
  private brunoDirt!: Phaser.GameObjects.Graphics;

  private timerText!: Phaser.GameObjects.Text;
  private lincolnBar!: Phaser.GameObjects.Graphics;
  private brunoBar!: Phaser.GameObjects.Graphics;
  private lincolnLabel!: Phaser.GameObjects.Text;
  private brunoLabel!: Phaser.GameObjects.Text;
  private lastLincolnPct = -1;
  private lastBrunoPct = -1;
  private lastTimerStr = '';

  private resultLayer!: Phaser.GameObjects.Container;
  private fightEndsAt = 0;
  private nextBrunoAt = 0;
  private lastThrowAt = 0;
  private spaceKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Rival');
  }

  create(): void {
    this.stage = 'fight';
    this.lincolnClean = FIGHT_START_CLEAN;
    this.brunoClean = FIGHT_START_CLEAN;
    this.lastLincolnPct = -1;
    this.lastBrunoPct = -1;
    this.lastTimerStr = '';
    this.lastThrowAt = 0;

    this.add.rectangle(0, 0, 480, 800, 0x2c1b0e, 1).setOrigin(0, 0).setDepth(0);
    const glow = this.add.graphics().setDepth(1);
    glow.fillStyle(0x3a2416, 1);
    glow.fillCircle(240, 330, 260);

    this.add
      .text(240, 36, '🐾 Mud Fight!', {
        fontFamily: FONT, fontSize: '26px', color: '#fff3de', fontStyle: 'bold',
        stroke: '#3a2416', strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.timerText = this.add
      .text(240, 72, '', {
        fontFamily: FONT_MONO, fontSize: '22px', color: '#f6b23c', fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.add
      .text(240, 102, 'Dirtiest wins! First to 0% Clean — or dirtiest at 0:00.', {
        fontFamily: FONT, fontSize: '14px', color: '#d9c7a6', align: 'center',
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5)
      .setDepth(5);

    this.drawPet(LINCOLN_POS.x, LINCOLN_POS.y, 'lincoln');
    this.drawPet(BRUNO_POS.x, BRUNO_POS.y, 'rival');

    this.lincolnBar = this.add.graphics().setDepth(6);
    this.brunoBar = this.add.graphics().setDepth(6);
    this.lincolnLabel = this.add
      .text(LINCOLN_POS.x, 460, '', {
        fontFamily: FONT, fontSize: '14px', color: '#d9c7a6',
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.brunoLabel = this.add
      .text(BRUNO_POS.x, 460, '', {
        fontFamily: FONT, fontSize: '14px', color: '#d9c7a6',
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.drawBars();

    // Bruno taps back on his own; later days make him slightly meaner.
    const day = getState().day;
    const headStart = Math.max(0, 1200 - day * 40);
    this.fightEndsAt = this.time.now + FIGHT_SECONDS * 1000;
    this.nextBrunoAt = this.time.now + 900 + headStart;

    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.stage !== 'fight') return;
      // Tapping Bruno directly also slings mud (big MUD button below for thumbs).
      if (Math.hypot(pointer.worldX - BRUNO_POS.x, pointer.worldY - 300) < 110) this.throwMud();
    });

    this.resultLayer = this.add.container(0, 0).setDepth(20);

    this.createButton(240, 706, 280, 76, '🟤 MUD!', 0x8a5a2b, () => this.throwMud());

    this.banner('Dirtiest wins!');
    audio.bark();
  }

  override update(): void {
    if (this.stage !== 'fight') return;

    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.throwMud();

    const now = this.time.now;
    const leftMs = Math.max(0, this.fightEndsAt - now);
    const t = `${(leftMs / 1000).toFixed(1)}s`;
    if (t !== this.lastTimerStr) {
      this.lastTimerStr = t;
      this.timerText.setText(t);
    }

    // Bruno's AI: slings back on a timer, faster when he's losing.
    if (now >= this.nextBrunoAt) {
      this.brunoThrow();
      const losing = this.brunoClean > this.lincolnClean;
      const base = Phaser.Math.Between(900, 1400);
      this.nextBrunoAt = now + (losing ? base * 0.8 : base);
    }

    if (this.lincolnClean <= 0 || this.brunoClean <= 0) {
      this.finish(this.winnerNow());
    } else if (leftMs <= 0) {
      this.finish(this.winnerNow());
    }
  }

  // ── Fighting ────────────────────────────────────────────────────────────

  private throwMud(): void {
    if (this.stage !== 'fight') return;
    const now = this.time.now;
    if (now - this.lastThrowAt < PLAYER_COOLDOWN_MS) return;
    this.lastThrowAt = now;

    const dmg = Phaser.Math.Between(PLAYER_MIN, PLAYER_MAX);
    this.brunoClean = clamp(this.brunoClean - dmg);
    audio.splash();
    this.splat(BRUNO_POS.x, 300);
    this.punch(this.brunoBox);
    this.drawBars();
    this.drawDirt();
  }

  private brunoThrow(): void {
    if (this.stage !== 'fight') return;
    const dmg = Phaser.Math.Between(BRUNO_MIN, BRUNO_MAX);
    this.lincolnClean = clamp(this.lincolnClean - dmg);
    audio.splash();
    this.splat(LINCOLN_POS.x, 300);
    this.punch(this.lincolnBox);
    this.drawBars();
    this.drawDirt();
  }

  private winnerNow(): Winner {
    if (this.lincolnClean < this.brunoClean) return 'lincoln';
    if (this.brunoClean < this.lincolnClean) return 'bruno';
    return 'draw';
  }

  // ── Result ──────────────────────────────────────────────────────────────

  private finish(winner: Winner): void {
    this.stage = 'result';
    this.timerText.setText(winner === 'lincoln' ? '🏆 Lincoln!' : winner === 'bruno' ? '💀 Bruno!' : '🤝 Draw!');

    const state = getState();
    const dirtTaken = FIGHT_START_CLEAN - this.lincolnClean;

    // The fight always leaves Lincoln a little filthy — it was mud, after all —
    // but it's great play: fun up, room messy.
    state.lincoln.cleanliness = clamp(state.lincoln.cleanliness - 4 - dirtTaken * 0.25);
    state.lincoln.fun = clamp(state.lincoln.fun + (winner === 'lincoln' ? 14 : 10));
    state.world.roomMess = clamp(state.world.roomMess + 16);
    state.rivalStink = clamp(100 - this.brunoClean);

    let coins = 0;
    const alreadyToday = state.smellOffDay === state.day;
    if (!alreadyToday) {
      state.smellOffDay = state.day;
      if (winner === 'lincoln') coins = 5;
      else if (winner === 'draw') coins = 2;
      if (coins > 0) addCoins(state, coins);
    }
    if (winner === 'lincoln') {
      state.lincoln.bond = clamp(state.lincoln.bond + 2);
      audio.happy();
      audio.coin();
    } else if (winner === 'draw') {
      state.lincoln.bond = clamp(state.lincoln.bond + 1);
      audio.happy();
    } else {
      audio.bark();
    }
    saveNow();

    const headline =
      winner === 'lincoln'
        ? '🏆 Lincoln wins! Bruno is the clean one. Shameful.'
        : winner === 'bruno'
          ? '💀 Bruno wins! Lincoln got out-dirtied.'
          : "🤝 Draw! Equally filthy. Everyone's proud.";
    const sub =
      coins > 0
        ? `+${coins} coins 🪙 · muddy but happy (+fun, +mess)`
        : alreadyToday
          ? 'Come back tomorrow for coin rewards. (+fun, +mess)'
          : 'Muddy but happy! (+fun, +mess)';

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 0.94);
    panel.fillRoundedRect(40, 430, GAME_WIDTH - 80, 190, 18);
    panel.lineStyle(3, COLORS.brownLight, 0.6);
    panel.strokeRoundedRect(40, 430, GAME_WIDTH - 80, 190, 18);
    this.resultLayer.add(panel);

    const head = this.add
      .text(240, 478, headline, {
        fontFamily: FONT, fontSize: '19px',
        color: winner === 'bruno' ? '#e0627c' : '#9bd35a',
        fontStyle: 'bold', align: 'center', wordWrap: { width: 360 },
      })
      .setOrigin(0.5);
    const detail = this.add
      .text(240, 548, `Lincoln ${Math.round(this.lincolnClean)}% clean · Bruno ${Math.round(this.brunoClean)}% clean\n${sub}`, {
        fontFamily: FONT, fontSize: '15px', color: '#d9c7a6', align: 'center',
      })
      .setOrigin(0.5);
    this.resultLayer.add([head, detail]);

    this.createButton(240, 596, 220, 52, 'Rematch', 0xc98a2b, () => this.rematch());
    this.createButton(240, 664, 220, 56, 'Done', 0x6ba84f, () => this.leave());
  }

  private rematch(): void {
    this.scene.restart();
  }

  private leave(): void {
    audio.click();
    this.scene.stop();
    this.scene.resume('Room');
  }

  // ── Drawing ─────────────────────────────────────────────────────────────

  private drawPet(cx: number, top: number, kind: 'lincoln' | 'rival'): void {
    const box = this.add.container(cx, top + 80).setDepth(5);
    const g = this.add.graphics();
    const w = (LINCOLN_W / LINCOLN_PIXEL) * PREVIEW_PIXEL;
    if (kind === 'lincoln') {
      drawLincoln(g, -w / 2, -80, PREVIEW_PIXEL, getState().lincoln.outfit);
      this.lincolnBox = box;
      this.lincolnDirt = this.add.graphics().setDepth(6);
    } else {
      drawPixelMap(g, RIVAL_MAP, RIVAL_PALETTE, -w / 2, -80, PREVIEW_PIXEL);
      this.brunoBox = box;
      this.brunoDirt = this.add.graphics().setDepth(6);
    }
    box.add(g);

    const h = (LINCOLN_H / LINCOLN_PIXEL) * PREVIEW_PIXEL;
    const name = kind === 'lincoln' ? 'Lincoln' : 'Bruno';
    this.add
      .text(cx, top + h + 18, name, {
        fontFamily: FONT, fontSize: '20px', color: '#f3e2c3', fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.drawDirt();
  }

  /** Brown splotches grow as each dog gets dirtier. */
  private drawDirt(): void {
    if (!this.lincolnDirt || !this.brunoDirt) return;
    this.paintDirt(this.lincolnDirt, LINCOLN_POS.x, 300, FIGHT_START_CLEAN - this.lincolnClean);
    this.paintDirt(this.brunoDirt, BRUNO_POS.x, 300, FIGHT_START_CLEAN - this.brunoClean);
  }

  private paintDirt(g: Phaser.GameObjects.Graphics, cx: number, cy: number, dirt: number): void {
    g.clear();
    const spots = Math.floor(clamp(dirt, 0, 60) / 10);
    const offsets: Array<[number, number, number]> = [
      [-24, -30, 9], [22, -42, 8], [0, -10, 10],
      [-18, -58, 7], [26, -18, 7], [6, -48, 6],
    ];
    g.fillStyle(0x6b4a2a, 0.85);
    for (let i = 0; i < spots && i < offsets.length; i++) {
      const [dx, dy, r] = offsets[i];
      g.fillCircle(cx + dx, cy + dy, r);
    }
  }

  private drawBars(): void {
    this.lastLincolnPct = this.paintBar(this.lincolnBar, this.lincolnLabel, LINCOLN_POS.x, this.lincolnClean, this.lastLincolnPct);
    this.lastBrunoPct = this.paintBar(this.brunoBar, this.brunoLabel, BRUNO_POS.x, this.brunoClean, this.lastBrunoPct);
  }

  private paintBar(g: Phaser.GameObjects.Graphics, label: Phaser.GameObjects.Text, cx: number, clean: number, lastPct: number): number {
    const pct = Math.round(clamp(clean, 0, 100));
    if (pct === lastPct) return lastPct;
    const barW = 150;
    const barX = cx - barW / 2;
    const barY = 430;
    g.clear();
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(barX, barY, barW, 16, 8);
    if (pct > 0) {
      g.fillStyle(clean <= 20 ? COLORS.danger : clean <= 40 ? COLORS.warn : COLORS.good, 1);
      g.fillRoundedRect(barX + 2, barY + 2, ((barW - 4) * pct) / 100, 12, 6);
    }
    // Label redrawn via existing text scan: remove stale then add fresh.
    label.setText(`Clean ${pct}%`);
    return pct;
  }

  private splat(x: number, y: number): void {
    for (let i = 0; i < 7; i++) {
      const drop = this.add
        .circle(x + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-20, 10), Phaser.Math.Between(4, 9), i % 2 ? 0x6b4a2a : 0x8a5a2b)
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

  private punch(target: Phaser.GameObjects.Container): void {
    this.tweens.killTweensOf(target);
    target.setScale(1);
    this.tweens.add({ targets: target, scale: { from: 1.12, to: 1 }, duration: 180, ease: 'Quad.out' });
  }

  private banner(text: string): void {
    const label = this.add
      .text(GAME_WIDTH / 2, 220, text, {
        fontFamily: FONT, fontSize: '34px', color: '#f4d35e', fontStyle: 'bold',
        stroke: '#3a2416', strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(40);
    this.tweens.add({
      targets: label,
      scale: { from: 0.6, to: 1.05 },
      alpha: { from: 1, to: 0 },
      duration: 1000,
      ease: 'Cubic.out',
      onComplete: () => label.destroy(),
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
      .text(0, 0, label, { fontFamily: FONT, fontSize: '24px', color: '#ffffff', fontStyle: 'bold' })
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
    if (this.stage === 'result') this.resultLayer.add(container);
  }
}
