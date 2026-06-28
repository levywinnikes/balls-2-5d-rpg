import Phaser from "phaser";
import { PlayerState } from "../entities/Player/PlayerState";
import { resolveHeroBodyEntityId } from "../../three-d/runtime/CharacterVisualProfile";

type GameDirection = "down" | "left" | "right" | "up";
type BmsDirection = "south" | "north" | "east" | "west";
type AnimState = "idle" | "walk" | "attack" | "death";

const DIR_TO_BMS: Record<GameDirection, BmsDirection> = {
  down: "south",
  up: "north",
  left: "west",
  right: "east",
};

const BMS_TO_GAME: Record<BmsDirection, GameDirection> = {
  south: "down",
  north: "up",
  east: "right",
  west: "left",
};

const SOURCE_SIZE = 92;
const DISPLAY_SIZE = 64;

const BODY_ENTITY = "hero_base";
const DEFAULT_HAIR_ENTITY = "hair_classic";

function resolveBodyEntityId(): string {
  return resolveHeroBodyEntityId(PlayerState.getInstance());
}

function resolveHairEntityId(): string | null {
  const profile = PlayerState.getInstance().getActiveHeroSkinId();
  if (profile) {
    return null;
  }
  return PlayerState.getInstance().equippedHairId ?? DEFAULT_HAIR_ENTITY;
}

interface BodyAnimDef {
  state: AnimState;
  directions: BmsDirection[];
  frameCount: number;
}

const BODY_ANIMS: BodyAnimDef[] = [
  {
    state: "idle",
    directions: ["south", "north", "east", "west"],
    frameCount: 4,
  },
  {
    state: "walk",
    directions: ["south", "north", "east", "west"],
    frameCount: 4,
  },
  {
    state: "attack",
    directions: ["south", "north", "east", "west"],
    frameCount: 3,
  },
  { state: "death", directions: ["south"], frameCount: 9 },
];

export class HeroModularGraphic {
  static readonly TEXTURE_KEY = "hero-modular";
  static readonly ENABLED = true;

  private static readonly DIRECTIONS = ["down", "left", "right", "up"] as const;
  private static readonly STATE_FRAMES = {
    idle: 4,
    walk: 4,
    attack: 3,
    death: 9,
  } as const;

  private static texturesBuilt = false;

  private static bodyKey(
    state: AnimState,
    direction: BmsDirection,
    frameIndex: number,
  ): string {
    return `hero-body-${state}-${direction}-${frameIndex}`;
  }

  private static hairKey(direction: BmsDirection): string {
    return `hero-hair-${direction}`;
  }

  private static compositeKey(
    state: AnimState,
    direction: GameDirection,
    frameIndex: number,
  ): string {
    return `${this.TEXTURE_KEY}-${state}-${direction}-${frameIndex}`;
  }

  static preload(
    scene: Phaser.Scene,
    hairEntityId: string | null = resolveHairEntityId(),
  ): void {
    const bodyEntityId = resolveBodyEntityId();
    for (const anim of BODY_ANIMS) {
      for (const direction of anim.directions) {
        for (let frameIndex = 0; frameIndex < anim.frameCount; frameIndex += 1) {
          const url = `/assets/sprites/generated/${bodyEntityId}/${anim.state}_${direction}/frame_${String(frameIndex).padStart(2, "0")}.png`;
          scene.load.image(
            this.bodyKey(anim.state, direction, frameIndex),
            url,
          );
        }
      }
    }

    (["south", "north", "east", "west"] as BmsDirection[]).forEach(
      (direction) => {
        if (!hairEntityId) {
          return;
        }
        scene.load.image(
          this.hairKey(direction),
          `/assets/sprites/generated/${hairEntityId}/character_rotations/${direction}.png`,
        );
      },
    );
  }

  private static ensureCompositeTextures(
    scene: Phaser.Scene,
    hairEntityId: string | null,
  ): boolean {
    if (this.texturesBuilt) {
      return true;
    }

    const canvas = document.createElement("canvas");
    canvas.width = SOURCE_SIZE;
    canvas.height = SOURCE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return false;
    }

    const hasHair =
      !!hairEntityId &&
      (["south", "north", "east", "west"] as BmsDirection[]).every((dir) =>
        scene.textures.exists(this.hairKey(dir)),
      );

    for (const anim of BODY_ANIMS) {
      for (const bmsDirection of anim.directions) {
        const gameDirection = BMS_TO_GAME[bmsDirection];
        for (let frameIndex = 0; frameIndex < anim.frameCount; frameIndex += 1) {
          const bodyTextureKey = this.bodyKey(
            anim.state,
            bmsDirection,
            frameIndex,
          );
          if (!scene.textures.exists(bodyTextureKey)) {
            console.warn(
              `[HeroModularGraphic] Missing body texture ${bodyTextureKey}`,
            );
            return false;
          }

          const compositeKey = this.compositeKey(
            anim.state,
            gameDirection,
            frameIndex,
          );
          if (scene.textures.exists(compositeKey)) {
            continue;
          }

          ctx.clearRect(0, 0, SOURCE_SIZE, SOURCE_SIZE);
          const bodySource = scene.textures
            .get(bodyTextureKey)
            .getSourceImage() as CanvasImageSource;
          ctx.drawImage(bodySource, 0, 0, SOURCE_SIZE, SOURCE_SIZE);

          if (hasHair) {
            const hairTextureKey = this.hairKey(bmsDirection);
            const hairSource = scene.textures
              .get(hairTextureKey)
              .getSourceImage() as CanvasImageSource;
            ctx.drawImage(hairSource, 0, 0, SOURCE_SIZE, SOURCE_SIZE);
          }

          scene.textures.addCanvas(compositeKey, canvas);
        }
      }
    }

    this.texturesBuilt = true;
    return true;
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hairEntityId: string | null = DEFAULT_HAIR_ENTITY,
  ): Phaser.Physics.Arcade.Sprite {
    if (!this.ENABLED) {
      const { PlayerGraphic } = require("./PlayerGraphic");
      return PlayerGraphic.create(scene, x, y);
    }

    if (!this.ensureCompositeTextures(scene, hairEntityId)) {
      console.warn(
        "[HeroModularGraphic] Falling back to procedural PlayerGraphic.",
      );
      const { PlayerGraphic } = require("./PlayerGraphic");
      return PlayerGraphic.create(scene, x, y);
    }

    const firstKey = this.compositeKey("idle", "down", 0);
    const sprite = scene.physics.add.sprite(x, y, firstKey);
    const scale = DISPLAY_SIZE / SOURCE_SIZE;
    sprite.setScale(scale);
    sprite.setSize(30, 30);
    sprite.setOffset(17, 22);
    sprite.setDepth(2);
    sprite.setOrigin(0.5, 0.5);

    this.createAnimations(scene);
    return sprite;
  }

  private static createAnimations(scene: Phaser.Scene): void {
    const states = Object.keys(this.STATE_FRAMES) as AnimState[];

    this.DIRECTIONS.forEach((direction) => {
      states.forEach((state) => {
        const animKey = `player-${state}-${direction}`;
        if (scene.anims.exists(animKey)) {
          return;
        }

        const frameCount = this.STATE_FRAMES[state];
        const frames = Array.from({ length: frameCount }, (_, index) => ({
          key: this.compositeKey(state, direction, index),
        }));

        scene.anims.create({
          key: animKey,
          frames,
          frameRate:
            state === "idle"
              ? 6
              : state === "walk"
                ? 10
                : state === "attack"
                  ? 14
                  : 12,
          repeat: state === "death" || state === "attack" ? 0 : -1,
        });
      });
    });

    const legacyStates: Array<{ key: string; state: AnimState }> = [
      { key: "player-idle", state: "idle" },
      { key: "player-walk", state: "walk" },
      { key: "player-attack", state: "attack" },
      { key: "player-death", state: "death" },
    ];

    legacyStates.forEach(({ key, state }) => {
      if (scene.anims.exists(key)) {
        return;
      }
      scene.anims.create({
        key,
        frames: Array.from(
          { length: this.STATE_FRAMES[state] },
          (_, index) => ({
            key: this.compositeKey(state, "down", index),
          }),
        ),
        frameRate:
          state === "idle"
            ? 6
            : state === "walk"
              ? 10
              : state === "attack"
                ? 14
                : 12,
        repeat: state === "death" || state === "attack" ? 0 : -1,
      });
    });
  }

  static mapDirectionToBms(direction: GameDirection): BmsDirection {
    return DIR_TO_BMS[direction];
  }
}
