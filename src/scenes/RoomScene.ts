import Phaser from 'phaser';
import {
  ACTIONS,
  COLORS,
  FLOOR_Y,
  FONT,
  FONT_MONO,
  GAME_HEIGHT,
  GAME_WIDTH,
  MOOD_EMOJI,
  STAT_DEFS,
} from '../config';
import { CALM_UNLOCK_DAY, ENDING_DAY, SHOP_UNLOCK_DAY } from '../config/shop';
import { weatherInfo } from '../config/weather';
import { audio } from '../audio/audio';
import {
  addCoins,
  applyAction,
  determineEnding,
  formatClock,
  hasItem,
  isAboutToPop,
  popIfOverstuffed,
  tick as tickState,
} from '../state/gameState';
import { getState, resetState, saveNow } from '../state/store';
import type { ActionKey, GameState, StatKey } from '../state/types';
import { ActionButton } from '../ui/ActionButton';
import { drawLincoln, LINCOLN_H, LINCOLN_PIXEL, LINCOLN_W } from '../ui/lincoln';
import { StatBar } from '../ui/StatBar';

const LINCOLN_FEET_Y = 650;
/** Where Lincoln cowers when it thunders. */
const HIDE_X = 140;
const HIDE_FEET_Y = 672;

const STAT_BAR_WIDTH = 356;
const STAT_BAR_TOP = 60;
const STAT_BAR_GAP = 24;

/** Swipeable rooms — Lincoln's little house. */
interface RoomDef {
  id: string;
  name: string;
  icon: string;
  hint: string;
}

const ROOMS: RoomDef[] = [
  { id: 'living', name: 'Living Room', icon: '🛋️', hint: 'Tap to pet · drag to grab him 👀' },
  { id: 'play', name: 'Playground', icon: '🎾', hint: 'Tap the ball to play!' },
  { id: 'bedroom', name: 'Bedroom', icon: '🛏️', hint: 'Tap the bed to sleep 😴' },
  { id: 'bathroom', name: 'Bathroom', icon: '🛁', hint: 'Tap the tub for bath time!' },
];

/** Which stat bars each room cares about — the HUD only shows those. */
const ROOM_STATS: Record<string, StatKey[]> = {
  living: ['hunger', 'thirst', 'fatness'],
  play: ['fun', 'energy'],
  bedroom: ['energy'],
  bathroom: ['cleanliness'],
};

/** What Lincoln wails when you grab him too hard. */
const GRAB_COMPLAINTS: string[] = [
  'hey!! put me down!!',
  'owww… that hurt!!',
  'my fur!! ;(',
  "that one'll leave a mark!!",
  "i'm telling mom!!",
  'hmpf!! >:(',
  'ow ow ow!!',
  'why are you like this!!',
];

/** The main room where you look after Lincoln. */
export class RoomScene extends Phaser.Scene {
  private state!: GameState;
  private readonly bars = new Map<StatKey, StatBar>();

  private dayText!: Phaser.GameObjects.Text;
  private clockText!: Phaser.GameObjects.Text;
  private moodText!: Phaser.GameObjects.Text;
  private moodSubText!: Phaser.GameObjects.Text;
  private hudPanel!: Phaser.GameObjects.Graphics;
  private resetBtn!: Phaser.GameObjects.Text;

  // Swipeable rooms.
  private roomIndex = 0;
  private roomArt!: Phaser.GameObjects.Container;
  private roomNavText!: Phaser.GameObjects.Text;
  private roomNavTap!: Phaser.GameObjects.Zone;
  private swipeStartX = 0;
  private swipeStartY = 0;
  private swipeStartT = 0;

  private lincolnContainer!: Phaser.GameObjects.Container;
  private lincolnArt!: Phaser.GameObjects.Graphics;
  private petZone!: Phaser.GameObjects.Zone;
  private renderedOutfit = '';
  // Grab-and-scar: hold & drag Lincoln around; every grab leaves a scratch.
  private scarArt!: Phaser.GameObjects.Graphics;
  private scars: Array<{ x: number; y: number; angle: number; born: number }> = [];
  private scarRedrawAt = 0;
  private grabbed = false;
  private downOnLincoln = false;
  private grabPointerId = -1;
  private grabDownX = 0;
  private grabDownY = 0;
  private grabX = 0;
  private grabY = 0;
  private speechBox?: Phaser.GameObjects.Container;
  private stink!: Phaser.GameObjects.Graphics;
  private messOverlay!: Phaser.GameObjects.Graphics;
  private waterOverlay!: Phaser.GameObjects.Graphics;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private moodBubble!: Phaser.GameObjects.Text;
  private weatherText!: Phaser.GameObjects.Text;
  private rainOverlay!: Phaser.GameObjects.Graphics;

  private bobPhase = 0;
  /** 0 → just hopped, 1 → hop finished. Tweened on action. */
  private hopT = 1;
  /** Current vertical scale (from fatness), used to anchor the stink cloud. */
  private lincolnScaleY = 1;

  private lastDay = 1;
  private saveAccumulator = 0;
  private persistenceBound = false;
  private calmButton?: ActionButton;
  private muteText!: Phaser.GameObjects.Text;
  private calmReadyAt = 0;
  private nextThunderAt = 0;
  /** 0 = out in the open, 1 = fully hidden under the table. */
  private hideAmount = 0;
  private hiding = false;
  private hideUntil = 0;
  // HUD text cache — avoids setText layout cost every frame on phones.
  private lastDayStr = '';
  private lastClockStr = '';
  private lastMoodStr = '';
  private lastMoodSubStr = '';
  private lastWeatherStr = '';
  private lastBubbleStr = '';

  constructor() {
    super('Room');
  }

  create(): void {
    this.state = getState();
    this.input.topOnly = true;
    this.lastDay = this.state.day;
    this.saveAccumulator = 0;
    this.roomIndex = 0;
    this.grabbed = false;
    this.downOnLincoln = false;
    this.grabPointerId = -1;
    this.scars = [];
    this.speechBox = undefined;
    this.nextThunderAt = this.time.now + Phaser.Math.Between(8000, 16000);

    this.roomArt = this.add.container(0, 0).setDepth(0);
    this.drawRoomFor(ROOMS[this.roomIndex].id, 0);
    this.createMessOverlays();
    this.createLincoln();
    this.createStinkCloud();
    this.createNightOverlay();
    this.createWeatherOverlay();
    this.createMoodBubble();
    this.createHud();
    this.createRoomNav();
    this.layoutHudFor(ROOMS[this.roomIndex].id);
    this.createActionButtons();
    this.bindPersistence();
    this.bindSwipe();

    // Reassure the player when they come back to a saved game.
    if (this.state.day > 1 || this.state.minutesElapsed > 8 * 60 + 5) {
      this.showBanner(`Welcome back · Day ${this.state.day}`);
    } else {
      this.showBanner('Swipe ← → to explore · Tap Lincoln 🐶');
    }
  }

  override update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.tick(dt);
    this.syncOutfit();
    this.animateLincoln(dt);
    this.updateScars();
    this.updateWeatherEvents();
    this.refreshHud();
    this.drawStinkCloud();
    this.updateMessOverlays();
    this.updateNight();
    this.drawWeather();
    this.maybeNewDay();
    this.checkEnding();
    this.autosave(dt);
  }

  // ── Simulation ──────────────────────────────────────────────────────────

  private tick(dt: number): void {
    tickState(this.state, dt);
  }

  private animateLincoln(dt: number): void {
    this.bobPhase += dt * 3;
    const idle = Math.sin(this.bobPhase) * 4;
    const hop = Math.sin(this.hopT * Math.PI) * 18;

    // The belly grows with fatness; near the limit he wobbles nervously.
    const fat = Phaser.Math.Clamp(this.state.lincoln.fatness / 100, 0, 1);
    const wobble = isAboutToPop(this.state.lincoln) ? Math.sin(this.bobPhase * 3.5) * 0.035 : 0;
    const scaleX = 1 + fat * 0.55 + wobble;
    const scaleY = 1 + fat * 0.3 - wobble;

    // Hide-under-the-table pose blends in as hideAmount rises.
    const hide = this.hideAmount;
    const shrink = Phaser.Math.Linear(1, 0.82, hide);
    const targetX = Phaser.Math.Linear(GAME_WIDTH / 2, HIDE_X, hide);
    const baseFeet = Phaser.Math.Linear(LINCOLN_FEET_Y, HIDE_FEET_Y, hide);
    const tremble = hide > 0.3 ? Math.sin(this.bobPhase * 22) * 1.6 * hide : 0;

    this.lincolnScaleY = scaleY * shrink;
    if (this.grabbed) {
      // Dangling from your grip — trails the finger and wiggles helplessly.
      const gx = Phaser.Math.Clamp(this.grabX, 70, GAME_WIDTH - 70);
      const gy = Phaser.Math.Clamp(this.grabY, 320, LINCOLN_FEET_Y + 12);
      const k = Math.min(1, dt * 18);
      this.lincolnContainer.x = Phaser.Math.Linear(this.lincolnContainer.x, gx, k);
      this.lincolnContainer.y = Phaser.Math.Linear(this.lincolnContainer.y, gy, k);
      this.lincolnContainer.rotation = Math.sin(this.bobPhase * 10) * 0.07;
    } else {
      this.lincolnContainer.x = targetX + tremble;
      this.lincolnContainer.y = baseFeet + idle * (1 - hide) - hop;
      this.lincolnContainer.rotation = 0;
    }
    this.lincolnContainer.setScale(scaleX * shrink, scaleY * shrink);

    // Keep the tap-to-pet zone glued to him (fat, hop, hide, grab + tremble).
    if (this.petZone) {
      this.petZone.setPosition(
        this.lincolnContainer.x,
        this.lincolnContainer.y - (LINCOLN_H * scaleY * shrink) / 2,
      );
    }

    const topY = this.lincolnContainer.y - LINCOLN_H * scaleY * shrink;
    this.moodBubble.setPosition(this.lincolnContainer.x + 56, topY + 24);
  }

  // ── Thunderstorms ───────────────────────────────────────────────────────

  private updateWeatherEvents(): void {
    const weather = this.state.weather;
    const stormy = weather === 'rainy' || weather === 'muddy';

    if (stormy && this.time.now >= this.nextThunderAt) this.triggerThunder();
    if (this.hiding && this.time.now >= this.hideUntil) this.stopHiding();
  }

  private triggerThunder(): void {
    this.nextThunderAt = this.time.now + Phaser.Math.Between(14000, 26000);

    audio.thunder();
    this.cameras.main.flash(320, 190, 210, 255);
    this.cameras.main.shake(300, 0.006);

    if (this.hiding) {
      this.hideUntil = this.time.now + 3500;
      // Wandered back outside mid-scare? Back inside with you.
      if (ROOMS[this.roomIndex].id === 'play') this.goToRoom(0, -1, false);
    } else {
      this.startHiding();
    }
  }

  private startHiding(): void {
    this.hiding = true;
    this.hideUntil = this.time.now + 3500;
    // Caught outside in the playground? He bolts for the living room first —
    // the table he cowers under only exists in there.
    if (ROOMS[this.roomIndex].id === 'play') {
      this.goToRoom(0, -1, false);
      this.floatText('⛈️ Thunder! Lincoln runs inside!', '#9fc6e0');
    } else {
      this.floatText('😨 Thunder! Lincoln hides!', '#9fc6e0');
    }
    this.tweens.add({ targets: this, hideAmount: 1, duration: 450, ease: 'Quad.out' });
  }

  private stopHiding(): void {
    this.hiding = false;
    this.tweens.add({ targets: this, hideAmount: 0, duration: 600, ease: 'Quad.out' });
  }

  // ── Rooms (swipeable) ───────────────────────────────────────────────────

  private drawRoomFor(id: string, dir: number): void {
    this.roomArt.removeAll(true);
    const g = this.add.graphics();
    this.roomArt.add(g);

    if (id === 'play') this.drawPlayground(g);
    else if (id === 'bedroom') this.drawBedroom(g);
    else if (id === 'bathroom') this.drawBathroom(g);
    else this.drawLiving(g);

    this.addRoomTappables(id);

    if (dir !== 0) {
      this.roomArt.x = dir * GAME_WIDTH;
      this.tweens.killTweensOf(this.roomArt);
      this.tweens.add({ targets: this.roomArt, x: 0, duration: 260, ease: 'Cubic.out' });
    } else {
      this.roomArt.x = 0;
    }
    this.updateRoomNav();
  }

  private goToRoom(index: number, dir?: number, announce = true): void {
    const next = (index + ROOMS.length) % ROOMS.length;
    if (next === this.roomIndex) return;
    const slide = dir ?? (next > this.roomIndex ? 1 : -1);
    this.roomIndex = next;
    if (announce) audio.click();
    this.drawRoomFor(ROOMS[this.roomIndex].id, slide);
    this.layoutHudFor(ROOMS[this.roomIndex].id);
    if (announce) this.floatText(`${ROOMS[this.roomIndex].icon} ${ROOMS[this.roomIndex].name}`, '#f6b23c');
  }

  private createRoomNav(): void {
    // Bare label, no background — sits just under the stat panel (see layoutHudFor).
    this.roomNavText = this.add
      .text(GAME_WIDTH / 2, 260, '', {
        fontFamily: FONT, fontSize: '15px', color: '#f3e2c3', fontStyle: 'bold',
        stroke: '#3a2416', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.updateRoomNav();

    // Swipe, or tap the label to stroll to the next room.
    this.roomNavTap = this.add
      .zone(GAME_WIDTH / 2, 260, GAME_WIDTH - 20, 44)
      .setInteractive({ useHandCursor: true });
    let navDownX = 0;
    let navDownY = 0;
    let navPressed = false;
    this.roomNavTap.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      navPressed = true;
      navDownX = pointer.x;
      navDownY = pointer.y;
    });
    this.roomNavTap.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!navPressed) return;
      navPressed = false;
      if (Math.hypot(pointer.x - navDownX, pointer.y - navDownY) > 24) return;
      this.goToRoom(this.roomIndex + 1, 1);
    });
  }

  private updateRoomNav(): void {
    if (!this.roomNavText) return;
    const dots = ROOMS.map((_, i) => (i === this.roomIndex ? '●' : '○')).join(' ');
    const room = ROOMS[this.roomIndex];
    this.roomNavText.setText(`${room.icon} ${room.name}  ${dots}`);
  }

  private bindSwipe(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.swipeStartX = pointer.x;
      this.swipeStartY = pointer.y;
      this.swipeStartT = this.time.now;
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      // Presses that started on Lincoln are grabs/pets, never room swipes.
      // (The grab handler is registered first, so it already ran.)
      if (this.downOnLincoln) {
        this.downOnLincoln = false;
        return;
      }
      // Ignore swipes starting on the bottom action bar so button taps keep working.
      if (this.swipeStartY > 620) return;
      const dx = pointer.x - this.swipeStartX;
      const dy = pointer.y - this.swipeStartY;
      const dt = this.time.now - this.swipeStartT;
      if (dt > 900 || Math.abs(dy) > 90) return;
      if (dx < -80) this.goToRoom(this.roomIndex + 1, 1);
      else if (dx > 80) this.goToRoom(this.roomIndex - 1, -1);
    });
  }

  /** In-room tap targets: bowl/ball/tub/bed shortcuts per room. */
  private addRoomTappables(id: string): void {
    // Keep every tappable above the bottom action bar (bar top ≈ 639)
    // so a tap on a button can never leak into a room shortcut.
    const tap = (x: number, y: number, w: number, h: number, action: () => void): void => {
      const clampedBottom = 630;
      let hh = h;
      let yy = y;
      if (yy + hh / 2 > clampedBottom) {
        hh = Math.max(20, clampedBottom - (yy - h / 2));
        yy = yy - h / 2 + hh / 2;
        if (hh <= 20) return;
      }
      const zone = this.add.zone(x, yy, w, hh).setInteractive({ useHandCursor: true });
      let zDownX = 0;
      let zDownY = 0;
      let zPressed = false;
      zone.on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        zPressed = true;
        zDownX = pointer.x;
        zDownY = pointer.y;
      });
      zone.on('pointerup', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        if (!zPressed) return;
        zPressed = false;
        if (Math.hypot(pointer.x - zDownX, pointer.y - zDownY) > 24) return;
        action();
      });
      this.roomArt.add(zone);
    };

    if (id === 'living') {
      // Bowl + ball visuals sit behind the action bar — their buttons already
      // cover Feed/Play, so only the tub stays tappable here.
      tap(396, 508, 150, 110, () => this.tryBath());
    } else if (id === 'play') {
      tap(240, 600, 220, 90, () => this.doAction('play'));
      tap(392, 560, 110, 90, () => this.doAction('play'));
    } else if (id === 'bedroom') {
      tap(240, 585, 330, 120, () => this.doAction('sleep'));
    } else if (id === 'bathroom') {
      tap(240, 580, 300, 130, () => this.tryBath());
    }
  }

  private drawLiving(g: Phaser.GameObjects.Graphics): void {
    // Wall with soft vertical stripes
    g.fillStyle(COLORS.wall, 1);
    g.fillRect(0, 0, GAME_WIDTH, FLOOR_Y);
    g.fillStyle(COLORS.wallDark, 0.35);
    for (let x = 0; x < GAME_WIDTH; x += 48) g.fillRect(x, 0, 24, FLOOR_Y);

    // Baseboard
    g.fillStyle(COLORS.brownDark, 1);
    g.fillRect(0, FLOOR_Y - 14, GAME_WIDTH, 14);

    // Floorboards
    g.fillStyle(COLORS.floor, 1);
    g.fillRect(0, FLOOR_Y, GAME_WIDTH, GAME_HEIGHT - FLOOR_Y);
    g.fillStyle(COLORS.floorDark, 0.5);
    for (let y = FLOOR_Y + 30; y < GAME_HEIGHT; y += 34) g.fillRect(0, y, GAME_WIDTH, 4);

    // Rug
    g.fillStyle(COLORS.rug, 1);
    g.fillEllipse(240, 655, 340, 130);
    g.fillStyle(COLORS.rugDark, 1);
    g.fillEllipse(240, 655, 260, 92);
    g.fillStyle(COLORS.rug, 1);
    g.fillEllipse(240, 655, 180, 60);

    this.drawTable(g, HIDE_X);
    this.drawBowl(g, 96, 700);
    this.drawBall(g, 392, 706);
    this.drawTub(g, 396, 508);
  }

  private drawPlayground(g: Phaser.GameObjects.Graphics): void {
    // Sky + sun + clouds
    g.fillStyle(0x9fd4e8, 1);
    g.fillRect(0, 0, GAME_WIDTH, FLOOR_Y);
    g.fillStyle(0xf4d35e, 1);
    g.fillCircle(400, 90, 34);
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(120, 110, 110, 36);
    g.fillEllipse(180, 96, 80, 30);
    // Fence
    g.fillStyle(0xffffff, 1);
    for (let x = 8; x < GAME_WIDTH; x += 44) g.fillRect(x, FLOOR_Y - 70, 14, 70);
    g.fillRect(0, FLOOR_Y - 70, GAME_WIDTH, 10);
    g.fillRect(0, FLOOR_Y - 34, GAME_WIDTH, 10);
    // Grass
    g.fillStyle(0x6ba84f, 1);
    g.fillRect(0, FLOOR_Y, GAME_WIDTH, GAME_HEIGHT - FLOOR_Y);
    g.fillStyle(0x5a9440, 1);
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      g.fillTriangle(x, FLOOR_Y + 60, x + 12, FLOOR_Y + 60, x + 6, FLOOR_Y + 44);
    }
    // Toys: big ball + frisbee
    this.drawBall(g, 240, 640);
    g.fillStyle(0xe0627c, 1);
    g.fillEllipse(392, 560, 72, 20);
    g.fillStyle(0xc74f68, 1);
    g.fillEllipse(392, 560, 40, 10);
  }

  private drawBedroom(g: Phaser.GameObjects.Graphics): void {
    // Night wall + window with moon
    g.fillStyle(0x3b4a6b, 1);
    g.fillRect(0, 0, GAME_WIDTH, FLOOR_Y);
    g.fillStyle(0x2c3852, 1);
    g.fillRect(0, 0, GAME_WIDTH, 120);
    g.fillStyle(0x8fa3c7, 1);
    g.fillRoundedRect(150, 140, 180, 160, 12);
    g.fillStyle(0x1a2340, 1);
    g.fillRoundedRect(162, 152, 156, 136, 8);
    g.fillStyle(0xf4f1de, 1);
    g.fillCircle(280, 190, 24);
    g.fillStyle(0x1a2340, 1);
    g.fillCircle(272, 184, 20);
    // Floor + rug
    g.fillStyle(0x6b4a2a, 1);
    g.fillRect(0, FLOOR_Y, GAME_WIDTH, GAME_HEIGHT - FLOOR_Y);
    g.fillStyle(0x8e5fb0, 1);
    g.fillEllipse(240, 660, 320, 110);
    // Bed: frame + mattress + blanket + pillow
    g.fillStyle(0x5b3a1e, 1);
    g.fillRoundedRect(75, 540, 330, 110, 14);
    g.fillStyle(0xfff3de, 1);
    g.fillRoundedRect(85, 522, 310, 50, 12);
    g.fillStyle(0x5b7fb0, 1);
    g.fillRoundedRect(85, 548, 310, 60, 12);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(95, 528, 80, 36, 10);
    // Lamp glow
    g.fillStyle(0xf4d35e, 0.25);
    g.fillCircle(410, 470, 60);
    g.fillStyle(0x3a2416, 1);
    g.fillRect(404, 500, 12, 60);
    g.fillStyle(0xf4d35e, 1);
    g.fillRoundedRect(388, 462, 44, 40, 8);
  }

  private drawBathroom(g: Phaser.GameObjects.Graphics): void {
    // Tiled wall + floor
    g.fillStyle(0xdfe8ea, 1);
    g.fillRect(0, 0, GAME_WIDTH, FLOOR_Y);
    g.lineStyle(2, 0xc3d1d5, 1);
    for (let x = 0; x <= GAME_WIDTH; x += 48) g.lineBetween(x, 0, x, FLOOR_Y);
    for (let y = 0; y <= FLOOR_Y; y += 48) g.lineBetween(0, y, GAME_WIDTH, y);
    g.fillStyle(0xc9d6d9, 1);
    g.fillRect(0, FLOOR_Y, GAME_WIDTH, GAME_HEIGHT - FLOOR_Y);
    // Big tub (center) + duck
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(240, 660, 300, 36);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(240 - 140, 560, 280, 100, { tl: 16, tr: 16, bl: 36, br: 36 });
    g.lineStyle(4, 0xd4e0e4, 1);
    g.strokeRoundedRect(240 - 140, 560, 280, 100, { tl: 16, tr: 16, bl: 36, br: 36 });
    g.fillStyle(COLORS.water, 0.9);
    g.fillEllipse(240, 562, 264, 34);
    // Rubber duck
    g.fillStyle(0xf4d35e, 1);
    g.fillCircle(180, 548, 18);
    g.fillCircle(196, 542, 12);
    g.fillStyle(0xe08a4a, 1);
    g.fillTriangle(206, 538, 216, 543, 206, 548);
    g.fillStyle(0x2b1b0e, 1);
    g.fillCircle(198, 538, 2.5);
    // Bubbles
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(280, 548, 7);
    g.fillCircle(300, 556, 5);
    g.fillCircle(262, 558, 4);
  }

  private drawTable(g: Phaser.GameObjects.Graphics, x: number): void {
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(x, 684, 214, 26);
    // Legs + cross bar
    g.fillStyle(0x6b4520, 1);
    g.fillRect(x - 74, 548, 15, 128);
    g.fillRect(x + 59, 548, 15, 128);
    g.fillRect(x - 68, 608, 136, 10);
    // Tabletop
    g.fillStyle(0x8a5a2b, 1);
    g.fillRoundedRect(x - 90, 522, 180, 24, 8);
    g.fillStyle(0xc0854f, 1);
    g.fillRoundedRect(x - 90, 522, 180, 9, 6);
  }

  private drawBowl(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(COLORS.brownDark, 1);
    g.fillEllipse(x, y, 78, 30);
    g.fillStyle(COLORS.brownLight, 1);
    g.fillEllipse(x, y + 4, 70, 26);
    g.fillStyle(0x6b4a2a, 1);
    g.fillEllipse(x, y + 1, 54, 16);
    // Kibble
    g.fillStyle(0x8a5a2b, 1);
    [[-12, -2], [0, -4], [12, -1], [-5, 3], [7, 3]].forEach(([dx, dy]) => {
      g.fillCircle(x + dx, y + dy, 4);
    });
  }

  private drawBall(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(x, y + 22, 46, 12);
    g.fillStyle(0x9bd35a, 1);
    g.fillCircle(x, y, 22);
    g.fillStyle(0xfff8ec, 1);
    g.fillRoundedRect(x - 21, y - 4, 42, 8, 4);
  }

  private drawTub(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(x, y + 30, 150, 20);
    // Tub body
    g.fillStyle(COLORS.white, 1);
    g.fillRoundedRect(x - 70, y - 40, 140, 74, { tl: 12, tr: 12, bl: 28, br: 28 });
    g.lineStyle(3, 0xd9cdbf, 1);
    g.strokeRoundedRect(x - 70, y - 40, 140, 74, { tl: 12, tr: 12, bl: 28, br: 28 });
    // Water
    g.fillStyle(COLORS.water, 1);
    g.fillEllipse(x, y - 30, 126, 26);
    g.fillStyle(COLORS.waterDark, 1);
    g.fillEllipse(x, y - 30, 126, 12);
    // Feet
    g.fillStyle(0xe4d9cb, 1);
    g.fillRoundedRect(x - 52, y + 30, 22, 12, 5);
    g.fillRoundedRect(x + 30, y + 30, 22, 12, 5);
  }

  private createLincoln(): void {
    // Origin sits at his feet so inflating grows the belly upward, kept grounded.
    this.lincolnContainer = this.add.container(GAME_WIDTH / 2, LINCOLN_FEET_Y).setDepth(4);
    this.lincolnArt = this.add.graphics();
    this.scarArt = this.add.graphics();
    this.lincolnContainer.add([this.lincolnArt, this.scarArt]);
    this.redrawLincoln();

    // Press = potential grab; quick tap without dragging = pet.
    // Sized for fat fingers (160x170) instead of the tight sprite box.
    this.petZone = this.add
      .zone(GAME_WIDTH / 2, LINCOLN_FEET_Y - LINCOLN_H / 2, 160, 170)
      .setInteractive({ useHandCursor: true });
    this.petZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.hideAmount > 0.5) return;
      // Presses that start on the bottom action bar belong to the buttons.
      if (pointer.y > 630) return;
      this.downOnLincoln = true;
      this.grabPointerId = pointer.id;
      this.grabDownX = pointer.x;
      this.grabDownY = pointer.y;
      this.grabX = pointer.x;
      this.grabY = pointer.y;
    });

    // Drag past a few pixels and you've grabbed him — he follows your finger.
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.grabPointerId) return;
      if (!pointer.isDown || !this.downOnLincoln || this.hideAmount > 0.5) return;
      if (!this.grabbed && Math.hypot(pointer.x - this.grabDownX, pointer.y - this.grabDownY) > 14) {
        this.grabbed = true;
      }
      if (this.grabbed) {
        this.grabX = pointer.x;
        this.grabY = pointer.y;
      }
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.grabPointerId) return;
      this.grabPointerId = -1;
      if (!this.downOnLincoln) return;
      if (this.grabbed) this.releaseGrab();
      else if (this.hideAmount <= 0.5) this.doAction('pet');
    });
  }

  private redrawLincoln(): void {
    this.renderedOutfit = this.state.lincoln.outfit;
    this.lincolnArt.clear();
    drawLincoln(this.lincolnArt, -LINCOLN_W / 2, -LINCOLN_H, LINCOLN_PIXEL, this.renderedOutfit);
  }

  /** Re-draw if the outfit changed while we were paused (e.g. in the Closet). */
  private syncOutfit(): void {
    if (this.state.lincoln.outfit !== this.renderedOutfit) this.redrawLincoln();
  }

  private createStinkCloud(): void {
    this.stink = this.add.graphics().setDepth(5);
  }

  private drawStinkCloud(): void {
    const alpha = Phaser.Math.Clamp(this.state.world.stinkMeter / 100, 0, 1);
    const g = this.stink;
    g.clear();
    if (alpha <= 0.02) return;

    // Anchored to Lincoln so it follows him under the table / while hopping.
    const cx = this.lincolnContainer.x;
    const cy = this.lincolnContainer.y - LINCOLN_H * this.lincolnScaleY - 26 + Math.sin(this.time.now / 400) * 4;
    const puffs = RoomScene.STINK_PUFFS;
    for (const [dx, dy, r] of puffs) {
      g.fillStyle(COLORS.stink, alpha * 0.5);
      g.fillCircle(cx + dx, cy + dy, r);
    }
    g.fillStyle(COLORS.stink, alpha * 0.7);
    for (const [dx, dy, r] of puffs) {
      g.fillCircle(cx + dx, cy + dy, r * 0.6);
    }
  }

  private static readonly STINK_PUFFS: Array<[number, number, number]> = [
    [0, 0, 26],
    [-28, 10, 20],
    [28, 8, 20],
    [-12, -18, 16],
    [18, -16, 16],
    [0, 16, 18],
  ];

  // ── Mess & water consequences ───────────────────────────────────────────

  private createMessOverlays(): void {
    // Static splots whose opacity is driven by the world's mess/water levels.
    this.messOverlay = this.add.graphics().setDepth(2).setAlpha(0);
    this.messOverlay.fillStyle(0x7a6a3a, 1);
    const dirt: Array<[number, number, number, number]> = [
      [120, 700, 60, 26],
      [320, 660, 44, 20],
      [200, 740, 80, 30],
      [360, 730, 40, 18],
      [90, 620, 34, 16],
    ];
    for (const [x, y, w, h] of dirt) this.messOverlay.fillEllipse(x, y, w, h);

    this.waterOverlay = this.add.graphics().setDepth(2).setAlpha(0);
    this.waterOverlay.fillStyle(COLORS.water, 0.75);
    const puddles: Array<[number, number, number, number]> = [
      [150, 640, 90, 34],
      [300, 700, 120, 40],
      [240, 730, 70, 26],
      [380, 640, 60, 24],
    ];
    for (const [x, y, w, h] of puddles) this.waterOverlay.fillEllipse(x, y, w, h);
  }

  private updateMessOverlays(): void {
    const { roomMess, waterLevel } = this.state.world;
    this.messOverlay.setAlpha(Phaser.Math.Clamp(roomMess / 100, 0, 0.85));
    this.waterOverlay.setAlpha(Phaser.Math.Clamp(waterLevel / 100, 0, 0.8));
  }

  // ── Day/night & mood ────────────────────────────────────────────────────

  private createNightOverlay(): void {
    this.nightOverlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1a2340, 1)
      .setOrigin(0, 0)
      .setDepth(6)
      .setAlpha(0);
  }

  private updateNight(): void {
    // Darkest before dawn and after dusk; clear through the middle of the day.
    const hour = (this.state.minutesElapsed / 60) % 24;
    let darkness = 0;
    if (hour < 7) darkness = ((7 - hour) / 7) * 0.42;
    else if (hour > 19) darkness = ((hour - 19) / 5) * 0.42;
    this.nightOverlay.setAlpha(Phaser.Math.Clamp(darkness, 0, 0.42));
  }

  private createWeatherOverlay(): void {
    this.rainOverlay = this.add.graphics().setDepth(7);
  }

  private drawWeather(): void {
    const g = this.rainOverlay;
    g.clear();
    const weather = this.state.weather;
    if (weather !== 'rainy' && weather !== 'muddy') return;
    // Rain only falls outside in the playground — indoors you just hear it.
    // (Flash + shake + thunderclap in triggerThunder stay global so he still panics.)
    if (ROOMS[this.roomIndex].id !== 'play') return;

    const heavy = weather === 'muddy';
    const count = heavy ? 46 : 34;
    const now = this.time.now;
    const color = heavy ? 0xb89a6a : 0x9fc6e0;
    g.lineStyle(2, color, heavy ? 0.5 : 0.4);

    for (let i = 0; i < count; i++) {
      const x = ((i * 7.3 + (i % 3) * 31) % 500) - 10;
      const speed = 0.45 + (i % 5) * 0.08;
      const len = heavy ? 22 : 16;
      const y = ((now * speed * 0.4 + i * 53) % (GAME_HEIGHT + 40)) - 20;
      g.lineBetween(x, y, x - 5, y + len);
    }
  }

  private createMoodBubble(): void {
    this.moodBubble = this.add.text(0, 0, '🙂', { fontSize: '30px' }).setOrigin(0.5).setDepth(7);
  }

  private maybeNewDay(): void {
    if (this.state.day === this.lastDay) return;
    this.lastDay = this.state.day;
    this.state.lincoln.bond = Phaser.Math.Clamp(this.state.lincoln.bond + 2, 0, 100);

    let message = `☀️ Day ${this.state.day}`;
    if (this.state.day === SHOP_UNLOCK_DAY) message = `🛒 Day ${this.state.day} — the Shop is open!`;
    else if (this.state.day === CALM_UNLOCK_DAY) message = `🧘 Day ${this.state.day} — Calm Down unlocked!`;
    this.showBanner(message);
  }

  private checkEnding(): void {
    if (this.state.day < ENDING_DAY || this.state.ending || this.scene.isActive('Ending')) return;
    this.state.ending = determineEnding(this.state);
    saveNow();
    this.scene.launch('Ending');
    this.scene.pause();
  }

  private showBanner(text: string): void {
    const label = this.add
      .text(GAME_WIDTH / 2, 330, text, {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#fff3de',
        fontStyle: 'bold',
        stroke: '#3a2416',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(90)
      .setScale(0.7);
    this.tweens.add({ targets: label, scale: 1, duration: 380, ease: 'Back.out' });
    this.tweens.add({
      targets: label,
      alpha: 0,
      delay: 1000,
      duration: 600,
      onComplete: () => label.destroy(),
    });
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  private readonly onHide = (): void => saveNow();
  private readonly onVisibility = (): void => {
    if (document.hidden) saveNow();
  };

  private bindPersistence(): void {
    if (this.persistenceBound) return;
    this.persistenceBound = true;
    window.addEventListener('beforeunload', this.onHide);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('beforeunload', this.onHide);
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.persistenceBound = false;
    });
  }

  private autosave(dt: number): void {
    this.saveAccumulator += dt;
    if (this.saveAccumulator >= 5) {
      this.saveAccumulator = 0;
      saveNow();
    }
  }

  private resetGame(): void {
    resetState();
    saveNow();
    this.scene.restart();
  }

  // ── HUD ─────────────────────────────────────────────────────────────────

  private createHud(): void {
    this.hudPanel = this.add.graphics().setDepth(10);
    this.hudPanel.fillStyle(COLORS.panel, 0.82);
    this.hudPanel.fillRoundedRect(10, 12, GAME_WIDTH - 20, 232, 16);
    this.hudPanel.lineStyle(3, COLORS.brownLight, 0.5);
    this.hudPanel.strokeRoundedRect(10, 12, GAME_WIDTH - 20, 232, 16);

    this.dayText = this.add
      .text(26, 26, 'Day 1', {
        fontFamily: FONT,
        fontSize: '18px',
        color: '#f3e2c3',
        fontStyle: 'bold',
      })
      .setDepth(10);

    this.clockText = this.add
      .text(GAME_WIDTH - 26, 26, '08:00', {
        fontFamily: FONT_MONO,
        fontSize: '18px',
        color: '#f3e2c3',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(10);

    this.weatherText = this.add
      .text(GAME_WIDTH / 2, 26, '☀️ Sunny', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#f3e2c3',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setDepth(10);

    STAT_DEFS.forEach((def, index) => {
      const bar = new StatBar(
        this,
        30,
        STAT_BAR_TOP + index * STAT_BAR_GAP,
        STAT_BAR_WIDTH,
        def.icon,
        def.color,
        def.dangerAt,
      );
      bar.setDepth(10);
      this.bars.set(def.key, bar);
    });

    // Two-line status: mood on line 1, wallet on line 2 — readable on phones.
    this.moodText = this.add
      .text(30, 208, '', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#f3e2c3',
        fontStyle: 'bold',
      })
      .setDepth(10);
    this.moodSubText = this.add
      .text(30, 226, '', {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#d9c7a6',
      })
      .setDepth(10);

    // Mute + New game — 44px touch targets for phones.
    this.muteText = this.add
      .text(GAME_WIDTH - 62, 217, audio.isMuted() ? '🔇' : '🔊', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#d9c7a6',
        padding: { x: 10, y: 10 },
      })
      .setOrigin(1, 0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    this.muteText.on('pointerup', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      audio.toggleMuted();
      this.muteText.setText(audio.isMuted() ? '🔇' : '🔊');
    });

    this.resetBtn = this.add
      .text(GAME_WIDTH - 14, 217, '↺', {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#d9c7a6',
        fontStyle: 'bold',
        padding: { x: 10, y: 8 },
      })
      .setOrigin(1, 0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    this.resetBtn.on('pointerover', () => this.resetBtn.setColor('#fff3de'));
    this.resetBtn.on('pointerout', () => this.resetBtn.setColor('#d9c7a6'));
    this.resetBtn.on('pointerup', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.resetGame();
    });
  }

  /** Show only this room's stat bars; stack them and shrink the panel to fit. */
  private layoutHudFor(roomId: string): void {
    const keys = ROOM_STATS[roomId] ?? [];
    let y = STAT_BAR_TOP;
    for (const def of STAT_DEFS) {
      const bar = this.bars.get(def.key);
      if (!bar) continue;
      const show = keys.includes(def.key);
      bar.setVisible(show);
      if (show) {
        bar.setY(y);
        y += STAT_BAR_GAP;
      }
    }

    this.moodText.setY(y + 4);
    this.moodSubText.setY(y + 22);
    this.muteText.setY(y + 13);
    this.resetBtn.setY(y + 13);

    const bottom = y + 22 + 18;
    this.hudPanel.clear();
    this.hudPanel.fillStyle(COLORS.panel, 0.82);
    this.hudPanel.fillRoundedRect(10, 12, GAME_WIDTH - 20, bottom - 12, 16);
    this.hudPanel.lineStyle(3, COLORS.brownLight, 0.5);
    this.hudPanel.strokeRoundedRect(10, 12, GAME_WIDTH - 20, bottom - 12, 16);

    // Park the bare room label just under the stat panel.
    if (this.roomNavText && this.roomNavTap) {
      const labelY = bottom + 16;
      this.roomNavText.setY(labelY);
      this.roomNavTap.setY(labelY);
    }
  }

  private refreshHud(): void {
    const { lincoln, world, day, minutesElapsed } = this.state;
    this.bars.get('hunger')!.repaint(lincoln.hunger);
    this.bars.get('thirst')!.repaint(lincoln.thirst);
    this.bars.get('fun')!.repaint(lincoln.fun);
    this.bars.get('energy')!.repaint(lincoln.energy);
    this.bars.get('cleanliness')!.repaint(lincoln.cleanliness);
    this.bars.get('fatness')!.repaint(lincoln.fatness);

    const dayStr = `Day ${day}`;
    if (dayStr !== this.lastDayStr) {
      this.lastDayStr = dayStr;
      this.dayText.setText(dayStr);
    }
    const clockStr = formatClock(minutesElapsed);
    if (clockStr !== this.lastClockStr) {
      this.lastClockStr = clockStr;
      this.clockText.setText(clockStr);
    }
    const moodStr = `Mood: ${lincoln.mood}`;
    if (moodStr !== this.lastMoodStr) {
      this.lastMoodStr = moodStr;
      this.moodText.setText(moodStr);
    }
    const moodSubStr =
      `🪙 ${this.state.coins} · Bond ${Math.round(lincoln.bond)}% · Mess ${Math.round(world.roomMess)}%`;
    if (moodSubStr !== this.lastMoodSubStr) {
      this.lastMoodSubStr = moodSubStr;
      this.moodSubText.setText(moodSubStr);
    }
    const bubbleStr =
      this.grabbed ? '😭' : this.hideAmount > 0.5 ? '😨' : isAboutToPop(lincoln) ? '😵' : MOOD_EMOJI[lincoln.mood];
    if (bubbleStr !== this.lastBubbleStr) {
      this.lastBubbleStr = bubbleStr;
      this.moodBubble.setText(bubbleStr);
    }
    const wInfo = weatherInfo(this.state.weather);
    const weatherStr = `${wInfo.icon} ${wInfo.name}`;
    if (weatherStr !== this.lastWeatherStr) {
      this.lastWeatherStr = weatherStr;
      this.weatherText.setText(weatherStr);
    }
    this.calmButton?.setVisible(day >= CALM_UNLOCK_DAY);
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  private createActionButtons(): void {
    const row1: Array<{ key: ActionKey; label: string; color: number }> = [
      { key: 'feed', label: 'Feed', color: 0xc97a3d },
      { key: 'play', label: 'Play', color: 0x6ba84f },
      { key: 'sleep', label: 'Sleep', color: 0x5b7fb0 },
      { key: 'bath', label: 'Bath', color: 0x4aa3c7 },
    ];
    const row2: Array<{ key: ActionKey; label: string; color: number }> = [
      { key: 'closet', label: 'Closet', color: 0x8e5fb0 },
      { key: 'shop', label: 'Shop', color: 0xc98a2b },
      { key: 'rival', label: 'Rival', color: 0xb56a5a },
      { key: 'calm', label: 'Calm', color: 0x4aa39a },
    ];

    const width = 104;
    const height = 62;
    const gap = 10;

    const layoutRow = (defs: typeof row1, y: number): void => {
      const total = width * defs.length + gap * (defs.length - 1);
      const startX = (GAME_WIDTH - total) / 2 + width / 2;
      defs.forEach((def, index) => {
        const button = new ActionButton(this, startX + index * (width + gap), y, width, height, {
          icon: ACTIONS[def.key].icon,
          label: def.label,
          color: def.color,
          onClick: () => this.doAction(def.key),
        });
        button.setDepth(20);
        if (def.key === 'calm') this.calmButton = button;
      });
    };

    layoutRow(row1, 670);
    layoutRow(row2, 744);
    this.calmButton?.setVisible(this.state.day >= CALM_UNLOCK_DAY);
  }

  private doAction(key: ActionKey): void {
    if (key === 'bath') {
      this.tryBath();
      return;
    }

    if (key === 'sleep' || key === 'closet') {
      const sceneKey = key === 'sleep' ? 'Sleep' : 'Closet';
      if (this.scene.isActive(sceneKey)) return;
      audio.click();
      saveNow();
      this.scene.launch(sceneKey);
      this.scene.pause();
      return;
    }

    if (key === 'shop') {
      if (this.state.day < SHOP_UNLOCK_DAY) {
        this.floatText(`🛒 Shop unlocks on Day ${SHOP_UNLOCK_DAY}!`, '#f6b23c');
        return;
      }
      if (this.scene.isActive('Shop')) return;
      audio.click();
      saveNow();
      this.scene.launch('Shop');
      this.scene.pause();
      return;
    }

    if (key === 'rival') {
      if (this.scene.isActive('Rival')) return;
      audio.click();
      saveNow();
      this.scene.launch('Rival');
      this.scene.pause();
      return;
    }

    if (key === 'calm') {
      this.doCalm();
      return;
    }

    audio.click();
    const toast = applyAction(this.state, key);
    if (toast) this.floatText(`${ACTIONS[key].icon} ${toast}`);

    const l = this.state.lincoln;
    if (key === 'feed') {
      if (hasItem(this.state, 'treats')) {
        l.hunger = Phaser.Math.Clamp(l.hunger + 10, 0, 100);
        l.bond = Phaser.Math.Clamp(l.bond + 1, 0, 100);
      }
      addCoins(this.state, 1);
    } else if (key === 'play') {
      if (hasItem(this.state, 'jokes')) {
        l.fun = Phaser.Math.Clamp(l.fun + 8, 0, 100);
        l.bond = Phaser.Math.Clamp(l.bond + 2, 0, 100);
        audio.happy();
      }
      addCoins(this.state, 2);
    } else if (key === 'pet') {
      addCoins(this.state, 1);
      // Searching for the hidden shampoo.
      if (this.state.shampooHidden && Math.random() < 0.5) {
        this.state.shampooHidden = false;
        addCoins(this.state, 2);
        audio.coin();
        this.floatText('🧴 Found the shampoo!', '#9bd35a');
      }
    }

    if (key === 'feed' && popIfOverstuffed(this.state)) {
      audio.pop();
      this.blowUp();
    } else if (key === 'pet') {
      audio.bark();
      this.spawnHearts();
    } else {
      this.hopLincoln();
    }
    this.refreshHud();
    saveNow();
  }

  /** Bath entry, including Lincoln's revenge: sometimes he hides the shampoo. */
  private tryBath(): void {
    if (this.scene.isActive('Bath')) return;

    if (this.state.shampooHidden) {
      audio.bark();
      this.floatText('🦝 The shampoo is hidden! Pet Lincoln to search.', '#c98a2b');
      return;
    }

    if (this.state.lincoln.cleanliness < 30 && Math.random() < 0.35) {
      this.state.shampooHidden = true;
      audio.bark();
      saveNow();
      this.floatText('🦝 Lincoln hid the shampoo! Find it!', '#c98a2b');
      return;
    }

    audio.click();
    saveNow();
    this.scene.launch('Bath');
    this.scene.pause();
  }

  /** The "Calm Down" mechanic, mastered on Day 10. */
  private doCalm(): void {
    if (this.state.day < CALM_UNLOCK_DAY) return;
    if (this.time.now < this.calmReadyAt) {
      this.floatText('🧘 Give him a moment…', '#d9c7a6');
      return;
    }
    this.calmReadyAt = this.time.now + 15000;

    const l = this.state.lincoln;
    l.fun = Phaser.Math.Clamp(l.fun + 10, 0, 100);
    l.bond = Phaser.Math.Clamp(l.bond + 2, 0, 100);
    this.state.world.stinkMeter = Phaser.Math.Clamp(this.state.world.stinkMeter - 12, 0, 100);

    audio.happy();
    this.floatText('🧘 Calm down, buddy…', '#4aa39a');
    this.spawnHearts();
    this.refreshHud();
    saveNow();
  }

  private hopLincoln(): void {
    this.hopT = 0;
    this.tweens.killTweensOf(this);
    this.tweens.add({ targets: this, hopT: 1, duration: 320, ease: 'Quad.out' });
  }

  // ── Grab & scars ──────────────────────────────────────────────────────────

  /** Called on release after dragging Lincoln: scratch, tears and a complaint. */
  private releaseGrab(): void {
    this.grabbed = false;
    this.lincolnContainer.rotation = 0;

    // Every grab leaves a little scratch (max 6, they fade over a minute).
    const now = this.time.now;
    this.scars.push({
      x: Phaser.Math.Between(-LINCOLN_W / 2 + 14, LINCOLN_W / 2 - 14),
      y: Phaser.Math.Between(-LINCOLN_H + 16, -16),
      angle: Phaser.Math.FloatBetween(-0.5, 0.5),
      born: now,
    });
    if (this.scars.length > 6) this.scars.shift();
    this.redrawScars();

    audio.whine();
    this.spawnTears();
    this.showSpeech(Phaser.Math.RND.pick(GRAB_COMPLAINTS));

    this.state.lincoln.bond = Phaser.Math.Clamp(this.state.lincoln.bond - 1, 0, 100);
    this.hopLincoln();
    this.refreshHud();
    saveNow();
  }

  private redrawScars(): void {
    const g = this.scarArt;
    if (!g) return;
    g.clear();
    const now = this.time.now;
    this.scars = this.scars.filter((s) => now - s.born < 60000);
    for (const s of this.scars) {
      const alpha = Phaser.Math.Clamp(1 - (now - s.born) / 60000, 0, 1);
      const dx = (Math.cos(s.angle) * 12) / 2;
      const dy = (Math.sin(s.angle) * 12) / 2;
      g.lineStyle(2, 0xb0413e, alpha);
      // Three parallel claw lines.
      for (let i = -1; i <= 1; i++) {
        const ox = -dy * i * 0.45;
        const oy = dx * i * 0.45;
        g.lineBetween(s.x - dx + ox, s.y - dy + oy, s.x + dx + ox, s.y + dy + oy);
      }
    }
  }

  /** Fades scars out over a minute without redrawing the sprite every frame. */
  private updateScars(): void {
    // Released outside the canvas (no pointerup fired)? Let go of him.
    if (this.grabbed && !this.isGrabPointerDown()) this.releaseGrab();
    if (this.scars.length === 0) return;
    if (this.time.now >= this.scarRedrawAt) {
      this.scarRedrawAt = this.time.now + 500;
      this.redrawScars();
    }
  }

  private isGrabPointerDown(): boolean {
    if (this.grabPointerId < 0) return false;
    const candidates = [this.input.activePointer, this.input.pointer1, this.input.pointer2];
    return candidates.some(
      (p) => p !== undefined && p !== null && p.id === this.grabPointerId && p.isDown,
    );
  }

  private spawnTears(): void {
    const cx = this.lincolnContainer.x + 18;
    const cy = this.lincolnContainer.y - LINCOLN_H * this.lincolnScaleY * 0.72;
    for (let i = 0; i < 5; i++) {
      const tear = this.add
        .circle(cx + Phaser.Math.Between(-14, 14), cy, Phaser.Math.Between(3, 5), 0x5aa9d6)
        .setDepth(65);
      this.tweens.add({
        targets: tear,
        y: cy + Phaser.Math.Between(40, 80),
        alpha: 0,
        duration: 650,
        delay: i * 90,
        ease: 'Cubic.in',
        onComplete: () => tear.destroy(),
      });
    }
  }

  /** Lincoln's own speech bubble — his side of the story. */
  private showSpeech(text: string): void {
    this.speechBox?.destroy();
    const cx = Phaser.Math.Clamp(this.lincolnContainer.x, 140, GAME_WIDTH - 140);
    const cy = this.lincolnContainer.y - LINCOLN_H * this.lincolnScaleY - 66;
    const box = this.add.container(cx, cy).setDepth(66);
    const w = Math.max(130, text.length * 10 + 30);
    const g = this.add.graphics();
    g.fillStyle(0xfff3de, 1);
    g.fillRoundedRect(-w / 2, -22, w, 40, 12);
    g.lineStyle(2, 0x3a2416, 1);
    g.strokeRoundedRect(-w / 2, -22, w, 40, 12);
    g.fillStyle(0xfff3de, 1);
    g.fillTriangle(-8, 18, 8, 18, 0, 30);
    const label = this.add
      .text(0, -2, text, {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#3a2416',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    box.add([g, label]);
    this.speechBox = box;
    this.tweens.add({
      targets: box,
      y: cy - 26,
      alpha: 0,
      delay: 900,
      duration: 500,
      ease: 'Cubic.in',
      onComplete: () => {
        if (this.speechBox === box) this.speechBox = undefined;
        box.destroy();
      },
    });
  }

  /** Lincoln was fed past his limit. Cue the mess. */
  private blowUp(): void {
    const cx = this.lincolnContainer.x;
    const cy = this.lincolnContainer.y - LINCOLN_H * this.lincolnScaleY * 0.5;

    this.cameras.main.shake(420, 0.014);
    this.cameras.main.flash(220, 255, 244, 214);

    const colors = [COLORS.brown, COLORS.brownDark, COLORS.cream, 0xd98b3a, 0xffffff];
    for (let i = 0; i < 30; i++) {
      const bit = this.add
        .circle(cx, cy, Phaser.Math.Between(4, 10), colors[i % colors.length])
        .setDepth(70);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(90, 260);
      this.tweens.add({
        targets: bit,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.3,
        duration: 750,
        ease: 'Cubic.out',
        onComplete: () => bit.destroy(),
      });
    }

    const pop = this.add
      .text(cx, cy - 40, 'POP!', {
        fontFamily: FONT,
        fontSize: '64px',
        color: '#fff3de',
        fontStyle: 'bold',
        stroke: '#5b3a1e',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(80)
      .setScale(0.4);
    this.tweens.add({
      targets: pop,
      scale: 1.15,
      alpha: { from: 1, to: 0 },
      duration: 950,
      ease: 'Back.out',
      onComplete: () => pop.destroy(),
    });

    this.floatText('💥 Stuffed to bursting — he popped!', '#e0627c');
  }

  private spawnHearts(): void {
    const baseX = this.lincolnContainer.x;
    const baseY = this.lincolnContainer.y - LINCOLN_H + 40;
    for (let i = 0; i < 4; i++) {
      const heart = this.add
        .text(baseX + Phaser.Math.Between(-46, 46), baseY, '💛', {
          fontSize: '26px',
        })
        .setOrigin(0.5)
        .setDepth(60);
      this.tweens.add({
        targets: heart,
        y: '-=90',
        alpha: 0,
        duration: 900 + i * 120,
        ease: 'Cubic.out',
        onComplete: () => heart.destroy(),
      });
    }
  }

  private floatText(text: string, color = '#fff3de'): void {
    const label = this.add
      .text(GAME_WIDTH / 2, 470, text, {
        fontFamily: FONT,
        fontSize: '20px',
        color,
        fontStyle: 'bold',
        stroke: '#3a2416',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({
      targets: label,
      y: '-=60',
      alpha: 0,
      duration: 1300,
      ease: 'Cubic.out',
      onComplete: () => label.destroy(),
    });
  }
}
