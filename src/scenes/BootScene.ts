import Phaser from 'phaser';
import { audio } from '../audio/audio';
import { FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { createLogo } from '../ui/logo';

/** Flip to true after dropping the real artwork at `public/logo.png`. */
const USE_LOGO_IMAGE = true;

/** Splash / loading screen. Tapping here unlocks audio and starts the game. */
export class BootScene extends Phaser.Scene {
  private started = false;
  private prompt!: Phaser.GameObjects.Text;

  constructor() {
    super('Boot');
  }

  preload(): void {
    if (USE_LOGO_IMAGE) this.load.image('logo', 'logo.png');
  }

  create(): void {
    this.started = false;

    // Warm backdrop — pure black so the real logo PNG (black bg) blends seamlessly.
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Logo (real image if available, otherwise the drawn one)
    let logo: Phaser.GameObjects.GameObject;
    if (USE_LOGO_IMAGE && this.textures.exists('logo')) {
      const img = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, 'logo');
      img.setScale(Math.min(1, 440 / img.width));
      img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      logo = img;
    } else {
      logo = createLogo(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, 1);
    }
    this.tweens.add({
      targets: logo,
      y: '-=8',
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    // Loading bar
    const barW = 320;
    const barX = GAME_WIDTH / 2 - barW / 2;
    const barY = GAME_HEIGHT - 200;
    const track = this.add.graphics();
    track.fillStyle(0x000000, 0.4);
    track.fillRoundedRect(barX, barY, barW, 22, 11);
    const fill = this.add.graphics();

    const label = this.add
      .text(GAME_WIDTH / 2, barY - 22, 'Sniffing around…', {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#f3e2c3',
      })
      .setOrigin(0.5);

    this.prompt = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 120, 'Tap to start', {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#f6b23c',
        fontStyle: 'bold',
        stroke: '#5b3a1e',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: this.prompt, alpha: { from: 0.3, to: 1 }, duration: 700, yoyo: true, repeat: -1 });

    // Fake-but-cozy load progress.
    const progress = { value: 0 };
    this.tweens.add({
      targets: progress,
      value: 1,
      duration: 1100,
      ease: 'Cubic.out',
      onUpdate: () => {
        fill.clear();
        fill.fillStyle(0x6ba84f, 1);
        const w = Math.max(0, (barW - 6) * progress.value);
        if (w > 0) fill.fillRoundedRect(barX + 3, barY + 3, w, 16, 8);
      },
      onComplete: () => {
        label.setText('Ready!');
      },
    });

    const tagline = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 158, 'A very good, very stinky boy', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#d9c7a6',
      })
      .setOrigin(0.5);
    tagline.setAlpha(0.9);

    this.input.once('pointerdown', () => this.start());
    this.input.keyboard?.once('keydown', () => this.start());
  }

  private start(): void {
    if (this.started) return;
    this.started = true;

    audio.unlock();
    audio.bark();
    audio.startMusic();

    this.cameras.main.fadeOut(300, 20, 15, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Room'));
  }
}
