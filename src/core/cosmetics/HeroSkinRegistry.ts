import { HeroSkinId, HeroSkinDefinition, HeroSkinUnlockRule } from "../types/gameTypes";
export type { HeroSkinId };

const SKINS: Record<HeroSkinId, HeroSkinDefinition> = {
  wojtek: {
    id: "wojtek",
    displayName: "Wojtek",
    bodyEntityId: "bear",
    unlock: { type: "character_name", names: ["wojtek"] },
  },
};

export function getHeroSkinDefinition(id: HeroSkinId): HeroSkinDefinition {
  return SKINS[id];
}

function normalizeCharacterName(name: string): string {
  return name.trim().toLowerCase();
}

function heroSkinMatchesCharacterName(
  skin: HeroSkinDefinition,
  characterName: string,
): boolean {
  if (skin.unlock.type !== "character_name") {
    return false;
  }
  const normalized = normalizeCharacterName(characterName);
  if (!normalized) {
    return false;
  }
  return skin.unlock.names.some(
    (candidate) => normalizeCharacterName(candidate) === normalized,
  );
}

export function heroSkinsUnlockedByName(characterName: string): HeroSkinId[] {
  return Object.values(SKINS)
    .filter((skin) => heroSkinMatchesCharacterName(skin, characterName))
    .map((skin) => skin.id);
}

export function isHeroSkinId(value: string): value is HeroSkinId {
  return value in SKINS;
}
