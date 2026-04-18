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
    tileSize: number,
  ): Promise<void> {
    // Se já estiver mudando de andar, ignora
    if (this.isTransitioning) return;

    const gridX = Math.floor(playerSprite.x / tileSize);
    const gridY = Math.floor(playerSprite.y / tileSize);

    const mapData = this.scene.cache.json.get(
      `${this.scene.registry.get("currentMap")}_data`,
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

      // ALL automatic vertical transitions are now disabled based on USER REQUEST (v7.5)
      // Transitions must be triggered manually via tryManualTransition (Click).
      return;
    }
  }

  public async tryManualTransition(
    gridX: number,
    gridY: number,
    tileSize: number,
  ): Promise<void> {
    if (this.isTransitioning) return;

    const mapData = this.scene.cache.json.get(
      `${this.scene.registry.get("currentMap")}_data`,
    );
    if (!mapData) return;

    const currentLevel = this.scene.registry.get("currentLevel");
    const levelData = mapData.levels[currentLevel];
    if (!levelData) return;

    // Validate bounds
    if (
      gridY < 0 ||
      gridY >= mapData.height ||
      gridX < 0 ||
      gridX >= mapData.width
    )
      return;

    const tileSymbol = this.mapLoader.getTileAt(gridX, gridY, currentLevel);
    const tileDef = mapData.tileDefinitions[tileSymbol || ""];

    // MANUAL TRANSITIONS (UP or DOWN) via Click
    if (tileDef && tileDef.transition) {
      const currentLevelInt = parseInt(currentLevel);
      const type = tileDef.transition;

      if (type === "up") {
        const nextLevelInt = currentLevelInt + 1;
        const nextLevelStr = nextLevelInt.toString();

        if (mapData.levels[nextLevelStr]) {
          // To land safely ABOVE the stair down, we need to land at Y - 2.
          await this.performTransition(
            nextLevelStr,
            gridX,
            gridY - 2,
            tileSize,
            mapData,
          );
        } else {
          this.scene.showFloatingText(
            gridX * tileSize,
            gridY * tileSize,
            "Blocked",
            0xff0000,
          );
        }
      } else if (type === "down" || type === "dwn") {
        const nextLevelInt = currentLevelInt - 1;
        const nextLevelStr = nextLevelInt.toString();

        if (mapData.levels[nextLevelStr]) {
          // To land safely BELOW the stair up, we need to land at Y + 2.
          await this.performTransition(
            nextLevelStr,
            gridX,
            gridY + 2,
            tileSize,
            mapData,
          );
        } else {
          this.scene.showFloatingText(
            gridX * tileSize,
            gridY * tileSize,
            "Blocked",
            0xff0000,
          );
        }
      }
    } else if (tileDef && tileDef.id === "hole") {
      // Special case for holes/manholes also requiring click
      const currentLevelInt = parseInt(currentLevel);
      const nextLevelInt = currentLevelInt - 1;
      const nextLevelStr = nextLevelInt.toString();

      if (mapData.levels[nextLevelStr]) {
        await this.performTransition(
          nextLevelStr,
          gridX,
          gridY + 2,
          tileSize,
          mapData,
        );
      }
    }
  }

  public async performTransition(
    newLevel: string,
    gridX: number,
    gridY: number,
    tileSize: number,
    mapData: any,
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
          `Transition blocked at destination ${newLevel} [${gridX}, ${gridY}]`,
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
      // Use window.setTimeout (real time) instead of scene.time.delayedCall so that
      // heavy per-frame tile creation in LevelRenderer (3D upper levels) does NOT
      // delay the cooldown by stalling the Phaser game loop.
      window.setTimeout(() => {
        this.isTransitioning = false;
      }, 500);
    } catch (error) {
      console.error(`Failed to transition to level ${newLevel}:`, error);
      this.isTransitioning = false;
      this.scene.cameras.main.fadeIn(100);
    }
  }
}
