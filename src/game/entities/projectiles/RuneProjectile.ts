import Phaser from "phaser";
import Enemy from "../Enemy";

export type ProjectileType = "homing" | "linear";

export class RuneProjectile extends Phaser.Physics.Arcade.Sprite {
    private target: Enemy | null = null;
    private targetPos: Phaser.Math.Vector2 | null = null;
    private pType: ProjectileType = "linear";
    private speed: number = 1600;
    private onImpact: ((target: Enemy | null) => void) | null = null;
    private spawnedAt: number = 0;
    private maxLifespan: number = 3000; // 3 seconds safety limit
    private hasImpacted: boolean = false;
    private rotOffset: number = 0;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        texture: string,
        target: Enemy | null,
        targetPos: { x: number, y: number } | null,
        type: ProjectileType,
        onImpact: (target: Enemy | null) => void
    ) {
        let actualTexture = texture;
        const isAnim = scene.anims.exists(texture);
        
        if (isAnim) {
             const anim = scene.anims.get(texture);
             actualTexture = anim.frames[0].textureKey;
        } else if (!scene.textures.exists(actualTexture)) {
             actualTexture = scene.textures.exists("flare") ? "flare" : "__DEFAULT"; 
        }

        super(scene, x, y, actualTexture);
        this.target = target;
        if (targetPos) {
            this.targetPos = new Phaser.Math.Vector2(targetPos.x, targetPos.y);
        }
        this.pType = type;
        this.onImpact = onImpact;
        this.spawnedAt = Date.now();
        
        // Define rotation offset based on texture/animation
        if (texture === "fire_burst_anim") {
            this.rotOffset = Math.PI / 2; // Fireball points NORTH natively
        }

        scene.add.existing(this);
        scene.physics.add.existing(this);

        if (isAnim) {
            this.play(texture);
        } else if (actualTexture === "flare" || actualTexture === "__DEFAULT") {
             this.setTint(0xFF4500); // Default fire color
        }

        // Visuals
        this.setScale(this.rotOffset !== 0 ? 0.2 : 0.8); // Adjust scale if needed for fireball
        this.setDepth(10); // Above ground, below UI
    }

    public launch() {
        const arcadeBody = this.body as Phaser.Physics.Arcade.Body;
        if (!arcadeBody) return;

        if (this.pType === "linear" && this.targetPos) {
            this.scene.physics.moveTo(this, this.targetPos.x, this.targetPos.y, this.speed);
            this.rotation = Phaser.Math.Angle.Between(this.x, this.y, this.targetPos.x, this.targetPos.y) + this.rotOffset;
        } else if (this.pType === "homing" && this.target?.sprite?.active) {
            // Set initial velocity towards target
            const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.sprite.x, this.target.sprite.y);
            this.rotation = angle + this.rotOffset;
            this.scene.physics.velocityFromRotation(angle, this.speed, arcadeBody.velocity);
        }
    }

    // CRITICAL: Phaser calls preUpdate on Sprites, NOT update.
    // Must override preUpdate for per-frame logic.
    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta); // Required for animations/physics

        if (this.hasImpacted) return;

        // Safety Kill
        if (Date.now() - this.spawnedAt > this.maxLifespan) {
            this.destroy();
            return;
        }

        const arcadeBody = this.body as Phaser.Physics.Arcade.Body;
        if (!arcadeBody) return;

        if (this.pType === "homing") {
            if (this.target && this.target.sprite && this.target.sprite.active) {
                // Recalculate velocity towards target every frame
                const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.sprite.x, this.target.sprite.y);
                this.rotation = angle + this.rotOffset;
                this.scene.physics.velocityFromRotation(angle, this.speed, arcadeBody.velocity);

                // Check proximity for direct hit
                const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.sprite.x, this.target.sprite.y);
                if (dist < 20) {
                    this.handleImpact(this.target);
                }
            } else {
                // Target lost/dead — self-destruct
                this.destroy();
                return;
            }
        } else if (this.pType === "linear") {
            // Check if reached destination
            if (this.targetPos && Phaser.Math.Distance.Between(this.x, this.y, this.targetPos.x, this.targetPos.y) < 16) {
                this.handleImpact(null); // Ground hit
            }
        }
    }

    public handleImpact(enemy: Enemy | null) {
        if (this.hasImpacted) return; // Prevent double-fire
        this.hasImpacted = true;

        if (this.onImpact) {
            this.onImpact(enemy);
            this.onImpact = null;
        }
        this.destroy();
    }
}
