import Phaser from 'phaser';
import { COLORS, FONT } from '../config';

export interface ActionButtonConfig {
  icon: string;
  label: string;
  color: number;
  onClick: () => void;
}

/** A chunky rounded action button with an icon and label. */
export class ActionButton extends Phaser.GameObjects.Container {
  private pressed = false;
  private downX = 0;
  private downY = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    config: ActionButtonConfig,
  ) {
    super(scene, x, y);

    const g = scene.add.graphics();
    // Drop shadow
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(-width / 2, -height / 2 + 5, width, height, 14);
    // Body
    g.fillStyle(config.color, 1);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    // Highlight rim
    g.lineStyle(3, COLORS.cream, 0.25);
    g.strokeRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 12);

    const icon = scene.add.text(0, -12, config.icon, { fontSize: '28px' }).setOrigin(0.5);
    const label = scene.add
      .text(0, 20, config.label, {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#fff8ec',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add([g, icon, label]);
    this.setSize(width, height);
    // Slightly generous touch target so the whole visual is tappable,
    // without bleeding into the neighbour (neighbours sit 10px away).
    const PAD_X = 4;
    const PAD_Y = 6;
    this.setInteractive(
      new Phaser.Geom.Rectangle(
        -width / 2 - PAD_X,
        -height / 2 - PAD_Y,
        width + PAD_X * 2,
        height + PAD_Y * 2,
      ),
      Phaser.Geom.Rectangle.Contains,
    );
    if (this.input) this.input.cursor = 'pointer';

    this.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch && !this.pressed) this.setScale(1.04);
    });
    this.on('pointerout', () => {
      if (!this.pressed) this.setScale(1);
    });
    // Press visual on down, activate on up (a real tap). This stops swipes
    // that start on a button from firing it, and stops one press from
    // leaking into the room tappables underneath.
    this.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.pressed = true;
        this.downX = pointer.x;
        this.downY = pointer.y;
        this.setScale(0.92);
      },
    );
    this.on(
      'pointerup',
      (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        const wasPressed = this.pressed;
        this.pressed = false;
        this.setScale(1);
        if (!wasPressed) return;
        // Finger/tree slip tolerance — a drag is not a tap.
        if (Math.hypot(pointer.x - this.downX, pointer.y - this.downY) > 24) return;
        config.onClick();
      },
    );
    this.on('pointerupoutside', () => {
      this.pressed = false;
      this.setScale(1);
    });

    scene.add.existing(this);
  }
}
