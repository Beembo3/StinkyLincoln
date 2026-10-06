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
  private downFired = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    config: ActionButtonConfig,
  ) {
    super(scene, x, y);

    // Shadow (visual only).
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillRoundedRect(-width / 2, -height / 2 + 5, width, height, 14);

    // The REAL hit target: a Rectangle GameObject. Rectangles have a solid
    // origin-0.5 hit test, unlike Containers with custom Geom hit areas
    // which are easy to offset and leave dead spots.
    const bg = scene.add.rectangle(0, 0, width, height, config.color);
    bg.setInteractive({ useHandCursor: true });

    // Rounded overlay so it still looks chunky (drawn over the rect).
    const face = scene.add.graphics();
    face.fillStyle(config.color, 1);
    face.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    face.lineStyle(3, COLORS.cream, 0.25);
    face.strokeRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 12);

    const icon = scene.add.text(0, -12, config.icon, { fontSize: '30px' }).setOrigin(0.5);
    const label = scene.add
      .text(0, 20, config.label, {
        fontFamily: FONT,
        fontSize: '16px',
        color: '#fff8ec',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add([shadow, bg, face, icon, label]);
    this.setSize(width, height);

    bg.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch) this.setScale(1.04);
    });
    bg.on('pointerout', () => {
      this.setScale(1);
    });
    // Fire on DOWN — maximally forgiving on touch (no slip-to-cancel).
    // Swipes starting here are already ignored by the scene's swipe guard
    // (swipeStartY > 620), and room tappables only fire on tap-up.
    bg.on(
      'pointerdown',
      (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.downFired = true;
        this.setScale(0.92);
        config.onClick();
        void pointer;
      },
    );
    // Backup for mouse users who press elsewhere and release here.
    bg.on(
      'pointerup',
      (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.setScale(1);
        if (!this.downFired) config.onClick();
        this.downFired = false;
      },
    );
    bg.on('pointerupoutside', () => {
      this.downFired = false;
      this.setScale(1);
    });

    scene.add.existing(this);
  }
}
