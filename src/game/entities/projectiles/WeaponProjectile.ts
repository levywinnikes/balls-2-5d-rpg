import Phaser from "phaser";
import Enemy from "../Enemy";
import GameScene from "../../scenes/GameScene";
import { ArrowProjectileGraphic } from "../../graphics/projectiles/ArrowProjectileGraphic";

export type WeaponProjectileVisual = "arrow" | "throwing_star";

export class WeaponProjectile extends Phaser.Physics.Arcade.Sprite {
  private spawnX: number;
  private spawnY: number;
  private speed: number;
  private maxRange: number;
  private hitRadius: number;
  private visual: WeaponProjectileVisual;
  private onImpact: (enemy: Enemy | null) => void;
  private hasImpacted = false;
  private spawnedAt = 0;
  private maxLifespan = 3500;
  private spin = 0;
  private usesArrowSprite = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    visual: WeaponProjectileVisual,
    speed: number,
    maxRange: number,
    onImpact: (enemy: Enemy | null) => void,
  ) {
    const arrowFrameKey =
      visual === "arrow"
        ? ArrowProjectileGraphic.getFirstFrameKey(speed)
        : null;
    const hasArrowTexture =
      Boolean(arrowFrameKey) && scene.textures.exists(arrowFrameKey!);

    super(scene, x, y, hasArrowTexture ? arrowFrameKey! : "__DEFAULT");
    this.spawnX = x;
    this.spawnY = y;
    this.speed = speed;
    this.maxRange = maxRange;
    this.hitRadius = visual === "throwing_star" ? 18 : 14;
    this.visual = visual;
    this.onImpact = onImpact;
    this.spawnedAt = Date.now();
    this.usesArrowSprite = hasArrowTexture;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(10);
    this.setOrigin(0.5, 0.5);

    if (this.usesArrowSprite) {
      ArrowProjectileGraphic.ensureAnimations(scene);
      this.setDisplaySize(32, 32);
      const animKey = ArrowProjectileGraphic.getAnimationKey(speed);
      if (scene.anims.exists(animKey)) {
        this.play(animKey);
      }
    } else {
      this.drawProceduralVisual();
    }

    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
    this.rotation = angle;
    scene.physics.velocityFromRotation(angle, speed, this.body!.velocity);
  }

  private drawProceduralVisual(): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    if (this.visual === "throwing_star") {
      g.fillStyle(0xffd700, 1);
      g.fillPoints(
        [
          { x: 0, y: -8 },
          { x: 8, y: 0 },
          { x: 0, y: 8 },
          { x: -8, y: 0 },
        ],
        true,
      );
    } else {
      g.fillStyle(0x8b4513, 1);
      g.fillRect(-10, -2, 20, 4);
      g.fillStyle(0xcccccc, 1);
      g.fillTriangle(10, -3, 10, 3, 14, 0);
    }
    g.generateTexture(`weapon_proj_${this.visual}_${this.spawnedAt}`, 32, 32);
    g.destroy();
    this.setTexture(`weapon_proj_${this.visual}_${this.spawnedAt}`);
    this.setDisplaySize(this.visual === "throwing_star" ? 16 : 22, 8);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.hasImpacted) {
      return;
    }

    if (Date.now() - this.spawnedAt > this.maxLifespan) {
      this.destroy();
      return;
    }

    const traveled = Phaser.Math.Distance.Between(
      this.spawnX,
      this.spawnY,
      this.x,
      this.y,
    );
    if (traveled >= this.maxRange) {
      this.handleImpact(null);
      return;
    }

    const gameScene = this.scene as GameScene;
    const level = gameScene.registry.get("currentLevel") || "0";
    if (
      !gameScene.mapLoader.checkLineOfSight(
        this.spawnX,
        this.spawnY,
        this.x,
        this.y,
        level,
      )
    ) {
      this.handleImpact(null);
      return;
    }

    const flightAngle = this.body!.velocity.angle();
    if (this.visual === "throwing_star") {
      this.spin += delta * 0.02;
      this.rotation = flightAngle + this.spin;
    } else if (this.usesArrowSprite) {
      this.rotation = flightAngle;
    }
  }

  public tryHitEnemy(enemy: Enemy): boolean {
    if (this.hasImpacted || enemy.isDefeated()) {
      return false;
    }
    const dist = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      enemy.sprite.x,
      enemy.sprite.y,
    );
    if (dist <= this.hitRadius) {
      this.handleImpact(enemy);
      return true;
    }
    return false;
  }

  private handleImpact(enemy: Enemy | null): void {
    if (this.hasImpacted) {
      return;
    }
    this.hasImpacted = true;
    this.body?.stop();
    this.onImpact(enemy);
    this.destroy();
  }
}

export function resolveWeaponProjectileVisual(
  weaponId: string,
): WeaponProjectileVisual {
  return weaponId === "throwing_star" ? "throwing_star" : "arrow";
}
