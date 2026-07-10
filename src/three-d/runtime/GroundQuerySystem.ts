import { type Vector3 } from "@babylonjs/core";
import { WALK_SURFACE, FEET_CLEARANCE } from "../../constants/World";
import { levelToWorldY } from "./PlayerContext";
import type { GameContext } from "./GameContext";

const WORLD_ANCHOR_REST_OFFSET = 0.012;

export interface GroundQueryConfig {
  ctx: GameContext;
}

export interface GroundQuerySystem {
  getGroundSurfaceY: (worldX: number, worldZ: number, level: string) => number;
  resolveWorldAnchorY: (worldX: number, worldZ: number, level: string, restOffset?: number) => number;
  applyActorAquaticY: (worldPos: Vector3, level: string) => void;
}

export function createGroundQuerySystem(cfg: GroundQueryConfig): GroundQuerySystem {
  const { ctx } = cfg;

  const getGroundSurfaceY = (worldX: number, worldZ: number, level: string) => {
    const floor = ctx.collisionWorld.queryFloor(
      worldX, worldZ,
      -9999, 9999,
      [level],
    );
    return floor ? floor.surfaceY : levelToWorldY(level) + WALK_SURFACE;
  };

  const resolveWorldAnchorY = (
    worldX: number,
    worldZ: number,
    level: string,
    restOffset = WORLD_ANCHOR_REST_OFFSET,
  ) => {
    const surfaceY = getGroundSurfaceY(worldX, worldZ, level);
    const aquatic = ctx.getAquaticSampleAt(worldX, worldZ, level);
    const sink = aquatic.mode === "dry" ? 0 : aquatic.sinkOffset;
    return surfaceY + sink + restOffset;
  };

  const applyActorAquaticY = (worldPos: Vector3, level: string) => {
    const sample = ctx.getAquaticSampleAt(worldPos.x, worldPos.z, level);
    const surfaceY = getGroundSurfaceY(worldPos.x, worldPos.z, level);
    const footY = surfaceY + FEET_CLEARANCE;
    worldPos.y = footY + sample.sinkOffset;
  };

  return { getGroundSurfaceY, resolveWorldAnchorY, applyActorAquaticY };
}
