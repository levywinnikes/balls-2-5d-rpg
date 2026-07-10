import type { GameContext } from "./GameContext";
import type { DroppedItemData } from "../../game/entities/Player/PlayerState";

export interface DropPickupConfig {
  ctx: GameContext;
  tryPickupPersistentItem: (item: DroppedItemData, count?: number) => void;
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
}

export function createDropPickupSystem(cfg: DropPickupConfig): DropPickupSystem {
  const { ctx, tryPickupPersistentItem } = cfg;

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
        .find((entry) => entry.itemId === itemId);
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
    const item = persistent.find((entry) => entry.itemId === payload.uid);
    if (!item) return;
    tryPickupPersistentItem(item, payload.count);
  };

  return { addDroppedItemFromEvent, handleDropItem, handleRequestPickup };
}
