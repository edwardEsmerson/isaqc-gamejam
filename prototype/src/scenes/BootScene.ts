import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    this.add.rectangle(160, 90, 296, 156).setStrokeStyle(1, 0x596486);
    this.add.text(160, 67, 'QURIOSITY', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#f4bd7a',
    }).setOrigin(0.5);
    this.add.text(160, 103, 'Phaser is ready', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#c6d5f5',
    }).setOrigin(0.5);
  }
}
