import Phaser from 'phaser';
import { audio } from './audio/audio';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { RoomScene } from './scenes/RoomScene';
import { BathScene } from './scenes/BathScene';
import { SleepScene } from './scenes/SleepScene';
import { ClosetScene } from './scenes/ClosetScene';
import { ShopScene } from './scenes/ShopScene';
import { EndingScene } from './scenes/EndingScene';
import { RivalScene } from './scenes/RivalScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.wall,
  pixelArt: true,
  roundPixels: true,
  disableContextMenu: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
  },
  scene: [BootScene, RoomScene, BathScene, SleepScene, ClosetScene, ShopScene, EndingScene, RivalScene],
};

const game = new Phaser.Game(config);

// Exposed for debugging and automated smoke tests.
(window as unknown as { __game: Phaser.Game; __audio: typeof audio }).__game = game;
(window as unknown as { __game: Phaser.Game; __audio: typeof audio }).__audio = audio;
