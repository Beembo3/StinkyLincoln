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
    this.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains,
    );
    this.input!.cursor = 'pointer';

    this.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch) this.setScale(1.04);
    });
    this.on('pointerout', () => this.setScale(1));
    this.on('pointerdown', () => {
      this.setScale(0.92);
      config.onClick();
    });
    this.on('pointerup', () => this.setScale(1));

    scene.add.existing(this);
  }
}
