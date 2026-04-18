import Phaser from "phaser";
import type { MapLoader } from "./MapLoader";
import type Player from "../entities/Player";
import { TileRegistry } from "../graphics/tiles/TileRegistry";
import { TilePool } from "../graphics/TilePool";
import type { DroppedItem } from "../entities/DroppedItem";
import { PlayerState } from "../entities/Player/PlayerState";
import { MultiLevelMapData } from "./MapTypes";
import {
  DEFAULT_PROJECTION_SETTINGS,
  getContainerProjection,
  getDepthOffset,
} from "./PerspectiveProjection";

export default class LevelRenderer {
  private scene: Phaser.Scene;
  private tileSize: number;
  private currentLevel: string;
  private renderedTiles: Map<string, Map<string, Phaser.GameObjects.Sprite[]>> =
    new Map();
  private volumetricGraphics: Map<string, Phaser.GameObjects.Graphics> =
    new Map();
  private volumetricSlices: Map<
    string,
    Map<string, Phaser.GameObjects.TileSprite>
  > = new Map();
  private renderedDecorations: Map<string, Phaser.GameObjects.Sprite[]> =
    new Map();
  private levelContainers: Map<string, Phaser.GameObjects.Container> =
    new Map();
  public activeEnemies: Map<string, any> = new Map();
  public renderRadius: number = 20;
  private tilePool: TilePool;
  private debugGraphics: Phaser.GameObjects.Graphics | null;
  private lastPlayerX: number = -999;
  private lastPlayerY: number = -999;
  private lastRenderLevel: string = "";
  private updateThreshold: number = 4; // Only update map every 4 pixels (Super Smooth)
  private lastUpdateTime: number = 0; // Time-based throttle
  private updateThrottleMs: number = 60; // 60ms limit (Fast refresh)
  private currentPerspectiveFactor: number = 1.0;
  private targetPerspectiveFactor: number = 1.0;
  private readonly projectionSettings = DEFAULT_PROJECTION_SETTINGS;
  private lastPerspectivePlayerX: number = Number.NaN;
  private lastPerspectivePlayerY: number = Number.NaN;
  private orientableFaceState: Map<
    string,
    { horizontal: "e" | "w"; vertical: "n" | "s" }
  > = new Map();
  private readonly orientableQuadrantDeadZonePx: number = 10;

  constructor(scene: Phaser.Scene, tileSize: number, currentLevel: string) {
    this.scene = scene;
    this.tileSize = tileSize;
    this.currentLevel = String(currentLevel);
    this.tilePool = new TilePool(scene, 8000); // 8000 sprites pool (Support multi-level density)

    this.debugGraphics = scene.add.graphics();
    this.debugGraphics.setDepth(200000);

    // DEBUG COLLISION LISTENER
    PlayerState.getInstance().on(
      "debugCollisionChanged",
      (enabled: boolean) => {
        this.updateAllTileTints(enabled);
        if (!enabled) this.debugGraphics?.clear();
      },
    );

    // PERSPECTIVE MODE LISTENER
    PlayerState.getInstance().on(
      "perspectiveModeChanged",
      (mode: "2D" | "3D") => {
        this.targetPerspectiveFactor = mode === "3D" ? 1.0 : 0.0;
      },
    );

    (window as any)._levelRenderer = this;
  }

  private updateAllTileTints(enabled: boolean): void {
    const player = (this.scene as any).player as any;
    if (!player || !player.sprite) return;

    const currentLevelNum = parseInt(this.currentLevel);
    const playerX = player.sprite.x;
    const playerY = player.sprite.y;

    this.levelContainers.forEach((container, levelKey) => {
      const levelNum = parseInt(levelKey);
      const projection = getContainerProjection(
        playerX,
        playerY,
        levelNum,
        currentLevelNum,
        this.currentPerspectiveFactor,
        this.projectionSettings,
      );

      container.setScale(projection.scale);
      container.x = projection.x;
      container.y = projection.y;

      // 3. Update CONTAINER DEPTH dynamically based on current level
      // This ensures that levels below the player have high negative depth, and levels above have high positive depth.
      container.setDepth(projection.depth);

      // 3.5 Force DEPTH SORTING within the container
      // Phaser 3 Containers do NOT sort by depth automatically.
      container.sort("depth");

      // 3.6 Alpha falloff — distant floors fade to reduce visual clutter
      container.setAlpha(
        this.getContainerAlpha(
          projection.levelDiff,
          this.currentPerspectiveFactor,
        ),
      );

      // 4. Perspective TINT
      let finalTint = 0xffffff;
      if (projection.levelDiff > 0) {
        // Phase 2: upper floors get a cool/clean tint instead of warm yellow —
        // reads as "sky-lit" rather than sepia and keeps structure colors true.
        finalTint = Phaser.Display.Color.GetColor(
          Math.min(255, 215 + projection.levelDiff * 14),
          Math.min(255, 222 + projection.levelDiff * 14),
          Math.min(255, 235 + projection.levelDiff * 8),
        );
      } else if (projection.levelDiff < 0) {
        // Underground: warm amber-shadow (slight red shift) to suggest torch/earth tones.
        const darknessVal = Math.max(80, 255 + projection.levelDiff * 50);
        finalTint = Phaser.Display.Color.GetColor(
          Math.min(255, darknessVal + 18),
          darknessVal,
          Math.max(0, darknessVal - 14),
        );
      }

      // Apply tints to children
      container.iterate((child: any) => {
        if (!child.active) return;

        if (child.setTint) {
          const tileBaseDepth = Number(child.getData?.("tileBaseDepth") || 0);
          const isUnderTile = !!child.getData?.("isUnderTile");

          // Tune readability in perspective mode: walls/structures get slightly stronger contrast,
          // while under-tiles stay subtly dim to avoid muddy stacks.
          let tint = finalTint;
          if (this.currentPerspectiveFactor > 0.001) {
            const isStructure = tileBaseDepth > 0;
            if (isStructure && projection.levelDiff > 0) {
              tint = Phaser.Display.Color.GetColor(
                Math.min(255, 230 + projection.levelDiff * 16),
                Math.min(255, 230 + projection.levelDiff * 16),
                Math.min(255, 205 + projection.levelDiff * 10),
              );
            } else if (isStructure && projection.levelDiff < 0) {
              const c = Math.max(72, 230 + projection.levelDiff * 36);
              tint = Phaser.Display.Color.GetColor(c, c, Math.min(255, c + 24));
            } else if (isUnderTile) {
              const c = Math.max(80, 210 + projection.levelDiff * 20);
              tint = Phaser.Display.Color.GetColor(c, c, Math.min(255, c + 16));
            }
          }

          child.setTint(tint);
        }
      });
    });
  }

  private applyDebugTint(
    sprite: Phaser.GameObjects.Sprite,
    isCollidable: boolean,
    enabled: boolean,
    baseTint?: number,
  ): void {
    if (!enabled) {
      if (baseTint !== undefined) {
        sprite.setTint(baseTint);
      } else {
        sprite.clearTint();
      }
      return;
    }
    // Only tint green for walkable, NO auto-tint red for collidable (use Graphics instead)
    if (!isCollidable) {
      sprite.setTint(0x44ff44);
    } else {
      if (baseTint !== undefined) {
        sprite.setTint(baseTint);
      } else {
        sprite.clearTint();
      }
    }
  }

  private resetSprite(sprite: Phaser.GameObjects.Sprite): void {
    sprite.setScale(1, 1);
    sprite.setRotation(0);
    sprite.setAlpha(1.0);
    sprite.setOrigin(0.5, 0.5);
    sprite.clearTint();
    sprite.setDataEnabled();
    sprite.data.reset();

    // Property reset for Phaser 3.80+ skewing
    const s = sprite as any;
    if (s.setSkew) {
      s.setSkew(0, 0);
    } else {
      s.skewX = 0;
      s.skewY = 0;
    }

    // Reset display size to standard tile unless set otherwise by renderer
    sprite.setDisplaySize(this.tileSize, this.tileSize);
  }

  // --- NEW LIGHTING SYSTEM (Fog of War) ---
  public updateLighting(
    centerX: number,
    centerY: number,
    radius: number,
  ): void {
    const radiusSq = radius * radius;
    // Pre-calculate inverse radius for performance
    const invRadius = 1 / radius;
    const halfTile = this.tileSize / 2;

    this.renderedTiles.forEach((levelTiles) => {
      levelTiles.forEach((sprites) => {
        sprites.forEach((sprite) => {
          // OPTIMIZATION: Check center distance first.
          const sx = sprite.x;
          const sy = sprite.y;

          const x0 = sx - halfTile;
          const y0 = sy - halfTile;
          const x1 = sx + halfTile;
          const y1 = sy + halfTile;

          // Helper to get tint for a point
          const getTint = (tx: number, ty: number) => {
            const dx = tx - centerX;
            const dy = ty - centerY;
            const distSq = dx * dx + dy * dy;
            if (distSq > radiusSq) return 0x000000;

            // Smooth Falloff
            const dist = Math.sqrt(distSq);
            const t = 1 - dist * invRadius;
            const i = t * t * (3 - 2 * t);
            const val = Math.floor(i * 255);
            return Phaser.Display.Color.GetColor(val, val, val);
          };

          const tl = getTint(x0, y0);
          const tr = getTint(x1, y0);
          const bl = getTint(x0, y1);
          const br = getTint(x1, y1);

          sprite.setTint(tl, tr, bl, br);
        });
      });
    });
  }

  public resetLighting(): void {
    this.renderedTiles.forEach((levelTiles) => {
      levelTiles.forEach((sprites) => {
        sprites.forEach((sprite) => {
          if (sprite.active) sprite.clearTint(); // Restore original colors
        });
      });
    });
  }

  public setCurrentLevel(level: string): void {
    this.currentLevel = level;
    this.clearRenderedTiles();
    const droppedItemsGroup = (this.scene as any).droppedItemsGroup as
      | Phaser.Physics.Arcade.Group
      | undefined;
    if (droppedItemsGroup) {
      droppedItemsGroup.getChildren().forEach((item) => {
        const droppedItem = item as DroppedItem;
        droppedItem.updateDepth();
      });
    }
  }

  public getRenderedTiles(level: string): Phaser.GameObjects.Sprite[] {
    const levelMap = this.renderedTiles.get(level);
    if (!levelMap) return [];
    return Array.from(levelMap.values()).flat();
  }

  private getLevelContainer(level: string): Phaser.GameObjects.Container {
    let container = this.levelContainers.get(level);
    if (!container) {
      container = this.scene.add.container(0, 0);
      const levelNum = parseInt(level);
      // Set base depth
      container.setDepth(
        this.getDepthForLevel(levelNum, parseInt(this.currentLevel)),
      );

      this.levelContainers.set(level, container);

      // Initialize Volumetric Graphics for this level
      const graphics = this.scene.add.graphics();
      graphics.setDepth(-10); // Sit below the roof tiles
      container.add(graphics);
      this.volumetricGraphics.set(level, graphics);
      this.volumetricSlices.set(level, new Map());
    }
    return container;
  }

  public invalidateTile(level: string, x: number, y: number): void {
    const tileKey = `${level}_${x}_${y}`;

    // Check render for cached tiles
    const levelTiles = this.renderedTiles.get(level);
    if (levelTiles) {
      // Remove main tile
      const mainKey = `${tileKey}_upper`; // Try upper first
      if (levelTiles.has(mainKey)) {
        const sprites = levelTiles.get(mainKey);
        sprites?.forEach((s) => s.destroy());
        levelTiles.delete(mainKey);
      }
      // Try normal key
      if (levelTiles.has(tileKey)) {
        const sprites = levelTiles.get(tileKey);
        sprites?.forEach((s) => s.destroy());
        levelTiles.delete(tileKey);
      }

      // Remove under tiles
      const underKey = `${tileKey}_under`;
      if (levelTiles.has(underKey)) {
        const sprites = levelTiles.get(underKey);
        sprites?.forEach((s) => s.destroy());
        levelTiles.delete(underKey);
      }
      const underUpperKey = `${tileKey}_under_upper`;
      if (levelTiles.has(underUpperKey)) {
        const sprites = levelTiles.get(underUpperKey);
        sprites?.forEach((s) => s.destroy());
        levelTiles.delete(underUpperKey);
      }
    }
  }

  public reloadMap(): void {
    this.clearRenderedTiles();
    this.renderedTiles.clear();
    // Force update will happen in next game loop
  }

  public updatePerspective(delta: number): void {
    const player = (this.scene as any).player as any;
    const factorChanged =
      this.currentPerspectiveFactor !== this.targetPerspectiveFactor;
    const perspectiveActive =
      this.currentPerspectiveFactor > 0.001 ||
      this.targetPerspectiveFactor > 0.001;

    if (factorChanged) {
      // Smooth Ease: 0.004 per ms (~250ms transition)
      const step = delta * 0.004;
      if (
        Math.abs(this.currentPerspectiveFactor - this.targetPerspectiveFactor) <
        step
      ) {
        this.currentPerspectiveFactor = this.targetPerspectiveFactor;
      } else {
        this.currentPerspectiveFactor +=
          this.targetPerspectiveFactor > this.currentPerspectiveFactor
            ? step
            : -step;
      }
    }

    if (!player?.sprite) {
      return;
    }

    if (!perspectiveActive && !factorChanged) {
      return;
    }

    const currentX = player.sprite.x;
    const currentY = player.sprite.y;
    const playerMoved =
      Number.isNaN(this.lastPerspectivePlayerX) ||
      Number.isNaN(this.lastPerspectivePlayerY) ||
      Math.abs(currentX - this.lastPerspectivePlayerX) > 0.05 ||
      Math.abs(currentY - this.lastPerspectivePlayerY) > 0.05;

    // Keep side-faces anchored by recalculating when transition is active or player position changes.
    if (factorChanged || playerMoved) {
      this.updateAllTileTints(
        PlayerState.getInstance().isDebugCollisionEnabled(),
      );
      this.drawVolumetricPolygons();
      this.lastPerspectivePlayerX = currentX;
      this.lastPerspectivePlayerY = currentY;
    }
  }

  /** Keep 3D structures opaque; separation between floors comes from scale/tint, not transparency. */
  private getContainerAlpha(
    _levelDiff: number,
    _perspectiveFactor: number,
  ): number {
    return 1.0;
  }

  private getTileSolidColor(tileId: string): number {
    const registryDef = TileRegistry.getTileDefinition(tileId);
    if (registryDef?.color) {
      return Phaser.Display.Color.HexStringToColor(registryDef.color).color;
    }

    if (tileId.includes("roof")) return 0xef4444;
    if (tileId.includes("wood")) return 0x8b5a2b;
    if (tileId.includes("gothic") || tileId.includes("stone")) return 0x64748b;
    if (tileId.includes("wall")) return 0x7a7a7a;
    return 0xa3a3a3;
  }

  private shadeColor(color: number, multiplier: number): number {
    const base = Phaser.Display.Color.ValueToColor(color);
    return Phaser.Display.Color.GetColor(
      Phaser.Math.Clamp(Math.round(base.red * multiplier), 0, 255),
      Phaser.Math.Clamp(Math.round(base.green * multiplier), 0, 255),
      Phaser.Math.Clamp(Math.round(base.blue * multiplier), 0, 255),
    );
  }

  private isRoofTile(tileId: string): boolean {
    return tileId.includes("roof");
  }

  private isQuadrantOrientableTile(tileId: string): boolean {
    return tileId === "rock" || tileId === "wall" || tileId === "stone-wall";
  }

  private getOrientedVisibleFaces(
    tileKey: string,
    tileId: string,
    tileCenterX: number,
    tileCenterY: number,
    availableFaces: Array<"n" | "s" | "e" | "w">,
  ): Array<"n" | "s" | "e" | "w"> {
    if (!this.isQuadrantOrientableTile(tileId) || availableFaces.length <= 2) {
      return availableFaces;
    }

    const player = (this.scene as any).player as any;
    const playerSprite = player?.sprite;
    if (!playerSprite) {
      return availableFaces;
    }

    const previous = this.orientableFaceState.get(tileKey);
    const dx = playerSprite.x - tileCenterX;
    const dy = playerSprite.y - tileCenterY;

    let horizontal: "e" | "w" = previous?.horizontal ?? (dx >= 0 ? "e" : "w");
    if (Math.abs(dx) > this.orientableQuadrantDeadZonePx) {
      horizontal = dx >= 0 ? "e" : "w";
    }

    let vertical: "n" | "s" = previous?.vertical ?? (dy >= 0 ? "s" : "n");
    if (Math.abs(dy) > this.orientableQuadrantDeadZonePx) {
      vertical = dy >= 0 ? "s" : "n";
    }

    this.orientableFaceState.set(tileKey, { horizontal, vertical });

    const preferredFaces: Array<"n" | "s" | "e" | "w"> = [vertical, horizontal];
    const filteredFaces = preferredFaces.filter((face) =>
      availableFaces.includes(face),
    );

    if (filteredFaces.length > 0) {
      return filteredFaces;
    }

    return availableFaces.slice(0, Math.min(2, availableFaces.length));
  }

  private getVolumetricTextureKey(
    tileId: string,
    face: "n" | "s" | "e" | "w",
  ): string | null {
    let faceTileId = tileId;

    if (face === "n" || face === "s") {
      const frontId = `${tileId}-front`;
      faceTileId = TileRegistry.getTileDefinition(frontId) ? frontId : tileId;
    } else {
      faceTileId = TileRegistry.getSideTextureID(tileId);
    }

    const textureKey = TileRegistry.getTextureId(faceTileId);
    return this.scene.textures.exists(textureKey) ? textureKey : null;
  }

  private isStructuralTileForVolumetric(
    symbol: string | undefined,
    mapData: MultiLevelMapData,
    levelStr: string,
    x: number,
    y: number,
  ): boolean {
    if (!symbol || symbol === "...") {
      return false;
    }

    const tileDef = this.getTileDefinition(symbol, mapData, levelStr, x, y);
    if (!tileDef) {
      return false;
    }

    const tileId = tileDef.id;
    if (this.isRoofTile(tileId)) {
      return false;
    }

    const baseDepth = TileRegistry.getBaseDepth(tileId);
    const isStair = tileId.includes("stair");
    return baseDepth > 0 || isStair;
  }

  private resetVolumetricSlices(levelStr: string): void {
    const levelSlices = this.volumetricSlices.get(levelStr);
    if (!levelSlices) return;

    levelSlices.forEach((slice) => slice.setVisible(false));
  }

  private ensureVolumetricSlice(
    levelStr: string,
    faceKey: string,
    textureKey: string,
  ): Phaser.GameObjects.TileSprite {
    let levelSlices = this.volumetricSlices.get(levelStr);
    if (!levelSlices) {
      levelSlices = new Map();
      this.volumetricSlices.set(levelStr, levelSlices);
    }

    let slice = levelSlices.get(faceKey);
    if (!slice) {
      slice = this.scene.add.tileSprite(0, 0, 8, 8, textureKey);
      slice.setOrigin(0, 0);
      slice.setVisible(false);
      slice.setDepth(-9);
      this.getLevelContainer(levelStr).add(slice);
      levelSlices.set(faceKey, slice);
    }

    if (slice.texture.key !== textureKey) {
      slice.setTexture(textureKey);
    }

    return slice;
  }

  private updateTexturedVolumetricFace(
    levelStr: string,
    faceKey: string,
    textureKey: string,
    face: "n" | "s" | "e" | "w",
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p4: { x: number; y: number },
    deltaX: number,
    deltaY: number,
    tileId: string,
  ): void {
    const projectedHeight = Math.hypot(deltaX, deltaY);
    const slice = this.ensureVolumetricSlice(levelStr, faceKey, textureKey);

    let tint = 0xffffff;
    if (face === "s") tint = 0xf2f2f2;
    else if (face === "n") tint = 0x969696;
    else if (face === "e") tint = 0xc8c8c8;
    else tint = 0xb0b0b0;

    const topWidth = Math.max(4, Math.abs(p2.x - p1.x));
    const topHeight = Math.max(4, Math.abs(p2.y - p1.y));

    // Anchor at the top-left corner of the bounding box of the face parallelogram.
    // For near-vertical projections (typical top-down camera) this produces a clean
    // rectangular texture strip that fills the wall face correctly.
    if (face === "n" || face === "s") {
      slice.setPosition(Math.min(p1.x, p4.x), Math.min(p1.y, p4.y));
      slice.setSize(topWidth + 1, Math.max(4, projectedHeight + 1));
    } else {
      slice.setPosition(Math.min(p1.x, p4.x), Math.min(p1.y, p4.y));
      slice.setSize(Math.max(4, projectedHeight + 1), topHeight + 1);
    }

    slice.setTint(tint);
    slice.setAlpha(this.isRoofTile(tileId) ? 0 : 1);
    slice.setVisible(!this.isRoofTile(tileId));
  }

  private shouldHideUpperRoofTile(
    tileId: string,
    level: number,
    x: number,
    y: number,
    playerGridX: number,
    playerGridY: number,
    mapData: MultiLevelMapData,
    mapLoader: MapLoader,
  ): boolean {
    if (!this.isRoofTile(tileId) || level <= parseInt(this.currentLevel)) {
      return false;
    }

    const levelStr = level.toString();
    const tileOverPlayerSymbol = mapLoader.getTileAt(
      playerGridX,
      playerGridY,
      levelStr,
    );
    if (!tileOverPlayerSymbol || tileOverPlayerSymbol === "...") {
      return false;
    }

    const tileOverPlayer = this.getTileDefinition(
      tileOverPlayerSymbol,
      mapData,
      levelStr,
      playerGridX,
      playerGridY,
    );
    if (!tileOverPlayer || !this.isRoofTile(tileOverPlayer.id)) {
      return false;
    }

    return Math.abs(x - playerGridX) <= 4 && Math.abs(y - playerGridY) <= 4;
  }

  private getVolumetricFaceStyle(
    face: "n" | "s" | "e" | "w",
    levelDiff: number,
    perspectiveFactor: number,
    tileId: string,
  ): { fill: number; fillAlpha: number; stroke: number; strokeAlpha: number } {
    const clampedFactor = Phaser.Math.Clamp(perspectiveFactor, 0, 1);
    const baseColor = this.getTileSolidColor(tileId);
    const distanceFade = Phaser.Math.Clamp(
      1 - Math.abs(levelDiff) * 0.04,
      0.82,
      1,
    );

    // Phase 2 polish: stronger N/S contrast for a more convincing 3D block read.
    // S face is the "lit" front face; N is the deep shadow face.
    let faceMultiplier = 0.7;
    if (face === "s")
      faceMultiplier = 0.97; // bright lit face
    else if (face === "n")
      faceMultiplier = 0.44; // deep shadow
    else if (face === "e") faceMultiplier = 0.8;
    else if (face === "w") faceMultiplier = 0.6;

    const fill = this.shadeColor(baseColor, faceMultiplier * distanceFade);
    const stroke = this.shadeColor(
      baseColor,
      Math.max(0.22, faceMultiplier * 0.44),
    );
    const fillAlpha = Phaser.Math.Clamp(0.93 + clampedFactor * 0.07, 0.93, 1.0);
    const strokeAlpha = Phaser.Math.Clamp(
      0.86 + clampedFactor * 0.14,
      0.86,
      1.0,
    );

    return { fill, fillAlpha, stroke, strokeAlpha };
  }

  private getTopSilhouetteStyle(
    perspectiveFactor: number,
    levelDiff: number,
  ): { color: number; alpha: number; width: number } {
    const clampedFactor = Phaser.Math.Clamp(perspectiveFactor, 0, 1);
    // Phase 2: fade less aggressively so edges remain crisp on middle floors.
    const distanceFade = Phaser.Math.Clamp(
      1 - Math.abs(levelDiff) * 0.07,
      0.6,
      1,
    );
    return {
      color: 0xffffff,
      alpha:
        Phaser.Math.Clamp(0.35 + clampedFactor * 0.5, 0.35, 0.9) * distanceFade,
      width: 1,
    };
  }

  /** Stair-specific top edge: golden/amber outline with double width to aid navigation. */
  private getStairSilhouetteStyle(
    perspectiveFactor: number,
    levelDiff: number,
  ): { color: number; alpha: number; width: number } {
    const clampedFactor = Phaser.Math.Clamp(perspectiveFactor, 0, 1);
    const distanceFade = Phaser.Math.Clamp(
      1 - Math.abs(levelDiff) * 0.07,
      0.55,
      1,
    );
    return {
      color: 0xffe080,
      alpha:
        Phaser.Math.Clamp(0.45 + clampedFactor * 0.45, 0.45, 0.95) *
        distanceFade,
      width: 2,
    };
  }

  private drawVolumetricPolygons(tilesToKeep_Global?: Set<string>): void {
    const factor = this.currentPerspectiveFactor;
    if (factor <= 0) {
      this.volumetricGraphics.forEach((g) => g.clear());
      this.volumetricSlices.forEach((_, levelStr) =>
        this.resetVolumetricSlices(levelStr),
      );
      return;
    }

    const mapLoader = (this.scene as any).mapLoader;
    const mapData = this.scene.cache.json.get(
      `${this.scene.registry.get("currentMap")}_data`,
    ) as MultiLevelMapData;
    if (!mapData) {
      return;
    }
    const currentLevelNum = parseInt(this.currentLevel);

    this.volumetricGraphics.forEach((graphics, levelStr) => {
      graphics.clear();
      this.resetVolumetricSlices(levelStr);
      const levelNum = parseInt(levelStr);
      const levelDiff = levelNum - currentLevelNum;

      const levelTiles = this.renderedTiles.get(levelStr);
      if (!levelTiles) return;

      // We use the current level's container as the coordinate space for the polygons,
      // but we project the base down to the ground (Level 0) for the sheer wall look.
      const currentContainer = this.getLevelContainer(levelStr);
      const groundContainer = this.getLevelContainer("0");

      levelTiles.forEach((sprites, key) => {
        const sprite = sprites[0];
        if (!sprite || !sprite.active || !sprite.visible) return;
        if (key.includes("_side_")) return;
        const tileBaseDepth = Number(sprite.getData?.("tileBaseDepth") || 0);
        const tileId = String(sprite.getData?.("tileId") || "");
        const isStair = tileId.includes("stair");
        const isRoof = this.isRoofTile(tileId);
        const isStructure = tileBaseDepth > 0 || isStair;
        if (!isStructure) return;
        const shouldDrawTopSilhouette = tileBaseDepth > 0 || isStair;

        // Parse grid coords from key
        const match = key.match(/(\d+)_(\d+)_(\d+)/);
        if (!match) return;
        const [, , xStr, yStr] = match;
        const x = parseInt(xStr);
        const y = parseInt(yStr);

        // Draw per-structure-level walls (not only topmost) so middle floors keep visible walls.

        // 2. Cross-Container Transform Math (From current Roof Level down to Level 0 Anchor)
        const worldX = x * this.tileSize;
        const worldY = y * this.tileSize;
        const size = this.tileSize;

        // Project where Level 0's footprint would be relative to our current container
        const screenGroundX =
          groundContainer.x + worldX * groundContainer.scaleX;
        const screenGroundY =
          groundContainer.y + worldY * groundContainer.scaleY;

        const localBaseX =
          (screenGroundX - currentContainer.x) / currentContainer.scaleX;
        const localBaseY =
          (screenGroundY - currentContainer.y) / currentContainer.scaleY;

        const deltaX = localBaseX - worldX;
        const deltaY = localBaseY - worldY;
        const projectedHeight = Math.hypot(deltaX, deltaY);

        // Ignore near-flat projections to avoid tiny side polygons that shimmer during movement.
        if (projectedHeight < this.tileSize * 0.12) {
          return;
        }

        const neighbors = [
          { dx: 0, dy: 1, type: "s" as const },
          { dx: 0, dy: -1, type: "n" as const },
          { dx: 1, dy: 0, type: "e" as const },
          { dx: -1, dy: 0, type: "w" as const },
        ];

        const exposedNeighbors = neighbors.filter((n) => {
          const neighborX = x + n.dx;
          const neighborY = y + n.dy;
          const neighborSymbol = mapLoader.getTileAt(
            neighborX,
            neighborY,
            levelStr,
          );
          return !this.isStructuralTileForVolumetric(
            neighborSymbol,
            mapData,
            levelStr,
            neighborX,
            neighborY,
          );
        });

        const orientedFaces = this.getOrientedVisibleFaces(
          key,
          tileId,
          worldX + size / 2,
          worldY + size / 2,
          exposedNeighbors.map((n) => n.type),
        );

        neighbors.forEach((n) => {
          const isExposed = exposedNeighbors.some(
            (candidate) => candidate.type === n.type,
          );
          if (isExposed && orientedFaces.includes(n.type)) {
            let p1, p2, p3, p4;

            // Wall connects Roof points (worldX/Y) to projected Base points (worldX/Y + delta)
            if (n.type === "s") {
              p1 = { x: worldX, y: worldY + size };
              p2 = { x: worldX + size, y: worldY + size };
              p3 = { x: worldX + size + deltaX, y: worldY + size + deltaY };
              p4 = { x: worldX + deltaX, y: worldY + size + deltaY };
            } else if (n.type === "n") {
              p1 = { x: worldX, y: worldY };
              p2 = { x: worldX + size, y: worldY };
              p3 = { x: worldX + size + deltaX, y: worldY + deltaY };
              p4 = { x: worldX + deltaX, y: worldY + deltaY };
            } else if (n.type === "e") {
              p1 = { x: worldX + size, y: worldY };
              p2 = { x: worldX + size, y: worldY + size };
              p3 = { x: worldX + size + deltaX, y: worldY + size + deltaY };
              p4 = { x: worldX + size + deltaX, y: worldY + deltaY };
            } else {
              // 'w'
              p1 = { x: worldX, y: worldY };
              p2 = { x: worldX, y: worldY + size };
              p3 = { x: worldX + deltaX, y: worldY + size + deltaY };
              p4 = { x: worldX + deltaX, y: worldY + deltaY };
            }

            const textureKey = this.getVolumetricTextureKey(tileId, n.type);
            if (!isRoof && textureKey) {
              this.updateTexturedVolumetricFace(
                levelStr,
                `${key}_${n.type}`,
                textureKey,
                n.type,
                p1,
                p2,
                p4,
                deltaX,
                deltaY,
                tileId,
              );
            } else if (!isRoof) {
              const style = this.getVolumetricFaceStyle(
                n.type,
                levelDiff,
                factor,
                tileId,
              );
              graphics.fillStyle(style.fill, style.fillAlpha);
              graphics.beginPath();
              graphics.moveTo(p1.x, p1.y);
              graphics.lineTo(p2.x, p2.y);
              graphics.lineTo(p3.x, p3.y);
              graphics.lineTo(p4.x, p4.y);
              graphics.closePath();
              graphics.fill();
              graphics.lineStyle(1, style.stroke, style.strokeAlpha);
              graphics.strokePath();
            }

            if (shouldDrawTopSilhouette) {
              // Phase 2: stairs get a distinct golden/amber silhouette at 2px;
              // regular structures get the white silhouette at 1px.
              const silhouette = isStair
                ? this.getStairSilhouetteStyle(factor, levelDiff)
                : this.getTopSilhouetteStyle(factor, levelDiff);
              graphics.lineStyle(
                silhouette.width,
                silhouette.color,
                silhouette.alpha,
              );
              graphics.beginPath();
              graphics.moveTo(p1.x, p1.y);
              graphics.lineTo(p2.x, p2.y);
              graphics.strokePath();
            }
          }
        });
      });
    });
  }

  public update(playerX: number, playerY: number): void {
    // HARD LIMIT: 20 tiles radius (approx 41x41 area) for maximum performance regardless of screen size
    this.renderRadius = 20;

    const mapData = this.scene.cache.json.get(
      `${this.scene.registry.get("currentMap")}_data`,
    ) as MultiLevelMapData;
    if (!mapData) {
      console.warn("Map data not found");
      return;
    }
    const currentLevelValue = this.scene.registry.get("currentLevel");
    const currentLevel =
      currentLevelValue !== undefined ? String(currentLevelValue) : "0";

    // THROTTLING CHECK: level change OR time/distance
    const timeSinceLastUpdate = Date.now() - this.lastUpdateTime;
    const distMoved = Phaser.Math.Distance.Between(
      playerX,
      playerY,
      this.lastPlayerX,
      this.lastPlayerY,
    );

    const levelChanged = currentLevel !== this.lastRenderLevel;
    const shouldUpdate =
      levelChanged ||
      (timeSinceLastUpdate > this.updateThrottleMs &&
        distMoved > this.updateThreshold);

    if (!shouldUpdate) {
      return;
    }

    this.lastUpdateTime = Date.now();
    this.lastPlayerX = playerX;
    this.lastPlayerY = playerY;
    this.lastRenderLevel = currentLevel;

    const hideTiles =
      PlayerState.getInstance().getDiagnosticSettings().hideTiles;

    // Level change handling
    if (currentLevel !== this.currentLevel) {
      console.log(
        `[Renderer] Level Switch: ${this.currentLevel} -> ${currentLevel}. Purging old tiles.`,
      );
      this.currentLevel = currentLevel;
      this.updateCollisionForCurrentLevel();
      this.clearLazyObjects(); // Clear lazy rendering caches on level switch
      // CRITICAL: When level switches, we want a clean slate for the new level's viewport
    }

    const currentLevelData = mapData.levels[this.currentLevel];
    if (!currentLevelData) {
      console.warn(`Level data for the current level not found`);
      return;
    }

    const gridX = Math.floor(playerX / this.tileSize);
    const gridY = Math.floor(playerY / this.tileSize);

    // NEW: LAZY OBJECTS UPDATE (within radii)
    this.updateDecorations(gridX, gridY);
    this.updateEnemies(gridX, gridY);

    const mapWidthTiles = Math.floor(
      this.scene.physics.world.bounds.width / this.tileSize,
    );
    const mapHeightTiles = Math.floor(
      this.scene.physics.world.bounds.height / this.tileSize,
    );

    const padding = this.currentPerspectiveFactor > 0 ? 5 : 2; // Extra padding in 3D to account for perspective shifts
    const minX = Math.max(0, gridX - (this.renderRadius + padding));
    const maxX = Math.min(
      mapWidthTiles - 1,
      gridX + (this.renderRadius + padding),
    );
    const minY = Math.max(0, gridY - (this.renderRadius + padding));
    const maxY = Math.min(
      mapHeightTiles - 1,
      gridY + (this.renderRadius + padding),
    );
    const mapLoader = (this.scene as any).mapLoader as MapLoader | undefined;

    if (!mapLoader) return;

    const tilesToKeep: string[] = [];

    // Renderiza tiles do nível atual
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const symbol = mapLoader.getTileAt(x, y, this.currentLevel);
        // [STABILITY FIX] Explicitly handle reservations. SYMBOL '...' is NOT a tile key.
        if (!symbol || symbol === "...") {
          this.renderLowerLevelTile(x, y, mapData, tilesToKeep);
          continue;
        }
        const tileDef = mapData.tileDefinitions[symbol];
        if (!tileDef || tileDef.id === "transparent") {
          this.renderLowerLevelTile(x, y, mapData, tilesToKeep); // Renderiza nível inferior para tiles transparentes
          continue;
        }

        const tileKey = `${this.currentLevel}_${x}_${y}`;

        // OPTIMIZATION: O(1) Lookup
        let levelTiles = this.renderedTiles.get(this.currentLevel);
        if (!levelTiles) {
          levelTiles = new Map();
          this.renderedTiles.set(this.currentLevel, levelTiles);
        }

        if (!levelTiles.has(tileKey)) {
          const worldX = x * this.tileSize + this.tileSize / 2;
          const worldY = y * this.tileSize + this.tileSize / 2;
          const levelOffset = this.getDepthForLevel(
            parseInt(this.currentLevel),
            parseInt(this.currentLevel),
          );

          const reusable = this.tilePool.get() || undefined;
          if (reusable) this.resetSprite(reusable);

          const { sprite, additionalSprites, isCollidable } =
            TileRegistry.createTile(this.scene, tileDef.id, worldX, worldY, {
              levelOffset,
              isUnderTile: false,
              reusableSprite: reusable,
            });

          // Add to perspective container
          this.getLevelContainer(this.currentLevel).add(sprite);
          additionalSprites.forEach((s) =>
            this.getLevelContainer(this.currentLevel).add(s),
          );

          sprite.setName(tileKey);
          sprite.setVisible(!hideTiles);
          sprite.setActive(true);

          levelTiles.set(tileKey, [sprite, ...additionalSprites]);

          // --- RESTORED PHYSICS COLLISION (FIX v6.1) ---
          if (isCollidable || mapData.tileDefinitions[symbol]?.block === true) {
            const wallsLayer = mapLoader?.getWallsLayer?.(this.currentLevel);
            if (wallsLayer) wallsLayer.add(sprite);

            const body = sprite.body as
              | Phaser.Physics.Arcade.Body
              | Phaser.Physics.Arcade.StaticBody;
            if (body) {
              if ("setImmovable" in body) body.setImmovable(true);

              const registryDef = TileRegistry.getTileDefinition(tileDef.id);
              if (registryDef?.bodySize || registryDef?.bodyOffset) {
                if (registryDef.bodySize)
                  body.setSize(
                    registryDef.bodySize.width,
                    registryDef.bodySize.height,
                  );
                if (registryDef.bodyOffset)
                  body.setOffset(
                    registryDef.bodyOffset.x,
                    registryDef.bodyOffset.y,
                  );
              } else if (
                tileDef.id.includes("wall") ||
                tileDef.id.includes("chest")
              ) {
                if (tileDef.isFrontWall) {
                  body.setSize(this.tileSize, 32);
                  body.setOffset(0, this.tileSize - 32);
                } else if (tileDef.id.includes("side")) {
                  body.setSize(32, 32);
                  body.setOffset((this.tileSize - 32) / 2, this.tileSize - 32);
                }
              }
            }
          }
        }

        const isCollidableEffective =
          TileRegistry.isCollidable(tileDef.id) ||
          mapData.tileDefinitions[symbol]?.block === true;
        if (levelTiles.has(tileKey)) {
          levelTiles
            .get(tileKey)!
            .forEach((s) =>
              this.applyDebugTint(
                s,
                isCollidableEffective,
                PlayerState.getInstance().isDebugCollisionEnabled(),
              ),
            );
        }

        tilesToKeep.push(tileKey);

        if (tileDef.under) {
          if (tileDef.under === "...") {
            this.renderLowerLevelTile(x, y, mapData, tilesToKeep);
          } else {
            const underTileId = this.resolveSymbolToId(tileDef.under, mapData);
            const underTileKey = `${this.currentLevel}_${x}_${y}_under`;

            if (!levelTiles.has(underTileKey)) {
              try {
                const reusable = this.tilePool.get() || undefined;
                if (reusable) this.resetSprite(reusable);

                const { sprite, additionalSprites } = TileRegistry.createTile(
                  this.scene,
                  underTileId,
                  x * this.tileSize + this.tileSize / 2,
                  y * this.tileSize + this.tileSize / 2,
                  {
                    levelOffset: this.getDepthForLevel(
                      parseInt(this.currentLevel),
                      parseInt(this.currentLevel),
                    ),
                    isUnderTile: true,
                    reusableSprite: reusable,
                  },
                );

                this.getLevelContainer(this.currentLevel).add(sprite);
                additionalSprites.forEach((s) =>
                  this.getLevelContainer(this.currentLevel).add(s),
                );

                sprite.setData("worldX", x * this.tileSize + this.tileSize / 2);
                sprite.setData("worldY", y * this.tileSize + this.tileSize / 2);
                sprite.setName(underTileKey);
                sprite.setVisible(!hideTiles);
                sprite.setActive(true);
                levelTiles.set(underTileKey, [sprite, ...additionalSprites]);
              } catch (err) {
                console.warn(
                  `Failed to create under tile with ID '${underTileId}':`,
                  err,
                );
              }
            }
            tilesToKeep.push(underTileKey);
          }
        }
      }
    }

    const player = (this.scene as any).player as Player | undefined;
    if (!player?.sprite?.body) {
      return;
    }
    const playerBounds = player.sprite.getBounds();
    const currentLevelNum = parseInt(this.currentLevel);
    const maxLevel = Math.max(
      ...Object.keys(mapData.levels).map((level) => parseInt(level)),
    );
    const levelsToRender: number[] = [];
    // In 3D perspective mode, always render adjacent upper levels so they are
    // visible with perspective scaling/tint. In 2D mode, keep the original
    // overlap-only behaviour to avoid rendering unnecessary tiles.
    const perspectiveOn =
      this.currentPerspectiveFactor > 0.001 ||
      this.targetPerspectiveFactor > 0.001;
    // Cap at ±3 levels from current to avoid perf spikes on deep maps
    const upperRenderLimit = Math.min(maxLevel, currentLevelNum + 3);
    for (
      let levelToCheck = currentLevelNum + 1;
      levelToCheck <= upperRenderLimit;
      levelToCheck++
    ) {
      if (!mapData.levels[levelToCheck.toString()]) {
        continue;
      }

      if (perspectiveOn) {
        // Always include upper levels when perspective is active
        levelsToRender.push(levelToCheck);
        continue;
      }

      // 2D mode: only render upper level if player is physically under a tile
      let hasOverlap = false;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const symbol = mapLoader.getTileAt(x, y, levelToCheck.toString());
          if (
            !symbol ||
            symbol === "..." ||
            mapData.tileDefinitions[symbol]?.under === "..."
          ) {
            continue;
          }
          const tileDef =
            mapData.tileDefinitions[symbol] || mapData.entityTemplates[symbol];
          if (tileDef) {
            const worldX = x * this.tileSize + this.tileSize / 2;
            const worldY = y * this.tileSize + this.tileSize / 2;
            const tileBounds = new Phaser.Geom.Rectangle(
              worldX - this.tileSize / 2,
              worldY - this.tileSize / 2,
              this.tileSize,
              this.tileSize,
            );
            if (Phaser.Geom.Rectangle.Overlaps(playerBounds, tileBounds)) {
              hasOverlap = true;
              break;
            }
          }
        }
        if (hasOverlap) break;
      }
      if (hasOverlap) {
        break;
      }
      levelsToRender.push(levelToCheck);
    }
    for (const level of levelsToRender) {
      this.renderUpperLevelTile(
        level,
        mapData,
        tilesToKeep,
        gridX,
        gridY,
        minX,
        maxX,
        minY,
        maxY,
      );
    }
    const droppedItemsGroup = (this.scene as any).droppedItemsGroup as
      | Phaser.Physics.Arcade.Group
      | undefined;
    if (droppedItemsGroup) {
      droppedItemsGroup.getChildren().forEach((item) => {
        const droppedItem = item as DroppedItem;
        droppedItem.updateDepth();
      });
    }

    // APPLY PERSPECTIVE SHADING/SCALING (v5.8 Premium Visuals)
    this.updateAllTileTints(
      PlayerState.getInstance().isDebugCollisionEnabled(),
    );

    this.cleanupTiles(tilesToKeep);

    if (PlayerState.getInstance().isDebugCollisionEnabled()) {
      this.drawDebugHitboxes();
    }

    // Update Cloud Mask
    this.updateCloudMask(gridX, gridY, minX, maxX, minY, maxY, mapData);
  }

  private updateCollisionForCurrentLevel(): void {
    const mapLoader = (this.scene as any).mapLoader as MapLoader | undefined;
    const wallsLayer = mapLoader?.getWallsLayer?.();
    if (wallsLayer) {
      const player = (this.scene as any).player as Player;
      if (player?.sprite?.body) {
        this.scene.physics.world.collide(player.sprite, wallsLayer);
      }
    }
  }

  private resolveSymbolToId(
    symbol: string,
    mapData: MultiLevelMapData,
  ): string {
    if (mapData.tileDefinitions[symbol]) {
      return mapData.tileDefinitions[symbol].id;
    }
    if (mapData.entityTemplates[symbol]) {
      const entity = mapData.entityTemplates[symbol];
      if (entity.under) return this.resolveSymbolToId(entity.under, mapData);
    }
    return symbol;
  }

  private getTileDefinition(
    symbol: string,
    mapData: MultiLevelMapData,
    level: string,
    x: number,
    y: number,
  ): { id: string; under?: string } | undefined {
    return mapData.tileDefinitions[symbol];
  }

  private renderLowerLevelTile(
    x: number,
    y: number,
    mapData: MultiLevelMapData,
    tilesToKeep: string[],
  ): void {
    const currentLevelNum = parseInt(this.currentLevel);
    const mapLoader = (this.scene as any).mapLoader as MapLoader;
    let levelToCheck = currentLevelNum - 1;

    // Check floors below current (Limit to 3 levels deep for performance)
    let depthCount = 0;
    while (mapData.levels[levelToCheck.toString()] && depthCount < 3) {
      const symbol = mapLoader.getTileAt(x, y, levelToCheck.toString());

      if (!symbol || symbol === "...") {
        levelToCheck--;
        depthCount++;
        continue;
      }
      const tileDef = this.getTileDefinition(
        symbol,
        mapData,
        levelToCheck.toString(),
        x,
        y,
      );
      if (!tileDef || tileDef.id === "transparent") {
        levelToCheck--;
        continue;
      }

      const levelStr = levelToCheck.toString();
      let levelTiles = this.renderedTiles.get(levelStr);
      if (!levelTiles) {
        levelTiles = new Map();
        this.renderedTiles.set(levelStr, levelTiles);
      }

      const worldX = x * this.tileSize + this.tileSize / 2;
      const worldY = y * this.tileSize + this.tileSize / 2;
      const levelOffset = this.getDepthForLevel(levelToCheck, currentLevelNum);
      const tileKey = `${levelToCheck}_${x}_${y}`;

      if (!levelTiles.has(tileKey)) {
        const reusable = this.tilePool.get() || undefined;
        if (reusable) this.resetSprite(reusable);

        const { sprite, additionalSprites } = TileRegistry.createTile(
          this.scene,
          tileDef.id,
          worldX,
          worldY,
          { levelOffset, isUnderTile: false, reusableSprite: reusable },
        );

        this.getLevelContainer(levelStr).add(sprite);
        additionalSprites.forEach((s) =>
          this.getLevelContainer(levelStr).add(s),
        );

        sprite.setTint(0x666666);
        sprite.setAlpha(0.8);
        sprite.setName(tileKey);
        sprite.setVisible(
          !PlayerState.getInstance().getDiagnosticSettings().hideTiles,
        );
        sprite.setActive(true);
        levelTiles.set(tileKey, [sprite, ...additionalSprites]);
      }
      tilesToKeep.push(tileKey);

      const isCollidableEffective =
        !!mapData.tileDefinitions[symbol]?.block ||
        TileRegistry.isCollidable(tileDef.id);
      if (levelTiles.has(tileKey)) {
        levelTiles
          .get(tileKey)!
          .forEach((s) =>
            this.applyDebugTint(
              s,
              isCollidableEffective,
              PlayerState.getInstance().isDebugCollisionEnabled(),
              0x999999,
            ),
          );
      }

      if (tileDef.under && tileDef.under !== "...") {
        const underTileId = this.resolveSymbolToId(tileDef.under, mapData);
        const underTileKey = `${levelToCheck}_${x}_${y}_under`;

        if (!levelTiles.has(underTileKey)) {
          try {
            const reusable = this.tilePool.get() || undefined;
            if (reusable) this.resetSprite(reusable);

            const { sprite, additionalSprites } = TileRegistry.createTile(
              this.scene,
              underTileId,
              worldX,
              worldY,
              {
                levelOffset: levelOffset - 1,
                isUnderTile: true,
                reusableSprite: reusable,
              },
            );

            this.getLevelContainer(levelStr).add(sprite);
            additionalSprites.forEach((s) =>
              this.getLevelContainer(levelStr).add(s),
            );

            sprite.setData("worldX", worldX);
            sprite.setData("worldY", worldY);
            sprite.setTint(0x666666);
            sprite.setAlpha(0.8);
            sprite.setName(underTileKey);
            sprite.setVisible(
              !PlayerState.getInstance().getDiagnosticSettings().hideTiles,
            );
            sprite.setActive(true);
            levelTiles.set(underTileKey, [sprite, ...additionalSprites]);
          } catch (error) {
            console.warn(
              `Failed to create under tile (lower) with ID '${underTileId}':`,
              error,
            );
          }
        }
        tilesToKeep.push(underTileKey);
      }
      break;
    }
  }

  private renderUpperLevelTile(
    level: number,
    mapData: MultiLevelMapData,
    tilesToKeep: string[],
    gridX: number,
    gridY: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): void {
    const currentLevelNum = parseInt(this.currentLevel);
    const mapLoader = (this.scene as any).mapLoader as MapLoader;
    const levelStr = level.toString();
    const levelData = mapData.levels[levelStr];

    if (!levelData) return;

    let levelTiles = this.renderedTiles.get(levelStr);
    if (!levelTiles) {
      levelTiles = new Map();
      this.renderedTiles.set(levelStr, levelTiles);
    }

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const symbol = mapLoader.getTileAt(x, y, levelStr);
        if (!symbol || symbol === "...") continue;
        const tileDef = this.getTileDefinition(symbol, mapData, levelStr, x, y);
        if (!tileDef || tileDef.id === "transparent") continue;
        const roofCutHidden = this.shouldHideUpperRoofTile(
          tileDef.id,
          level,
          x,
          y,
          gridX,
          gridY,
          mapData,
          mapLoader,
        );
        const upperVisible =
          !PlayerState.getInstance().getDiagnosticSettings().hideTiles &&
          !roofCutHidden;

        const tileKey = `${level}_${x}_${y}_upper`;

        if (!levelTiles.has(tileKey)) {
          const worldX = x * this.tileSize + this.tileSize / 2;
          const worldY = y * this.tileSize + this.tileSize / 2;
          const levelOffset = this.getDepthForLevel(level, currentLevelNum);

          const reusable = this.tilePool.get() || undefined;
          if (reusable) this.resetSprite(reusable);

          const { sprite, additionalSprites } = TileRegistry.createTile(
            this.scene,
            tileDef.id,
            worldX,
            worldY,
            { levelOffset, isUnderTile: false, reusableSprite: reusable },
          );

          this.getLevelContainer(levelStr).add(sprite);
          additionalSprites.forEach((s) =>
            this.getLevelContainer(levelStr).add(s),
          );

          sprite.setAlpha(1.0);
          sprite.setName(tileKey);
          sprite.setVisible(upperVisible);
          sprite.setActive(true);
          levelTiles.set(tileKey, [sprite, ...additionalSprites]);
        }
        if (levelTiles.has(tileKey)) {
          levelTiles.get(tileKey)!.forEach((s) => s.setVisible(upperVisible));
        }
        tilesToKeep.push(tileKey);

        if (tileDef.under && tileDef.under !== "...") {
          const underTileDef = mapData.tileDefinitions[tileDef.under];
          if (underTileDef) {
            const underTileKey = `${level}_${x}_${y}_under_upper`;
            if (!levelTiles.has(underTileKey)) {
              const worldX = x * this.tileSize + this.tileSize / 2;
              const worldY = y * this.tileSize + this.tileSize / 2;
              const levelOffset = this.getDepthForLevel(level, currentLevelNum);
              const reusable = this.tilePool.get() || undefined;

              const { sprite, additionalSprites } = TileRegistry.createTile(
                this.scene,
                underTileDef.id,
                worldX,
                worldY,
                {
                  levelOffset: levelOffset - 1,
                  isUnderTile: true,
                  reusableSprite: reusable,
                },
              );

              this.getLevelContainer(levelStr).add(sprite);
              additionalSprites.forEach((s) =>
                this.getLevelContainer(levelStr).add(s),
              );

              sprite.setAlpha(1.0);
              sprite.setName(underTileKey);
              sprite.setVisible(
                !PlayerState.getInstance().getDiagnosticSettings().hideTiles,
              );
              sprite.setActive(true);
              levelTiles.set(underTileKey, [sprite, ...additionalSprites]);
            }
            if (levelTiles.has(underTileKey)) {
              levelTiles
                .get(underTileKey)!
                .forEach((s) =>
                  s.setVisible(
                    !PlayerState.getInstance().getDiagnosticSettings()
                      .hideTiles,
                  ),
                );
            }
            tilesToKeep.push(underTileKey);
          }
        }

        const isCollidableEffective =
          !!mapData.tileDefinitions[symbol]?.block ||
          TileRegistry.isCollidable(tileDef.id);
        if (levelTiles.has(tileKey)) {
          levelTiles
            .get(tileKey)!
            .forEach((s) =>
              this.applyDebugTint(
                s,
                isCollidableEffective,
                PlayerState.getInstance().isDebugCollisionEnabled(),
              ),
            );
        }
      }
    }
  }

  public syncEntityToContainer(
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.GameObject,
    level: string,
  ): void {
    const container = this.getLevelContainer(level);
    if (sprite.parentContainer !== container) {
      container.add(sprite as any);
    }
  }

  private getDepthForLevel(targetLevel: number, currentLevel: number): number {
    return getDepthOffset(targetLevel, currentLevel, this.projectionSettings);
  }

  private clearRenderedTiles(): void {
    this.renderedTiles.forEach((tiles) =>
      tiles.forEach((spriteList) =>
        spriteList.forEach((sprite) => {
          sprite.parentContainer?.remove(sprite);
          sprite.destroy();
        }),
      ),
    );
    this.renderedTiles.clear();
  }

  private drawDebugHitboxes(): void {
    const graphics = this.debugGraphics;
    if (!graphics) return;
    graphics.clear();

    this.renderedTiles.forEach((levelMap) => {
      levelMap.forEach((sprites) => {
        const mainSprite = sprites[0];
        const body = mainSprite?.body as Phaser.Physics.Arcade.Body;
        if (body) {
          graphics.lineStyle(2, 0xff0000, 1);
          graphics.fillStyle(0xff0000, 0.3);
          graphics.strokeRect(body.x, body.y, body.width, body.height);
          graphics.fillRect(body.x, body.y, body.width, body.height);
        }
      });
    });
  }

  // --- CLOUD SHADOW SYSTEM ---
  private cloudShadowSprite: Phaser.GameObjects.TileSprite | null = null;
  private cloudMaskGraphics: Phaser.GameObjects.Graphics | null = null;
  private isCloudSystemReady: boolean = false;

  public initClouds(): void {
    if (this.isCloudSystemReady) return;
    const enabled = PlayerState.getInstance().isCloudShadowsEnabled();
    if (!enabled) return;

    if (!this.scene.textures.exists("cloud_noise")) {
      this.generateCloudTexture();
    }

    this.cloudMaskGraphics = this.scene.make.graphics({ x: 0, y: 0 });
    const mask = this.cloudMaskGraphics.createGeometryMask();

    const width = this.scene.scale.width + 512;
    const height = this.scene.scale.height + 512;

    this.cloudShadowSprite = this.scene.add.tileSprite(
      0,
      0,
      width,
      height,
      "cloud_noise",
    );
    this.cloudShadowSprite.setScrollFactor(0);
    this.cloudShadowSprite.setDepth(19000);
    this.cloudShadowSprite.setAlpha(0.35);
    this.cloudShadowSprite.setTint(0x000000);
    this.cloudShadowSprite.setMask(mask);
    this.isCloudSystemReady = true;
  }

  private generateCloudTexture(): void {
    const width = 2048;
    const height = 2048;
    const key = "cloud_noise";
    const canvas = this.scene.textures.createCanvas(key, width, height);
    if (!canvas) return;
    const ctx = canvas.getContext();
    ctx.clearRect(0, 0, width, height);
    ctx.filter = "blur(15px)";
    ctx.fillStyle = "white";
    const cloudCount = 2;

    const drawWrappedCircle = (cx: number, cy: number, r: number) => {
      const draw = (dx: number, dy: number) => {
        ctx.beginPath();
        ctx.arc(dx, dy, r, 0, Math.PI * 2);
        ctx.fill();
      };
      draw(cx, cy);
      if (cx - r < 0) draw(cx + width, cy);
      if (cx + r > width) draw(cx - width, cy);
      if (cy - r < 0) draw(cx, cy + height);
      if (cy + r > height) draw(cx, cy - height);
    };

    for (let i = 0; i < cloudCount; i++) {
      const cx = Math.random() * width;
      const cy = Math.random() * height;
      const baseRadius = 150 + Math.random() * 100;
      drawWrappedCircle(cx, cy, baseRadius);
      const attachments = 4 + Math.floor(Math.random() * 5);
      for (let j = 0; j < attachments; j++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = baseRadius * (0.5 + Math.random() * 0.4);
        const r = baseRadius * (0.4 + Math.random() * 0.5);
        drawWrappedCircle(
          cx + Math.cos(angle) * dist,
          cy + Math.sin(angle) * dist,
          r,
        );
      }
    }
    canvas.refresh();
  }

  public updateClouds(time: number, delta: number): void {
    if (!this.cloudShadowSprite) return;
    const enabled =
      PlayerState.getInstance().getDiagnosticSettings().enableClouds;
    this.cloudShadowSprite.setVisible(enabled);
    if (this.cloudMaskGraphics) this.cloudMaskGraphics.setVisible(enabled);
    if (!enabled) return;
    const cam = this.scene.cameras.main;
    this.cloudShadowSprite.setPosition(cam.width / 2, cam.height / 2);
    this.cloudShadowSprite.setSize(cam.width + 256, cam.height + 256);
    this.cloudShadowSprite.tilePositionX = cam.scrollX * 0.5 + time * 0.02;
    this.cloudShadowSprite.tilePositionY = cam.scrollY * 0.5 + time * 0.01;
  }

  private isExposedToSky(
    x: number,
    y: number,
    mapData: MultiLevelMapData,
  ): boolean {
    const currentLevelNum = parseInt(this.currentLevel);
    const mapLoader = (this.scene as any).mapLoader as MapLoader;

    for (const levelKey in mapData.levels) {
      const lvl = parseInt(levelKey);
      if (lvl <= currentLevelNum) continue;

      const symbol = mapLoader.getTileAt(x, y, levelKey);
      if (symbol && symbol !== "...") {
        const tileDef =
          mapData.tileDefinitions[symbol] || mapData.entityTemplates[symbol];
        if (tileDef && tileDef.id === "transparent") continue;
        return false;
      }
    }
    return true;
  }

  public updateCloudMask(
    gridX: number,
    gridY: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    mapData: MultiLevelMapData,
  ): void {
    if (!this.cloudMaskGraphics) this.initClouds();
    if (!this.cloudMaskGraphics) return;
    this.cloudMaskGraphics.clear();
    this.cloudMaskGraphics.fillStyle(0xffffff, 1);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.isExposedToSky(x, y, mapData)) {
          this.cloudMaskGraphics.fillRect(
            x * this.tileSize,
            y * this.tileSize,
            this.tileSize,
            this.tileSize,
          );
        }
      }
    }
  }

  public getRenderedTilesCount(): number {
    let count = 0;
    this.renderedTiles.forEach((levelTiles) => {
      count += levelTiles.size;
    });
    return count;
  }

  private clearLazyObjects(): void {
    this.renderedDecorations.forEach((sprites) => {
      sprites.forEach((s) => this.tilePool.release(s));
    });
    this.renderedDecorations.clear();
  }

  private updateDecorations(gridX: number, gridY: number): void {
    const scene = this.scene as any;
    const decorationsMeta = scene.decorationsByLevel?.get(this.currentLevel);
    if (!decorationsMeta) return;
    const currentLevelNum = parseInt(this.currentLevel);
    const levelDepthOffset = this.getDepthForLevel(currentLevelNum, 0);

    const keysToKeep = new Set<string>();
    const radius = this.renderRadius;
    const tileSize = this.tileSize;

    decorationsMeta.forEach((meta: any) => {
      const dx = Math.floor(meta.worldX / tileSize);
      const dy = Math.floor(meta.worldY / tileSize);

      if (Math.abs(dx - gridX) <= radius && Math.abs(dy - gridY) <= radius) {
        const key = `dec_${dx}_${dy}_${meta.tileId}`;
        keysToKeep.add(key);

        if (!this.renderedDecorations.has(key)) {
          const reusable = this.tilePool.get() || undefined;
          let sprite: Phaser.GameObjects.Sprite;
          let additionalSprites: Phaser.GameObjects.Sprite[] = [];

          try {
            const created = TileRegistry.createTile(
              this.scene,
              meta.tileId,
              meta.worldX,
              meta.worldY,
              {
                levelOffset: levelDepthOffset,
                isUnderTile: false,
                reusableSprite: reusable,
              },
            );
            sprite = created.sprite;
            additionalSprites = created.additionalSprites;
          } catch (error) {
            console.error(
              `[LevelRenderer] Failed to render decoration tile '${meta.tileId}' at (${meta.worldX}, ${meta.worldY})`,
              error,
            );
            if (reusable) this.tilePool.release(reusable);
            return;
          }

          if (meta.scale) sprite.setScale(meta.scale);
          if (meta.rotation) sprite.setRotation(meta.rotation);
          sprite.setDepth(meta.worldY + levelDepthOffset + 10);

          if (meta.isCollidable) {
            this.scene.physics.add.existing(sprite, true);
            const mapLoader = (this.scene as any).mapLoader;
            mapLoader?.getWallsLayer?.(this.currentLevel)?.add(sprite);
          }

          this.renderedDecorations.set(key, [sprite, ...additionalSprites]);
        }
      }
    });

    this.renderedDecorations.forEach((sprites, key) => {
      if (!keysToKeep.has(key)) {
        const mapLoader = (this.scene as any).mapLoader;
        const wallsLayer = mapLoader?.getWallsLayer?.(this.currentLevel);
        sprites.forEach((s) => {
          if (wallsLayer) wallsLayer.remove(s);
          this.tilePool.release(s);
        });
        this.renderedDecorations.delete(key);
      }
    });
  }

  private cleanupTiles(tilesToKeep: string[]): void {
    const activeKeys = new Set(tilesToKeep);
    const mapLoader = (this.scene as any).mapLoader;

    // Cleanup Main Tiles
    this.renderedTiles.forEach((levelMap, level) => {
      levelMap.forEach((sprites, key) => {
        if (!activeKeys.has(key)) {
          this.orientableFaceState.delete(key);
          const wallsLayer = mapLoader?.getWallsLayer?.(level);
          sprites.forEach((s) => {
            if (wallsLayer) wallsLayer.remove(s);
            s.setActive(false);
            s.setVisible(false);
            if (s.parentContainer) s.parentContainer.remove(s);
            this.tilePool.release(s);
          });
          levelMap.delete(key);
        }
      });
    });
  }

  public updateEnemies(gridX: number, gridY: number): void {
    const scene = this.scene as any;
    const enemiesMeta = scene.enemiesByLevel?.get(this.currentLevel);
    if (!enemiesMeta) return;

    const keysToKeep = new Set<string>();
    const radius = this.renderRadius;
    const tileSize = this.tileSize;

    enemiesMeta.forEach((meta: any) => {
      const ex = Math.floor(meta.x / tileSize);
      const ey = Math.floor(meta.y / tileSize);

      if (Math.abs(ex - gridX) <= radius && Math.abs(ey - gridY) <= radius) {
        const key = meta.id;
        keysToKeep.add(key);

        if (!this.activeEnemies.has(key)) {
          const deadEnemies = scene.deadEnemies || [];
          const isDead = deadEnemies.some((d: any) => d.id === key);
          if (!isDead) {
            const EnemyClass = require("../entities/Enemy").default;
            const enemy = new EnemyClass(
              this.scene,
              meta.x,
              meta.y,
              meta.type,
              meta.overrides,
            );
            enemy.id = key;
            enemy.level = this.currentLevel;
            enemy.respawnTime = meta.respawnTime;
            this.activeEnemies.set(key, enemy);
          }
        }
      }
    });

    this.activeEnemies.forEach((enemy, key) => {
      if (!keysToKeep.has(key)) {
        enemy.destroy();
        this.activeEnemies.delete(key);
      }
    });
  }

  public getDNAAnalysis(): {
    culprits: [string, number][];
    poolSize: number;
    types: Record<string, number>;
  } {
    const textureBreakdown: Record<string, number> = {};
    const typeBreakdown: Record<string, number> = {};

    this.scene.children.each((child: any) => {
      // Object Type Breakdown
      const type = child.constructor.name || child.type || "Unknown";
      typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;

      // Texture Breakdown (Original Cullprits)
      const key = child.texture?.key || "no-texture";
      const label = `${type} (${key})`;
      textureBreakdown[label] = (textureBreakdown[label] || 0) + 1;
    });

    const culprits = Object.entries(textureBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      culprits,
      poolSize: this.tilePool.getRawPool().length,
      types: typeBreakdown,
    };
  }

  public purgeOrphans(): void {
    console.log("☢️ NUCLEAR PURGE INITIATED");
    const trackedSprites = new Set<Phaser.GameObjects.GameObject>();

    this.renderedTiles.forEach((lv) =>
      lv.forEach((sprites) => sprites.forEach((s) => trackedSprites.add(s))),
    );
    this.renderedDecorations.forEach((sprites) =>
      sprites.forEach((s) => trackedSprites.add(s)),
    );
    this.activeEnemies.forEach((e) => {
      if (e.sprite) trackedSprites.add(e.sprite);
      if (e.healthBar?.bar) trackedSprites.add(e.healthBar.bar);
    });

    const scene = this.scene as any;
    if (scene.player?.sprite) trackedSprites.add(scene.player.sprite);

    let destroyedCount = 0;
    this.scene.children.each((child: any) => {
      if (child.ignorePurge) return;
      if (
        child.type === "Graphics" &&
        (child === this.debugGraphics || child === this.cloudMaskGraphics)
      )
        return;

      if (!trackedSprites.has(child)) {
        child.destroy();
        destroyedCount++;
      }
    });
    console.log(
      `☢️ Purge complete. Destroyed ${destroyedCount} orphaned objects.`,
    );
  }

  public destroy(): void {
    this.clearLazyObjects();
    this.renderedTiles.forEach((tiles) => {
      tiles.forEach((sprites) => sprites.forEach((s) => s.destroy()));
    });
    this.renderedTiles.clear();
    this.orientableFaceState.clear();

    this.levelContainers.forEach((c) => c.destroy());
    this.levelContainers.clear();
    this.volumetricSlices.clear();

    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = null;
    }

    this.cleanupClouds();
  }

  private cleanupClouds(): void {
    if (this.cloudShadowSprite) {
      this.cloudShadowSprite.destroy();
      this.cloudShadowSprite = null;
    }
    if (this.cloudMaskGraphics) {
      this.cloudMaskGraphics.destroy();
      this.cloudMaskGraphics = null;
    }
    this.isCloudSystemReady = false;
  }
}
