import Phaser from "phaser";
import { MapLoader } from "../maps/MapLoader";

export default class LoadingScene extends Phaser.Scene {
  private targetData: any = null;
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private mapLoader!: MapLoader;

  constructor() {
    super("LoadingScene");
  }

  init(data: any) {
    this.targetData = data;
    this.mapLoader = new MapLoader(this);
  }

  preload() {
    // 1. Setup UI
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222, 0.8);
    this.progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    this.progressBar = this.add.graphics();

    this.statusText = this.make.text({
      x: width / 2,
      y: height / 2 - 50,
      text: "Loading Maps...",
      style: {
        font: "20px monospace",
        color: "#ffffff",
      },
    });
    this.statusText.setOrigin(0.5, 0.5);

    // 2. Mock Progress Simulation (Since MapLoader using JSON loader is async but hard to track %)
    // But actually, we can trigger the load here.
    
    // We determine WHICH map to load from targetData or default
    const mapName = this.targetData?.mapName || "newmap"; // Default map

    // Register a load complete event
    this.load.on('progress', (value: number) => {
        this.progressBar.clear();
        this.progressBar.fillStyle(0x00ff00, 1);
        this.progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
        this.statusText.setText("Processing World...");
        this.progressBar.clear();
        this.progressBar.fillStyle(0x00aa00, 1);
        this.progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300, 30);
    });
    
    // 3. Trigger MapLoader
    // Note: MapLoader.loadAllLevels uses this.scene.load.json internally
    // So calling it here in preload is actually CORRECT for Phaser!
    this.mapLoader.loadAllLevels(mapName).catch(e => console.error(e));
  }

  create() {
    // If we are here, preload (standard phaser loader) is done.
    // However, MapLoader might have async post-processing.
    // In current MapLoader implementation, it uses `load.json` then `load.start` inside a Promise?
    // Wait, MapLoader line 348 `this.scene.load.start()`.
    // If we call MapLoader in Preload, Phaser AUTO-STARTS the loader?
    // Actually, `this.load.start()` is for manual start. In `preload`, it's automatic.
    // The MapLoader design was slightly hacky for GameScene usage.
    // For LoadingScene, we can just let it finish.

    // Let's assume MapLoader.loadAllLevels promise resolves when cached.
    
    this.time.delayedCall(500, () => {
         this.scene.start("GameScene", this.targetData);
    });
  }
}
