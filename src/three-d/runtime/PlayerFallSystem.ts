import type { GameContext } from "./GameContext";
import type { AquaticSample } from "./WaterProfile";
import type { HeroAnimState } from "./TwoDParitySpriteFactory";
import { t_game } from "../../game/i18n/translations";
import { WorldMapService } from "../../services/WorldMapService";
import { computeFallDamageMultiplier } from "./AquaticVisualConfig";

import { WALK_SURFACE } from "../../constants/World";
import { levelToWorldY } from "./PlayerContext";

const PLAYER_DEATH_SEQUENCE_MS = 2000;

const parseLevelNumber = (level: string) => Number.parseInt(level, 10) || 0;

const worldToSliceCoord = (value: number): number => value / 32;

export interface PlayerFallSystemConfig {
  ctx: GameContext;
  getCurrentLevel: () => string;
  setHeroAnimState: (state: HeroAnimState, lockMs?: number) => void;
  emitPlayerDamagePopup: (
    sourceKey: string,
    rawDamage: number,
    icon?: string,
    customColor?: string,
  ) => void;
  getAquaticSampleAt: (x: number, z: number, level: string) => AquaticSample;
  getMapTileAt: (level: string, tileX: number, tileZ: number) => string | null;
  isVoidSymbol: (symbol: string | null) => boolean;
  applyActiveLevelChange: (
    level: string,
    transition?: any,
    opts?: { natural?: boolean },
  ) => void;
  ensureMapLevelReady: (level: string) => Promise<string | null>;
  snapPlayerFootToActiveLevel: () => void;
}

/**
 * Pure physics-based fall damage. No "floors" concept — uses impact velocity only.
 *
 * SAFE_SPEED (8.0): landing from normal jump (JUMP_IMPULSE ≈ 7.2) = 0% damage.
 * FATAL_SPEED (26.0): ~4-5 levels of FALL_GRAVITY, always lethal.
 *
 * Between safe and fatal: linear interpolation.
 *   impactSpeed 12 → 22% (small fall)
 *   impactSpeed 16 → 44% (medium fall)
 *   impactSpeed 20 → 67% (large fall)
 *   impactSpeed 24 → 89% (very large fall)
 *
 * No cap — if you hit fatal speed, you die.
 */
export function calculateFallDamagePercent(impactSpeed: number): number {
  const SAFE_SPEED = 8.0;
  const FATAL_SPEED = 26.0;
  if (impactSpeed <= SAFE_SPEED) return 0;
  if (impactSpeed >= FATAL_SPEED) return 1.0;
  return (impactSpeed - SAFE_SPEED) / (FATAL_SPEED - SAFE_SPEED);
}

export function createPlayerFallSystem(cfg: PlayerFallSystemConfig) {
  const { ctx } = cfg;

  const findVoidFallLanding = (
    startLevel: string,
    tileX: number,
    tileZ: number,
  ): { landingLevel: string; floors: number } | null => {
    const mapData = ctx.mapDataCache;
    if (!mapData?.levels) {
      return null;
    }

    const levelNumbers = Object.keys(mapData.levels)
      .map((levelKey) => parseLevelNumber(levelKey))
      .sort((a, b) => b - a);

    const startNumber = parseLevelNumber(startLevel);
    let floors = 0;

    for (const levelNumber of levelNumbers) {
      if (levelNumber >= startNumber) {
        continue;
      }

      floors += 1;
      const candidateLevel = String(levelNumber);
      const symbol = cfg.getMapTileAt(candidateLevel, tileX, tileZ);

      if (!cfg.isVoidSymbol(symbol)) {
        return { landingLevel: candidateLevel, floors };
      }
    }

    return null;
  };

  const applyFallImpactDamage = (
    impactSpeed: number,
    landingLevel: string,
  ) => {
    if (impactSpeed < 9.5) return; // normal jump, no damage

    const maxHealth = Math.max(1, ctx.playerState.getMaxHealth());
    let damagePercent = calculateFallDamagePercent(impactSpeed);
    const landingAquatic = cfg.getAquaticSampleAt(
      ctx.player.position.x,
      ctx.player.position.z,
      landingLevel,
    );
    damagePercent *= computeFallDamageMultiplier(landingAquatic);
    const damage = Math.max(1, Math.floor(maxHealth * damagePercent));

    const playerDied = ctx.playerState.takeDamage(damage);
    cfg.emitPlayerDamagePopup(
      `fall:${landingLevel}`,
      damage,
      "\u26A0",
      "#ff5d5d",
    );

    const pct = Math.round(damagePercent * 100);
    ctx.playerState.log("msg_fall_impact", { damage, percent: pct }, "#ff5d5d");
    ctx.playerState.emit("uiNotification", {
      type: "danger",
      message: `Queda! ${damage} de dano (${pct}%)`,
    });

    if (playerDied) {
      triggerPlayerDeathSequence();
    }
  };

  const finishAirborneLanding = (
    landingLevel: string,
    landingFootY: number,
    impactSpeed: number,
  ): void => {
    if (impactSpeed < 8.0) {
      ctx.fallOriginFootY = landingFootY;
      return;
    }
    applyFallImpactDamage(impactSpeed, landingLevel);
    ctx.fallOriginFootY = landingFootY;
  };

  /**
   * Resolve respawn position. Priority:
   * 1. Spawn point set via playerState.setSpawnPoint (checkpoints)
   * 2. Last safe position on current physics level
   * 3. Map's startLevel/playerPos fallback
   */
  const resolveRespawnSpawn = (): { level: string; x: number; z: number } => {
    // 1. Use explicit spawn point if set (checkpoint, bed, shrine)
    const spawnPoint = ctx.playerState.getSpawnPoint();
    if (spawnPoint) {
      return spawnPoint;
    }

    // 2. Use last safe position
    const safeX = ctx.lastSafePlayerX;
    const safeZ = ctx.lastSafePlayerZ;
    const currentLevel = cfg.getCurrentLevel();
    if (isFinite(safeX) && isFinite(safeZ)) {
      return { level: currentLevel, x: safeX, z: safeZ };
    }

    // 3. Fallback to map config
    const mapData = ctx.mapDataCache;
    if (mapData?.levels) {
      const preferredLevel = mapData.config?.startLevel && mapData.levels[mapData.config.startLevel]
        ? mapData.config.startLevel
        : mapData.levels["0"] ? "0" : Object.keys(mapData.levels)[0] ?? currentLevel;

      const playerPos = mapData.levels[preferredLevel]?.playerPos;
      if (playerPos) {
        return {
          level: preferredLevel,
          x: worldToSliceCoord(playerPos.x),
          z: worldToSliceCoord(playerPos.y),
        };
      }
    }

    return { level: "0", x: 6.5, z: 6.5 };
  };

  const completePlayerRespawn = async () => {
    const respawn = resolveRespawnSpawn();

    ctx.playerState.respawn();
    ctx.inputManager.clearPressedKeys();
    ctx.setSelectedEnemy(null);
    ctx.projectileSystem.disposeAll();

    // Set position on both physics context and Babylon mesh
    ctx.playerCtx.position.x = respawn.x;
    ctx.playerCtx.position.z = respawn.z;
    ctx.player.position.x = respawn.x;
    ctx.player.position.z = respawn.z;
    // Move Y to target level's base so snapFoot anchors to the right level
    ctx.playerCtx.position.y = levelToWorldY(respawn.level) + WALK_SURFACE;
    ctx.player.position.y = ctx.playerCtx.position.y;
    cfg.snapPlayerFootToActiveLevel();
    ctx.player.position.y = ctx.playerCtx.position.y;

    // Reset all physics state for clean respawn
    ctx.verticalVelocity = 0;
    ctx.isGrounded = true;
    ctx.holeFallLandingLevel = null;
    ctx.holeFallFloorCount = 0;
    ctx.fallOriginFootY = ctx.playerCtx.position.y;
    ctx.levelTransitionCooldown = 0;
    ctx.verticalTransitionGuard = null;

    ctx.playerState.setCurrentLevel(respawn.level);
    WorldMapService.ensureLevelBuffer(respawn.level);
    ctx.lastSafePlayerX = respawn.x;
    ctx.lastSafePlayerZ = respawn.z;
    ctx.lastGroundedFootY = ctx.playerCtx.position.y;

    ctx.playerState.recordPlayerPosition(
      respawn.level,
      respawn.x * 32,
      respawn.z * 32,
    );
    ctx.enemySystem.resetLivingForPlayerRespawn();
    cfg.setHeroAnimState("idle");
    ctx.heroAnimLockedUntil = 0;
    ctx.isPlayerDeathSequenceActive = false;
    ctx.playerDeathTimeoutId = null;
    ctx.playerState.emit("playerRespawned");
  };

  const triggerPlayerDeathSequence = () => {
    if (ctx.isPlayerDeathSequenceActive) {
      return;
    }

    ctx.isPlayerDeathSequenceActive = true;
    ctx.inputManager.clearPressedKeys();
    ctx.setSelectedEnemy(null);
    if (ctx.isFirstPerson) {
      ctx.cameraSystem.setMode(false, false);
      ctx.isFirstPerson = false;
    }
    ctx.heroBillboard.setEnabled(true);
    ctx.heroShadow.setEnabled(true);
    ctx.audioManager.playHeroDeath();
    cfg.setHeroAnimState("death", PLAYER_DEATH_SEQUENCE_MS);

    if (ctx.playerDeathTimeoutId !== null) {
      window.clearTimeout(ctx.playerDeathTimeoutId);
    }
    ctx.playerDeathTimeoutId = window.setTimeout(() => {
      void completePlayerRespawn();
    }, PLAYER_DEATH_SEQUENCE_MS);
  };

  return {
    findVoidFallLanding,
    finishAirborneLanding,
    resolveRespawnSpawn,
    triggerPlayerDeathSequence,
  };
}

export type PlayerFallSystem = ReturnType<typeof createPlayerFallSystem>;
