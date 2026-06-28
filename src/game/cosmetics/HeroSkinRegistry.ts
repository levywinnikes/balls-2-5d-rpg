/**
 * Hero cosmetic skins — full-body sprite swap (no hair / weapon / shield overlays).
 * Unlock rules are data-driven; runtime resolves via PlayerState + CharacterVisualProfile.
 */
export type HeroSkinId = "wojtek";

export type HeroSkinUnlockRule =
  | { type: "character_name"; names: string[] }
  | { type: "always" };

export type HeroSkinDefinition = {
  id: HeroSkinId;
  displayName: string;
  /** Folder under public/assets/sprites/generated/{bodyEntityId}/ */
  bodyEntityId: string;
  unlock: HeroSkinUnlockRule;
};

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

export function listHeroSkinDefinitions(): HeroSkinDefinition[] {
  return Object.values(SKINS);
}

export function normalizeCharacterName(name: string): string {
  return name.trim().toLowerCase();
}

export function heroSkinMatchesCharacterName(
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

/** Skins unlocked by the current character name (does not include manual unlocks). */
export function heroSkinsUnlockedByName(characterName: string): HeroSkinId[] {
  return listHeroSkinDefinitions()
    .filter((skin) => heroSkinMatchesCharacterName(skin, characterName))
    .map((skin) => skin.id);
}

export function isHeroSkinId(value: string): value is HeroSkinId {
  return Object.prototype.hasOwnProperty.call(SKINS, value);
}
