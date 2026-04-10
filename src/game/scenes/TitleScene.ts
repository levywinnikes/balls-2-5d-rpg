import Phaser from "phaser";
import { SaveSystem } from "../systems/SaveSystem";

export default class TitleScene extends Phaser.Scene {
  private saveSystem!: SaveSystem;
  private isElectron: boolean = false;

  constructor() {
    super("TitleScene");
  }

  create() {
    this.saveSystem = new SaveSystem(this);
    this.isElectron = !!(window as any).electronAPI;

    // Background - Keep strictly as a black background placeholder
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000).setOrigin(0);

    // No logic needed here anymore as MainMenuUI (React) handles everything.
    // This scene just sits here until App.tsx switches to GameScene.
  }

  // Obsolete methods removed to prevent ghost UI / DOM leaks
}
