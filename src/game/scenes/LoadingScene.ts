import Phaser from "phaser";
import { MapLoader } from "../maps/MapLoader";
import { WorldMapService } from "../../services/WorldMapService";
import { MapProcessingService } from "../services/MapProcessingService";

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
    this.load.on('progress', (value: number) => {
        this.progressBar.clear();
        this.progressBar.fillStyle(0x00ff00, 1);
        this.progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
        this.statusText.setText("Initializing World...");
    });
    
    // 3. Trigger Assets & Map Download
    const mapName = this.targetData?.mapName || "newmap";
    this.load.json("map_raw_data", `${mapName}.json`);
    
    // (Optional) Add dummy load if cache is hot to show bar briefly
    // this.load.image('dummy', 'data:image/png;base64,...');
  }

  async create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const mapName = this.targetData?.mapName || "newmap";

    // 1. Map Data Retrieval & Normalization
    this.statusText.setText("Analyzing Continent...");
    const rawData = this.cache.json.get("map_raw_data");
    if (!rawData) {
        console.error("Critical Error: Map raw data missing from cache!");
        this.scene.start("GameScene", this.targetData);
        return;
    }

    await this.yieldToBrowser();

    // 1.1 Perform Normalization (Heavy task for large maps)
    const { normalizedData } = MapProcessingService.normalizeMap(rawData);
    this.cache.json.remove("map_raw_data");
    this.cache.json.add(`${mapName}_data`, normalizedData);
    await this.yieldToBrowser();

    // 1.2 Seed Level Cache (Splitting map into floors)
    const levels = Object.keys(normalizedData.levels);
    for (let i = 0; i < levels.length; i++) {
        const lvl = levels[i];
        this.statusText.setText(`Preparing Floor ${lvl}...`);
        await this.mapLoader.loadLevel(mapName, lvl, normalizedData);
        await this.yieldToBrowser();
    }

    // 2. Heavy Processing Stages
    // 2.1 Find Spawn
    this.statusText.setText("Locating Spawn Point...");
    const spawnInfo = MapProcessingService.findSpawn(normalizedData);
    await this.yieldToBrowser();

    // 2.2 Pathfinding Grids
    this.statusText.setText("Building Pathfinding Matrix...");
    const pathfindingGrids: Record<string, number[][]> = {};
    for (let i = 0; i < levels.length; i++) {
        const lvl = levels[i];
        this.statusText.setText(`Calculating Routes (${i+1}/${levels.length})...`);
        pathfindingGrids[lvl] = MapProcessingService.buildPathfindingGrid(lvl, normalizedData);
        
        const processValue = (i / levels.length);
        this.progressBar.clear();
        this.progressBar.fillStyle(0x00ffcc, 1);
        this.progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * processValue, 30);
        
        await this.yieldToBrowser();
    }

    // 2.3 World Map Buffers
    for (let i = 0; i < levels.length; i++) {
        const lvl = levels[i];
        this.statusText.setText(`Rendering Mini-maps (${i+1}/${levels.length})...`);
        WorldMapService.renderLevelToBuffer(lvl, normalizedData);
        await this.yieldToBrowser();
    }

    this.statusText.setText("Entering World...");
    this.progressBar.clear();
    this.progressBar.fillStyle(0x00ffff, 1);
    this.progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300, 30);

    // 3. Start GameScene
    const finalData = {
        ...this.targetData,
        processedData: {
            spawnInfo,
            pathfindingGrids,
            normalizedMapData: normalizedData
        }
    };

    this.time.delayedCall(200, () => {
         this.scene.start("GameScene", finalData);
    });
  }

  /** Helper to allow the browser to paint/refresh UI between heavy tasks */
  private yieldToBrowser(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 10));
  }
}
