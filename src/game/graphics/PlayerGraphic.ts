import Phaser from "phaser";

export class PlayerGraphic {
  static readonly TEXTURE_KEY = "player-happy-ball";
  private static readonly SIZE = { width: 32, height: 32 };
  private static readonly DIRECTIONS = ["down", "left", "right", "up"] as const;
  private static readonly STATE_FRAMES = {
    idle: 4,
    walk: 6,
    attack: 6,
    death: 8,
  } as const;

  private static frameKey(
    state: keyof typeof PlayerGraphic.STATE_FRAMES,
    direction: (typeof PlayerGraphic.DIRECTIONS)[number],
    frameIndex: number,
  ): string {
    return `${this.TEXTURE_KEY}-${state}-${direction}-${frameIndex}`;
  }

  static preload(scene: Phaser.Scene): void {
    this.createTexture(scene);
  }

  private static createTexture(scene: Phaser.Scene): void {
    if (!scene.textures.exists(this.TEXTURE_KEY)) {
      const base = scene.add.graphics();
      this.drawFrame(base, "idle", "down", 0);
      base.generateTexture(this.TEXTURE_KEY, this.SIZE.width, this.SIZE.height);
      base.destroy();
    }

    this.DIRECTIONS.forEach((direction) => {
      (
        Object.keys(this.STATE_FRAMES) as Array<
          keyof typeof PlayerGraphic.STATE_FRAMES
        >
      ).forEach((state) => {
        const frameCount = this.STATE_FRAMES[state];
        for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
          const key = this.frameKey(state, direction, frameIndex);
          if (scene.textures.exists(key)) {
            continue;
          }

          const g = scene.add.graphics();
          this.drawFrame(g, state, direction, frameIndex);
          g.generateTexture(key, this.SIZE.width, this.SIZE.height);
          g.destroy();
        }
      });
    });
  }

  private static drawFrame(
    graphics: Phaser.GameObjects.Graphics,
    state: keyof typeof PlayerGraphic.STATE_FRAMES,
    direction: (typeof PlayerGraphic.DIRECTIONS)[number],
    frameIndex: number,
  ): void {
    const cx = 16;
    const baseCy = 17;

    const walkPhase = (frameIndex / this.STATE_FRAMES.walk) * Math.PI * 2;
    const attackPhase =
      (frameIndex / Math.max(1, this.STATE_FRAMES.attack - 1)) * Math.PI;
    const deathPhase = frameIndex / Math.max(1, this.STATE_FRAMES.death - 1);

    const bob =
      state === "walk"
        ? Math.sin(walkPhase) * 1.5
        : state === "idle"
          ? Math.sin((frameIndex / this.STATE_FRAMES.idle) * Math.PI * 2) * 0.7
          : 0;

    const squash = state === "walk" ? Math.sin(walkPhase) * 0.9 : 0;
    const bodyW = Math.max(9, 10 + squash);
    const bodyH = Math.max(11, 13 - squash * 0.45);

    const armSwing = state === "walk" ? Math.sin(walkPhase) * 4 : 0;
    const attackReach = state === "attack" ? Math.sin(attackPhase) * 8 : 0;
    const deathTilt = state === "death" ? deathPhase * 80 : 0;
    const fade = state === "death" ? Math.max(0.25, 1 - deathPhase * 0.75) : 1;

    const cy = baseCy + bob;

    graphics.clear();

    // Shadow
    graphics.fillStyle(0x000000, 0.18 * fade);
    graphics.fillEllipse(cx, 27, 14 - Math.abs(squash), 6);

    // Body
    graphics.fillStyle(0x4caf50, fade);
    graphics.fillEllipse(cx, cy, bodyW * 2, bodyH * 2);

    // Head
    graphics.fillStyle(0x81c784, fade);
    graphics.fillCircle(cx, cy - 9, 5);

    // Small face cue to indicate direction.
    graphics.fillStyle(0x1b1b1b, 0.85 * fade);
    if (direction === "down") {
      graphics.fillCircle(cx - 2, cy - 10, 0.9);
      graphics.fillCircle(cx + 2, cy - 10, 0.9);
    } else if (direction === "left") {
      graphics.fillCircle(cx - 3, cy - 10, 0.9);
    } else if (direction === "right") {
      graphics.fillCircle(cx + 3, cy - 10, 0.9);
    }

    // Arms
    const armY = cy - 2;
    graphics.lineStyle(2, 0x2e7d32, 0.95 * fade);
    const leftArmX = cx - 7;
    const rightArmX = cx + 7;
    const leftHandX =
      direction === "left"
        ? leftArmX - 3 - attackReach
        : leftArmX - 2 + armSwing * 0.6;
    const rightHandX =
      direction === "right"
        ? rightArmX + 3 + attackReach
        : rightArmX + 2 - armSwing * 0.6;
    const handY = armY + 4;
    graphics.lineBetween(leftArmX, armY, leftHandX, handY);
    graphics.lineBetween(rightArmX, armY, rightHandX, handY);

    // Legs
    graphics.lineStyle(2, 0x1b5e20, 0.95 * fade);
    const leftLegSwing = state === "walk" ? Math.sin(walkPhase) * 2.5 : 0;
    const rightLegSwing = state === "walk" ? -Math.sin(walkPhase) * 2.5 : 0;
    graphics.lineBetween(cx - 3, cy + 7, cx - 4 + leftLegSwing, cy + 12);
    graphics.lineBetween(cx + 3, cy + 7, cx + 4 + rightLegSwing, cy + 12);

    // Attack effect stroke
    if (state === "attack") {
      const slashX =
        direction === "left" ? cx - 12 : direction === "right" ? cx + 12 : cx;
      const slashY = direction === "up" ? cy - 12 : cy - 2;
      graphics.lineStyle(2, 0xffd54f, 0.85 * Math.sin(attackPhase));
      graphics.lineBetween(slashX - 3, slashY - 3, slashX + 3, slashY + 3);
    }

    // Death tilt cue
    if (state === "death") {
      graphics.lineStyle(2, 0xffffff, 0.2 * (1 - deathPhase));
      graphics.lineBetween(cx - 6, cy - 6, cx + 6 - deathTilt * 0.05, cy + 6);
    }
  }

  static create(
    scene: Phaser.Scene,
    x: number,
    y: number,
  ): Phaser.Physics.Arcade.Sprite {
    this.createTexture(scene);

    const sprite = scene.physics.add.sprite(x, y, this.TEXTURE_KEY);

    // Physical body for 32x32 world
    sprite.setSize(24, 24);
    sprite.setOffset(4, 4);
    sprite.setDepth(2);

    this.createAnimations(scene);

    return sprite;
  }

  private static createAnimations(scene: Phaser.Scene): void {
    const states = Object.keys(this.STATE_FRAMES) as Array<
      keyof typeof PlayerGraphic.STATE_FRAMES
    >;

    this.DIRECTIONS.forEach((direction) => {
      states.forEach((state) => {
        const key = `player-${state}-${direction}`;
        if (scene.anims.exists(key)) {
          return;
        }

        const frameCount = this.STATE_FRAMES[state];
        const frames = Array.from({ length: frameCount }, (_, index) => ({
          key: this.frameKey(state, direction, index),
        }));

        scene.anims.create({
          key,
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

    if (!scene.anims.exists("player-idle")) {
      scene.anims.create({
        key: "player-idle",
        frames: Array.from({ length: this.STATE_FRAMES.idle }, (_, index) => ({
          key: this.frameKey("idle", "down", index),
        })),
        frameRate: 6,
        repeat: -1,
      });
    }

    if (!scene.anims.exists("player-walk")) {
      scene.anims.create({
        key: "player-walk",
        frames: Array.from({ length: this.STATE_FRAMES.walk }, (_, index) => ({
          key: this.frameKey("walk", "down", index),
        })),
        frameRate: 10,
        repeat: -1,
      });
    }

    if (!scene.anims.exists("player-attack")) {
      scene.anims.create({
        key: "player-attack",
        frames: Array.from(
          { length: this.STATE_FRAMES.attack },
          (_, index) => ({
            key: this.frameKey("attack", "down", index),
          }),
        ),
        frameRate: 14,
        repeat: 0,
      });
    }

    if (!scene.anims.exists("player-death")) {
      scene.anims.create({
        key: "player-death",
        frames: Array.from({ length: this.STATE_FRAMES.death }, (_, index) => ({
          key: this.frameKey("death", "down", index),
        })),
        frameRate: 12,
        repeat: 0,
      });
    }
  }
}
