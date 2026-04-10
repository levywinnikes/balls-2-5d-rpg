import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // Assets iniciais (loading screen, etc)
    this.load.image("logo", "logo192.png");
  }

  create() {
    this.scene.start("TitleScene");
  }
}
