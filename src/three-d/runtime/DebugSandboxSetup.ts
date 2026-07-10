import type { SliceMapData } from "./SliceTileTypes";

export function ensureDebugSandboxStarterLoadout(
  playerState: {
    getEnchantedRunes: () => Array<{ runeId: string; count: number }>;
    addEnchantedRune: (runeId: string, count: number, stars: number) => void;
    getEquippedRuneSlots: () => string[];
    setEquippedRuneSlot: (slot: number, runeId: string) => void;
    getInventory: () => Array<{ itemId: string; count?: number }>;
    addItem: (itemId: string, count: number) => boolean;
    emit: (event: string, data?: any) => void;
  },
  mapData: SliceMapData,
): void {
  if (!mapData.config?.debugSandbox) return;

  let grantedSomething = false;

  const fireBurstCharges =
    playerState.getEnchantedRunes().find((rune) => rune.runeId === "fire_burst_rune")?.count || 0;
  if (fireBurstCharges < 10) {
    playerState.addEnchantedRune("fire_burst_rune", 10 - fireBurstCharges, 2);
    grantedSomething = true;
  }

  const equippedRuneSlots = playerState.getEquippedRuneSlots();
  if (!equippedRuneSlots.includes("fire_burst_rune")) {
    playerState.setEquippedRuneSlot(0, "fire_burst_rune");
    grantedSomething = true;
  }

  const magicRuneCount = playerState
    .getInventory()
    .filter((item) => item.itemId === "magic_rune")
    .reduce((total, item) => total + (item.count || 0), 0);
  if (magicRuneCount < 5) {
    playerState.addItem("magic_rune", 5 - magicRuneCount);
    grantedSomething = true;
  }

  if (grantedSomething) {
    playerState.emit("uiNotification", {
      type: "info",
      message: "Debug sandbox: runas e cargas liberadas para teste.",
    });
  }
}
