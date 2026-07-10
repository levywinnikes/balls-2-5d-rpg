import { t_game } from "../../game/i18n/translations";
import type { GameContext } from "./GameContext";

export interface RuneCastConfig {
  ctx: GameContext;
}

export interface RuneCastSystem {
  dispatchRuneSlotUpdate: () => void;
  handleRuneTargetClick: (pointerX: number, pointerY: number) => boolean;
}

export function createRuneCastSystem(cfg: RuneCastConfig): RuneCastSystem {
  const { ctx } = cfg;

  ctx.playerState.on("prepareRuneCast", (runeId: string) => {
    ctx.runeTargetingMode = true;
    ctx.targetingRuneId = runeId;
    ctx.playerState.emit("uiNotification", {
      type: "info",
      message: t_game("msg_select_target"),
    });
  });

  ctx.playerState.on("cancelRuneCast", () => {
    ctx.runeTargetingMode = false;
    ctx.targetingRuneId = null;
  });

  const dispatchRuneSlotUpdate = () => {
    const slots = ctx.playerState.getEquippedRuneSlots();
    document.dispatchEvent(
      new CustomEvent("slice3d:runeSlotChanged", {
        detail: { slots, activeIndex: ctx.activeRuneSlotIndex },
      }),
    );
  };

  const handleRuneTargetClick = (pointerX: number, pointerY: number): boolean => {
    if (!ctx.runeTargetingMode || !ctx.targetingRuneId) return false;
    const enemyUid = ctx.pointerPickingSystem.resolveEnemyUidFromPointer(pointerX, pointerY);
    if (enemyUid) {
      const targetEnemy = ctx.enemies.get(enemyUid);
      if (targetEnemy && !targetEnemy.isDead) {
        ctx.sliceCombatSystem.castRuneAtTarget(targetEnemy.uid);
        return true;
      }
    }
    ctx.playerState.emit("message", t_game("msg_target_obstructed"));
    return true;
  };

  return { dispatchRuneSlotUpdate, handleRuneTargetClick };
}
