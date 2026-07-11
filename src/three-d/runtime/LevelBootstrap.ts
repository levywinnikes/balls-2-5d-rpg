import type { GameContext } from "./GameContext";
import type { SliceMapData } from "./SliceTileTypes";

export interface LevelBootstrapDeps {
  loadMapData: () => Promise<SliceMapData | null>;
  ensureWorldMapReady: (mapData: SliceMapData) => Promise<void>;
  ensureDebugLoadout: (mapData: SliceMapData) => void;
  doorSystem: { ensureLevelSeeded: (level: string) => Promise<void> };
  ctx: GameContext;
  renderMapLevel: (level: string) => Promise<void>;
  propSystem: { ensureLevelSeeded: (level: string) => Promise<void> };
  player: { position: { x: number; y: number; z: number } };
  getMapTileAt: (level: string, x: number, z: number) => string | null;
  isBlockingTile: (symbol: string | null, def?: any, opts?: any) => boolean;
  isVoidSymbol: (symbol: string | null) => boolean;
  worldToSliceCoord: (value: number) => number;
  currentMapWidth: number;
  currentMapHeight: number;
  snapPlayerFootToActiveLevel: () => void;
  playerState: {
    exploreArea: (level: string, x: number, z: number, radius: number, w: number, h: number) => void;
    setCurrentLevel: (level: string) => void;
  };
}

/**
 * Full level bootstrap. Loads map data, binaries, seeds content, validates spawn.
 * HEAVY — only call at startup or on explicit respawn. NOT for gameplay level changes.
 * For gameplay level changes, use applyActiveLevelChange (streaming side effects only).
 */
export async function ensureMapLevelReady(
  deps: LevelBootstrapDeps,
  requestedLevel: string,
): Promise<string | null> {
  const mapData = await deps.loadMapData();
  if (!mapData || !mapData.levels) return null;

  const availableLevels = Object.keys(mapData.levels);
  if (availableLevels.length === 0) return null;

  const resolvedLevel = mapData.levels[requestedLevel] ? requestedLevel : availableLevels[0];

  await deps.ensureWorldMapReady(mapData);
  deps.ensureDebugLoadout(mapData);
  await deps.doorSystem.ensureLevelSeeded(resolvedLevel);

  if (resolvedLevel !== deps.ctx.getCurrentLevel()) {
    deps.ctx.applyActiveLevelChange(resolvedLevel, undefined, { natural: true });
  }

  await deps.renderMapLevel(resolvedLevel);
  await deps.propSystem.ensureLevelSeeded(resolvedLevel);

  const mapWidth = mapData.width ?? 0;
  const mapHeight = mapData.height ?? 0;
  const initialSpawn = mapData.levels[resolvedLevel]?.playerPos;
  const isWithinBounds =
    deps.player.position.x >= 0 && deps.player.position.z >= 0 &&
    deps.player.position.x < mapWidth && deps.player.position.z < mapHeight;
  const currentTileSymbol = isWithinBounds
    ? deps.getMapTileAt(resolvedLevel, Math.floor(deps.player.position.x), Math.floor(deps.player.position.z))
    : null;
  const currentTileDef = currentTileSymbol
    ? mapData.tileDefinitions?.[currentTileSymbol]
    : undefined;
  const currentTileBlocked = deps.isBlockingTile(currentTileSymbol, currentTileDef);
  const hasInvalidSpawn = !isWithinBounds || deps.isVoidSymbol(currentTileSymbol) || currentTileBlocked;

  if (hasInvalidSpawn) {
    const findNearestWalkable = (originX: number, originZ: number) => {
      const maxRadius = 12;
      const baseX = Math.floor(originX);
      const baseZ = Math.floor(originZ);
      for (let radius = 0; radius <= maxRadius; radius++) {
        for (let dz = -radius; dz <= radius; dz++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
            const tx = baseX + dx;
            const tz = baseZ + dz;
            if (tx < 0 || tz < 0 || tx >= mapWidth || tz >= mapHeight) continue;
            const symbol = deps.getMapTileAt(resolvedLevel, tx, tz);
            if (deps.isVoidSymbol(symbol)) continue;
            const tileDef = symbol ? mapData.tileDefinitions?.[symbol] : undefined;
            if (deps.isBlockingTile(symbol, tileDef)) continue;
            return { x: tx + 0.5, z: tz + 0.5 };
          }
        }
      }
      return null;
    };

    if (initialSpawn) {
      const targetX = deps.worldToSliceCoord(initialSpawn.x);
      const targetZ = deps.worldToSliceCoord(initialSpawn.y);
      const walkable = findNearestWalkable(targetX, targetZ);
      if (walkable) { deps.player.position.x = walkable.x; deps.player.position.z = walkable.z; }
      else { deps.player.position.x = Math.min(mapWidth - 0.5, Math.max(0.5, targetX)); deps.player.position.z = Math.min(mapHeight - 0.5, Math.max(0.5, targetZ)); }
    } else {
      const walkable = findNearestWalkable(deps.player.position.x, deps.player.position.z);
      if (walkable) { deps.player.position.x = walkable.x; deps.player.position.z = walkable.z; }
      else { deps.player.position.x = Math.min(mapWidth - 0.5, Math.max(0.5, deps.player.position.x)); deps.player.position.z = Math.min(mapHeight - 0.5, Math.max(0.5, deps.player.position.z)); }
    }
  }

  deps.playerState.exploreArea(resolvedLevel, Math.floor(deps.player.position.x), Math.floor(deps.player.position.z), 8, deps.currentMapWidth, deps.currentMapHeight);
  deps.snapPlayerFootToActiveLevel();

  return resolvedLevel;
}
