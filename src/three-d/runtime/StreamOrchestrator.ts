import { PropStreamSystem } from "./PropStreamSystem";
import { EnemyStreamSystem } from "./EnemyStreamSystem";
import { DropStreamSystem } from "./DropStreamSystem";

export type StreamOrchestratorConfig = {
  getCurrentLevel: () => string;
  getLevelKeys: () => string[];
  applyActiveLevelChange: (level: string, transition?: any, options?: { natural?: boolean }) => void;
  ensureMapLevelReady: (level: string) => Promise<string | null>;
  ensureLevelDoorsSeeded: (level: string) => void;
  setSelectedEnemy: (uid: string | null) => void;
  pushLogEvent: (event: string, data: any) => void;
};

export class StreamOrchestrator {
  constructor(
    readonly propSystem: PropStreamSystem,
    readonly enemySystem: EnemyStreamSystem,
    readonly dropSystem: DropStreamSystem,
    private config: StreamOrchestratorConfig,
  ) {}

  async seedAllLevels(levelKeys: string[]): Promise<void> {
    for (const level of levelKeys) {
      await Promise.all([
        this.dropSystem.ensureLevelSeeded(level),
        this.enemySystem.ensureLevelSeeded(level),
        this.propSystem.ensureLevelSeeded(level),
      ]);
    }
  }

  seedLevel(level: string): void {
    void this.dropSystem.ensureLevelSeeded(level);
    void this.enemySystem.ensureLevelSeeded(level);
    void this.propSystem.ensureLevelSeeded(level);
  }

  seedAdjacentLevels(level: string): void {
    const keys = this.config.getLevelKeys();
    const num = Number(level);
    if (keys.includes(String(num - 1))) this.seedLevel(String(num - 1));
    if (keys.includes(String(num + 1))) this.seedLevel(String(num + 1));
  }

  setStreamRadii(radii: {
    propStreamRadiusUnits: number;
    propStreamRadiusUnitsFirstPerson: number;
    propDespawnRadiusUnits: number;
    enemyStreamRadiusUnits: number;
    enemyDespawnRadiusUnits: number;
    droppedItemStreamRadiusUnits: number;
  }): void {
    this.propSystem.propStreamRadiusUnits = radii.propStreamRadiusUnits;
    this.propSystem.propStreamRadiusUnitsFirstPerson = radii.propStreamRadiusUnitsFirstPerson;
    this.propSystem.propDespawnRadiusUnits = radii.propDespawnRadiusUnits;
    this.enemySystem.enemyStreamRadiusUnits = radii.enemyStreamRadiusUnits;
    this.enemySystem.enemyDespawnRadiusUnits = radii.enemyDespawnRadiusUnits;
    this.dropSystem.droppedItemStreamRadiusUnits = radii.droppedItemStreamRadiusUnits;
  }

  /**
   * Lightweight level-change notification. Called every frame from RenderSystem.
   * ONLY does streaming/UI side effects. Does NOT load levels or move the player.
   * Heavy bootstrap is handled separately by ensureMapLevelReady (startup only).
   */
  checkLevelDrift(playerStateLevel: string): boolean {
    const currentLevel = this.config.getCurrentLevel();
    if (playerStateLevel !== currentLevel) {
      const previousLevel = currentLevel;
      this.config.applyActiveLevelChange(playerStateLevel, undefined, { natural: true });
      this.seedLevel(playerStateLevel);
      this.config.setSelectedEnemy(null);
      this.config.pushLogEvent("level.change", {
        from: previousLevel,
        to: playerStateLevel,
      });
      return true;
    }
    return false;
  }

  tick(deltaSeconds: number): void {
    this.dropSystem.tick(deltaSeconds);
    this.enemySystem.tick(deltaSeconds);
    this.propSystem.tick(deltaSeconds);
  }

  reanchorLevel(level: string): void {
    this.propSystem.reanchorAll(level);
    this.dropSystem.syncStream(true);
  }

  clear(): void {
    this.dropSystem.clear();
    this.propSystem.clear();
    this.enemySystem.clear();
  }
}
