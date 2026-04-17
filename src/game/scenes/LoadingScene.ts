/**
 * LOADING SCENE
 * Hub for streaming BMS metadata and binary level chunks.
 * AI GUIDANCE: See /docs/AI_READ_FIRST.md and /docs/SYSTEM_BMS.md
 */
import Phaser from "phaser";
import { MapLoader } from "../maps/MapLoader";
import { WorldMapService } from "../../services/WorldMapService";

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
      text: "Connecting to World...",
      style: {
        font: "20px monospace",
        color: "#ffffff",
      },
    });
    this.statusText.setOrigin(0.5, 0.5);

    // 2. Standard Phaser Progress Handling
    this.load.on("progress", (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0x00ff00, 1);
      this.progressBar.fillRect(
        width / 2 - 150,
        height / 2 - 15,
        300 * value,
        30,
      );
    });

    this.load.on("complete", () => {
      this.statusText.setText("Initializing World...");
    });

    // 3. Trigger BMS Metadata Download
    const mapName = this.targetData?.mapName || "newmap";
    this.load.json("map_raw_data", `maps/${mapName}.json`);

    // (Optional) Add dummy load if cache is hot to show bar briefly
    // this.load.image('dummy', 'data:image/png;base64,...');
  }

  async create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const mapName = this.targetData?.mapName || "newmap";

    // 1. BMS Loading Initializer
    this.statusText.setText("Downloading World Data...");
    const mapMetadata = this.cache.json.get("map_raw_data");
    if (!mapMetadata) {
      console.error("Critical Error: BMS Metadata missing!");
      this.scene.start("GameScene", this.targetData);
      return;
    }

    await this.yieldToBrowser();

    // 2. Async Load All Binary Levels
    this.statusText.setText("Streaming Binary Continents...");
    await this.mapLoader.loadAllLevels(mapName);
    await this.yieldToBrowser();

    // 3. Pathfinding (Minimal initialization)
    this.statusText.setText("Building Navigation Matrix...");
    // For now, we stub this or use the new binary-friendly logic
    const levels = Object.keys(mapMetadata.levels);
    const pathfindingGrids: Record<string, number[][]> = {};
    for (const lvl of levels) {
      pathfindingGrids[lvl] = []; // BMS-ready stub (Dynamic calculation recommended for 1024x1024)
    }

    // 4. World Map Buffers (Binary-powered)
    this.statusText.setText("Rendering Mini-maps...");
    WorldMapService.preRenderAll(mapMetadata, this.mapLoader.getBinaryLevels());
    await this.yieldToBrowser();

    this.statusText.setText("Entering World...");
    this.progressBar.clear();
    this.progressBar.fillStyle(0x00ffff, 1);
    this.progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300, 30);

    // 5. Start GameScene
    const spawnInfo = this.targetData?.spawnInfo || {
      x: mapMetadata.width * 16,
      y: mapMetadata.height * 16,
      level: mapMetadata.config?.startLevel || "1",
    };

    const finalData = {
      ...this.targetData,
      processedData: {
        spawnInfo,
        pathfindingGrids,
        normalizedMapData: mapMetadata,
      },
    };

    this.time.delayedCall(200, () => {
      this.scene.start("GameScene", finalData);
    });
  }

  /** Helper to allow the browser to paint/refresh UI between heavy tasks */
  private yieldToBrowser(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 10));
  }
}
