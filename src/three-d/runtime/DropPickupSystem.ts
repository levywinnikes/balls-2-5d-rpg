import { Vector3 } from "@babylonjs/core";
import type { GameContext } from "./GameContext";
import type { DroppedItemData } from "../../game/entities/Player/PlayerState";
import type { SliceDroppedItem } from "./DropStreamSystem";
import { WeaponRegistry } from "../../core/registries/WeaponRegistry";
import { ContainerRegistry } from "../../core/registries/ContainerRegistry";
import { t_game } from "../../game/i18n/translations";

export interface DropPickupConfig {
  ctx: GameContext;
}

export interface DropPickupSystem {
  addDroppedItemFromEvent: (data: {
    itemId?: string;
    weaponId?: string;
    count?: number;
    x?: number;
    y?: number;
    stars?: number;
    attributes?: any[];
  }) => void;
  handleDropItem: (itemId: string, count?: number, worldX?: number, worldY?: number) => void;
  handleRequestPickup: (payload: { uid: string; count?: number }) => void;
  tryPickupPersistentItem: (item: DroppedItemData, requestedCount?: number) => boolean;
  tryPickupNearestItem: () => boolean;
}

export function createDropPickupSystem(cfg: DropPickupConfig): DropPickupSystem {
  const { ctx } = cfg;

  const addDroppedItemFromEvent = (data: {
    itemId?: string;
    weaponId?: string;
    count?: number;
    x?: number;
    y?: number;
    stars?: number;
    attributes?: any[];
  }) => {
    const weaponId = data.weaponId || data.itemId;
    if (!weaponId) return;

    const fallbackX = ctx.player.position.x * 32;
    const fallbackY = ctx.player.position.z * 32;
    const uid = data.itemId || ctx.playerState.generateUID();

    ctx.playerState.addPersistentDroppedItem(ctx.getCurrentLevel(), {
      itemId: uid,
      weaponId,
      x: data.x ?? fallbackX,
      y: data.y ?? fallbackY,
      createdAt: Date.now(),
      count: data.count || 1,
      stars: data.stars || 0,
      attributes: [...(data.attributes || [])],
    });
  };

  const handleDropItem = (
    itemId: string,
    count?: number,
    worldX?: number,
    worldY?: number,
  ) => {
    let inventoryItem = ctx.playerState.getInventoryItem(itemId);

    if (!inventoryItem) {
      inventoryItem = ctx.playerState
        .getInventory()
        .find((entry: any) => entry.itemId === itemId);
    }

    if (!inventoryItem) return;

    const availableCount = inventoryItem.count;
    const dropCount = Math.max(
      1,
      Math.min(count || availableCount, availableCount),
    );
    const droppingAll = dropCount >= availableCount;

    if (droppingAll) {
      ctx.playerState.removeInventoryItem(inventoryItem.uid);
    } else {
      inventoryItem.count = availableCount - dropCount;
      ctx.playerState.emit("inventoryUpdated");
    }

    const dropUid = droppingAll ? inventoryItem.uid : ctx.playerState.generateUID();

    addDroppedItemFromEvent({
      itemId: dropUid,
      weaponId: inventoryItem.itemId,
      count: dropCount,
      x: worldX,
      y: worldY,
      stars: inventoryItem.stars,
      attributes: inventoryItem.attributes,
    });
  };

  const handleRequestPickup = (payload: { uid: string; count?: number }) => {
    const persistent = ctx.playerState.getPersistentDroppedItems(ctx.getCurrentLevel());
    const item = persistent.find((entry: any) => entry.itemId === payload.uid);
    if (!item) return;
    tryPickupPersistentItem(item, payload.count);
  };

  const tryPickupPersistentItem = (
    item: DroppedItemData,
    requestedCount?: number,
  ): boolean => {
    const potentialContainerDef = WeaponRegistry.getWeaponDefinition(item.weaponId);
    if (
      potentialContainerDef &&
      (potentialContainerDef.type === "container" ||
        ContainerRegistry.getContainer(potentialContainerDef.id))
    ) {
      const containerDef = ContainerRegistry.getContainer(potentialContainerDef.id);
      if (containerDef) {
        ctx.playerState.openContainer(
          item.itemId,
          containerDef.id,
          t_game(containerDef.name as Parameters<typeof t_game>[0]),
          { x: item.x, y: item.y, level: ctx.getCurrentLevel() },
        );
        return true;
      }
    }

    const availableCount = item.count || 1;
    const pickupCount = Math.max(1, Math.min(requestedCount || availableCount, availableCount));
    const added = ctx.playerState.addItem(
      item.weaponId,
      pickupCount,
      item.itemId,
      item.stars || 0,
      [...(item.attributes || [])],
    );

    if (!added) return false;

    if (availableCount > pickupCount) {
      const persistent = ctx.playerState.getPersistentDroppedItems(ctx.getCurrentLevel());
      const target = persistent.find((entry: any) => entry.itemId === item.itemId);
      if (target) target.count = availableCount - pickupCount;
    } else {
      ctx.playerState.removePersistentDroppedItem(ctx.getCurrentLevel(), item.itemId);
    }

    const def = WeaponRegistry.getWeaponDefinition(item.weaponId);
    const itemName = def ? t_game(`item_${def.id}` as Parameters<typeof t_game>[0]) : item.weaponId;
    ctx.playerState.emit("uiNotification", {
      type: "pickup",
      message: t_game("notif_item_get")
        .replace("{amount}", pickupCount.toString())
        .replace("{item}", itemName),
    });
    ctx.audioManager.playPickup();
    ctx.playerState.log("action_pickup");
    return true;
  };

  const tryPickupNearestItem = (): boolean => {
    const pickupRange = ctx.playerState.pickupRange / 32;
    let nearestItem: DroppedItemData | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    ctx.dropSystem.droppedItemMeshes.forEach((mesh: any) => {
      if (!mesh.isEnabled()) return;
      const item = mesh.metadata as SliceDroppedItem | undefined;
      if (!item) return;
      const distance = Vector3.Distance(ctx.player.position, mesh.position);
      if (distance <= pickupRange && distance < nearestDistance) {
        nearestItem = item;
        nearestDistance = distance;
      }
    });

    if (nearestItem) return tryPickupPersistentItem(nearestItem);
    return false;
  };

  return { addDroppedItemFromEvent, handleDropItem, handleRequestPickup, tryPickupPersistentItem, tryPickupNearestItem };
}
