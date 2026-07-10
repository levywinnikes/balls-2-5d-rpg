import type { GameContext } from "./GameContext";

export interface WorldBootstrapDeps {
  ctx: GameContext;
  sliceMapName: string;
  ensureMapLevelReady: (level: string) => Promise<string | null>;
  snapPlayerFootToActiveLevel: () => void;
  waitForSpawnChunkReady: () => Promise<boolean>;
  player: { position: { x: number; y: number; z: number } };
  getMapTileAt: (level: string, tx: number, tz: number) => string | null;
  isVoidSymbol: (symbol: string | null) => boolean;
  reanchorWorldContentOnLevel: (level: string) => void;
  propSystem: { syncStream: (force: boolean) => void };
  setPlayerAvatarVisible: (visible: boolean) => void;
  cameraSystem: { updateTopDownTarget: (pos: { x: number; y: number; z: number }) => void };
  resolveWorldReady?: () => void;
  getRenderLevel: () => string;
}

export async function bootstrapWorldSession(
  deps: WorldBootstrapDeps,
  retries = 3,
  baseDelayMs = 2000,
): Promise<void> {
  const { ctx, sliceMapName } = deps;
  ctx.telemetryLogger.pushLogEvent("world.bootstrap.start", { map: sliceMapName, level: ctx.getCurrentLevel() });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[3D Slice] Bootstrap attempt ${attempt + 1}/${retries + 1} after ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }

      await deps.ensureMapLevelReady(ctx.getCurrentLevel());
      deps.snapPlayerFootToActiveLevel();
      await deps.waitForSpawnChunkReady();
      deps.snapPlayerFootToActiveLevel();

      const tileX = Math.floor(deps.player.position.x);
      const tileZ = Math.floor(deps.player.position.z);
      const supportSymbol = deps.getMapTileAt(ctx.getCurrentLevel(), tileX, tileZ);
      if (deps.isVoidSymbol(supportSymbol)) {
        throw new Error(`[3D Slice] Invalid spawn tile (${tileX},${tileZ}) on level ${ctx.getCurrentLevel()}`);
      }

      ctx.lastGroundedFootY = deps.player.position.y;
      ctx.fallOriginFootY = deps.player.position.y;
      ctx.isGrounded = true;
      ctx.holeFallLandingLevel = null;
      ctx.holeFallFloorCount = 0;
      ctx.verticalVelocity = 0;

      deps.reanchorWorldContentOnLevel(deps.getRenderLevel());
      deps.propSystem.syncStream(true);

      ctx.worldBootstrapReady = true;
      deps.setPlayerAvatarVisible(true);
      deps.cameraSystem.updateTopDownTarget(deps.player.position);

      deps.resolveWorldReady?.();
      document.dispatchEvent(new CustomEvent("slice3d:worldBootstrap", {
        detail: { ready: true, map: sliceMapName, level: ctx.getCurrentLevel() },
      }));
      ctx.telemetryLogger.pushLogEvent("world.bootstrap.ready", {
        x: Math.round(deps.player.position.x * 100) / 100,
        y: Math.round(deps.player.position.y * 100) / 100,
        z: Math.round(deps.player.position.z * 100) / 100,
      });
      return;
    } catch (error) {
      console.error(`[3D Slice] World bootstrap failed (attempt ${attempt + 1})`, error);
      if (attempt >= retries) {
        document.dispatchEvent(new CustomEvent("slice3d:worldBootstrap", {
          detail: { ready: false, map: sliceMapName, error: String(error) },
        }));
        ctx.telemetryLogger.pushLogEvent("world.bootstrap.failed", { error: String(error), attempts: attempt + 1 });
        return;
      }
    }
  }
}
