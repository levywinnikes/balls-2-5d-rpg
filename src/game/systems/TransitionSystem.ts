import Phaser from "phaser";
import GameScene from "../scenes/GameScene";
import { MapLoader } from "../maps/MapLoader";

export class TransitionSystem {
  private scene: GameScene;
  private mapLoader: MapLoader;
  // Flag para evitar múltiplas transições simultâneas (ping-pong)
  private isTransitioning: boolean = false;

  constructor(scene: GameScene, mapLoader: MapLoader) {
    this.scene = scene;
    this.mapLoader = mapLoader;
  }

  public async checkTileTransition(
    playerSprite: Phaser.GameObjects.Sprite,
    tileSize: number
  ): Promise<void> {
    // Se já estiver mudando de andar, ignora
    if (this.isTransitioning) return;

    const gridX = Math.floor(playerSprite.x / tileSize);
    const gridY = Math.floor(playerSprite.y / tileSize);

    const mapData = this.scene.cache.json.get(
      `${this.scene.registry.get("currentMap")}_data`
    );

    if (!mapData) return;

    const currentLevel = this.scene.registry.get("currentLevel");
    const levelData = mapData.levels[currentLevel];

    if (!levelData) return;

    // Verificações de limites
    if (
      gridY < 0 ||
      gridY >= mapData.height ||
      gridX < 0 ||
      gridX >= mapData.width
    ) {
      return;
    }

    const tileSymbol = this.mapLoader.getTileAt(gridX, gridY, currentLevel);
    if (!tileSymbol) return;

    // --- MUDANÇA PRINCIPAL AQUI ---
    // Em vez de usar uma lista fixa, olhamos a definição do tile no JSON
    const tileDef = mapData.tileDefinitions[tileSymbol];

    // Se o tile tem a propriedade "transition" definida no JSON
    if (tileDef && tileDef.transition) {
      // FIX: Ignora transição "up" automática. Agora exige interação manual (Right Click)
      if (tileDef.transition === "up") {
          return;
      }

      let nextLevelInt: number;
      const currentLevelInt = parseInt(currentLevel);
      let targetGridY = gridY;

      if (
        tileDef.transition === "dwn" ||
        tileDef.transition === "down" ||
        tileDef.id === "hole"
      ) {
        nextLevelInt = currentLevelInt - 1;
        
        // OFFSET LOGIC (2.5D): 
        // Stair Down is at Y. Stair Up below was at Y + 1.
        // To land safely BELOW the stair up, we need to land at Y + 2.
        targetGridY = gridY + 2;
      } else {
        return; // Transição inválida
      }

      const nextLevelStr = nextLevelInt.toString();

      // Verifica se o próximo nível existe
      if (mapData.levels[nextLevelStr]) {
        await this.performTransition(
          nextLevelStr,
          gridX,
          targetGridY,
          tileSize,
          mapData
        );
      } else {
        console.warn(`Level ${nextLevelStr} does not exist in map data.`);
      }
    }
  }

  public async tryManualTransition(
      gridX: number,
      gridY: number,
      tileSize: number
  ): Promise<void> { 
      if (this.isTransitioning) return;

      const mapData = this.scene.cache.json.get(
        `${this.scene.registry.get("currentMap")}_data`
      );
      if (!mapData) return;

      const currentLevel = this.scene.registry.get("currentLevel");
      const levelData = mapData.levels[currentLevel];
      if (!levelData) return;

      // Validate bounds
      if (gridY < 0 || gridY >= mapData.height || gridX < 0 || gridX >= mapData.width) return;

      const tileSymbol = this.mapLoader.getTileAt(gridX, gridY, currentLevel);
      const tileDef = mapData.tileDefinitions[tileSymbol || ""];

      if (tileDef && tileDef.transition === "up") {
          const currentLevelInt = parseInt(currentLevel);
          const nextLevelInt = currentLevelInt + 1;
          const nextLevelStr = nextLevelInt.toString();

          if (mapData.levels[nextLevelStr]) {
            // OFFSET LOGIC (2.5D): 
            // Stair Up is at Y. Stair Down above IS at Y - 1.
            // To land safely ABOVE the stair down, we need to land at Y - 2.
            await this.performTransition(
              nextLevelStr,
              gridX,
              gridY - 2, 
              tileSize,
              mapData
            );
          } else {
             this.scene.showFloatingText(gridX * tileSize, gridY * tileSize, "Blocked", 0xff0000);
          }
      }
  }

  public async performTransition(
    newLevel: string,
    gridX: number,
    gridY: number,
    tileSize: number,
    mapData: any
  ): Promise<void> {
    this.isTransitioning = true;

    try {
      // Opcional: Fade out rápido para suavizar a troca
      this.scene.cameras.main.fadeOut(150, 0, 0, 0);

      // Aguarda o fade ou um pequeno delay
      await new Promise((resolve) => this.scene.time.delayedCall(150, resolve));

      // Carrega o novo nível
      await this.mapLoader.setActiveLevel(newLevel);
      this.scene.setCurrentLevel(newLevel);

      // Calcula nova posição
      const newPos = {
        x: gridX * tileSize + tileSize / 2,
        y: gridY * tileSize + tileSize / 2,
      };

      // Verifica colisão no destino (para não nascer dentro da parede)
      const newTileSymbol = this.mapLoader.getTileAt(gridX, gridY, newLevel);
      const newTileDef = mapData.tileDefinitions[newTileSymbol || ""];

      if (newTileDef && newTileDef.block) {
        console.warn(
          `Transition blocked at destination ${newLevel} [${gridX}, ${gridY}]`
        );
        // Aqui você poderia implementar uma lógica para procurar um tile vizinho livre
        // Por enquanto, mantemos a posição, pois assumimos que o mapa foi bem desenhado (escada leva a escada)
      }

      if (this.scene.player) {
        this.scene.player.sprite.setPosition(newPos.x, newPos.y);
      }

      await this.scene.updatePathfindingGrid();

      // Fade in
      this.scene.cameras.main.fadeIn(150, 0, 0, 0);

      // Cooldown para não voltar imediatamente se o jogador segurar a tecla
      this.scene.time.delayedCall(500, () => {
        this.isTransitioning = false;
      });
    } catch (error) {
      console.error(`Failed to transition to level ${newLevel}:`, error);
      this.isTransitioning = false;
      this.scene.cameras.main.fadeIn(100);
    }
  }
}
