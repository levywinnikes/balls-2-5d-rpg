import type { PlayerState } from "../../game/entities/Player/PlayerState";
import {
  getHeroSkinDefinition,
  isHeroSkinId,
  type HeroSkinId,
} from "../../game/cosmetics/HeroSkinRegistry";

/**
 * Visual profile = one complete animated body bundle (folder under generated/).
 * Alpha uses a single profile; equipment changes stats + item icons only.
 *
 * @see docs/CHARACTER_VISUAL_SCOPE.md
 */
export type VisualProfileId =
  | "hero_default"
  | "hero_wojtek"
  | "hero_one_hand"
  | "hero_one_hand_shield"
  | "hero_two_hand"
  | "hero_bow";

export type CharacterVisualProfile = {
  id: VisualProfileId;
  /** Folder name: public/assets/sprites/generated/{bodyEntityId}/ */
  bodyEntityId: string;
  /** Pixel-diff hair overlay; null when baked into body or hidden. */
  hairOverlayEntityId: string | null;
  weaponId: string | null;
  shieldId: string | null;
  /** Full-body cosmetic skin — never draw hair / weapon / shield overlays. */
  hideEquipmentOverlays?: boolean;
};

function profileFromHeroSkin(skinId: HeroSkinId): CharacterVisualProfile {
  const skin = getHeroSkinDefinition(skinId);
  return {
    id: skinId === "wojtek" ? "hero_wojtek" : "hero_default",
    bodyEntityId: skin.bodyEntityId,
    hairOverlayEntityId: null,
    weaponId: null,
    shieldId: null,
    hideEquipmentOverlays: true,
  };
}

const PROFILES: Record<VisualProfileId, Omit<CharacterVisualProfile, "weaponId" | "shieldId">> = {
  hero_default: {
    id: "hero_default",
    bodyEntityId: "hero_base",
    hairOverlayEntityId: "hair_classic",
  },
  hero_wojtek: {
    id: "hero_wojtek",
    bodyEntityId: "bear",
    hairOverlayEntityId: null,
  },
  // Phase 2 — generate full animation folders before enabling in resolveCharacterVisualProfile.
  hero_one_hand: {
    id: "hero_one_hand",
    bodyEntityId: "hero_one_hand",
    hairOverlayEntityId: null,
  },
  hero_one_hand_shield: {
    id: "hero_one_hand_shield",
    bodyEntityId: "hero_one_hand_shield",
    hairOverlayEntityId: null,
  },
  hero_two_hand: {
    id: "hero_two_hand",
    bodyEntityId: "hero_two_hand",
    hairOverlayEntityId: null,
  },
  hero_bow: {
    id: "hero_bow",
    bodyEntityId: "hero_bow",
    hairOverlayEntityId: null,
  },
};

export function getVisualProfile(id: VisualProfileId): CharacterVisualProfile {
  const base = PROFILES[id];
  return {
    ...base,
    weaponId: null,
    shieldId: null,
  };
}

/**
 * Maps equipped items → visual profile. Alpha: always hero_default (+ hair).
 * Body does not show helmet/armor; icons + stats handle equipment feedback.
 */
export function resolveCharacterVisualProfile(
  playerState: PlayerState,
): CharacterVisualProfile {
  const activeSkinId = playerState.getActiveHeroSkinId();
  if (activeSkinId && playerState.isHeroSkinUnlocked(activeSkinId)) {
    return profileFromHeroSkin(activeSkinId);
  }

  const base = PROFILES.hero_default;

  // Phase 2 weapon pose profiles — enable when asset folders exist:
  // const weapon = playerState.getEquippedWeapon();
  // if (weapon?.type === ItemType.DISTANCE) return PROFILES.hero_bow;
  // if ((weapon as any)?.twoHanded) return PROFILES.hero_two_hand;
  // if (weapon && playerState.getEquippedShield()) return PROFILES.hero_one_hand_shield;
  // if (weapon) return PROFILES.hero_one_hand;

  const hairId = playerState.equippedHairId ?? base.hairOverlayEntityId;

  return {
    id: base.id,
    bodyEntityId: base.bodyEntityId,
    hairOverlayEntityId: hairId,
    weaponId: playerState.equippedWeaponId,
    shieldId: playerState.equippedShieldId,
    hideEquipmentOverlays: false,
  };
}

export function resolveHeroBodyEntityId(playerState: PlayerState): string {
  return resolveCharacterVisualProfile(playerState).bodyEntityId;
}

export function normalizeVisualProfile(
  input: CharacterVisualProfile | string | null,
): CharacterVisualProfile {
  if (typeof input === "string" || input === null) {
    return {
      id: "hero_default",
      bodyEntityId: "hero_base",
      hairOverlayEntityId: input,
      weaponId: null,
      shieldId: null,
    };
  }
  return input;
}

export function visualProfilesEqual(
  a: CharacterVisualProfile,
  b: CharacterVisualProfile,
): boolean {
  return (
    a.id === b.id &&
    a.bodyEntityId === b.bodyEntityId &&
    a.hairOverlayEntityId === b.hairOverlayEntityId &&
    a.weaponId === b.weaponId &&
    a.shieldId === b.shieldId &&
    !!a.hideEquipmentOverlays === !!b.hideEquipmentOverlays
  );
}

export { isHeroSkinId };
