import Phaser from "phaser";
import Enemy from "./Enemy";
import Player from "./Player";
import GameScene from "../scenes/GameScene";

export default class Dragon extends Enemy {
  private lastFireTime: number = 0;
  // Fire cooldown: 2-4 seconds
  private fireCooldown: number = 3000; 

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "dragon");
  }

  protected handleChaseState(player: Player, distToPlayer: number): void {
    // 0. Super logic for melee if very close?
    // Actually, we want to try Fire Breath FIRST if within range [100, 300].
    // If < 100, Melee.
    // If > 300, Chase.
    
    // Check Give Up Logic (from super, somewhat duplicated but accessing private fields is hard if not protected.
    // I made them protected, so I can access `this.chaseRange` etc.)
    
    const effectiveChaseRange = this.isProvoked ? this.chaseRange * 1.5 : this.chaseRange;
    if (distToPlayer > effectiveChaseRange) {
        this.currentState = this.returnToSpawn ? "RETURN" : "IDLE";
        this.isProvoked = false;
        // this.currentPath = []; // Accessing private property 'currentPath' might fail if it's private in Enemy. ts
        // I didn't change currentPath visibility. Let's call super to handle state transition if far?
        // But super.handleChaseState does everything.
        // It's safer to duplicate the high-level logic or call super and INTERCEPT?
        // Impossible to intercept inside the function.
        // I'll rely on my knowledge that I can just reimplement the high logic.
        // But `currentPath` is private.
        // I need to make `currentPath` protected too?
        // Yes.
        super.handleChaseState(player, distToPlayer);
        return;
    }

    // Fire Breath Logic
    // If within 400px and ready
    const now = Date.now();
    if (distToPlayer < 400 && distToPlayer > 80 && now - this.lastFireTime > this.fireCooldown) {
        if (Math.random() < 0.05) { // 5% chance per frame? No, that's too high.
             // We should check cooldown.
             this.spitFire(player);
             // When spitting fire, we pause movement briefly?
             this.stopMovement();
             return;
        }
    }
    
    // If we just called super.handleChaseState above in "give up" block, we returned.
    // So here we are in chase range.
    
    // We call super logic for standard chase/melee
    super.handleChaseState(player, distToPlayer);
  }

  private spitFire(player: Player): void {
      this.lastFireTime = Date.now();
      
      const scene = this.sprite.scene as GameScene;

      // Visual Effect: Fireball
      // We don't have a fireball asset confirmed. Using a particle or just a red circle simple for now.
      // Or confirm if 'effects' folder has something.
      // Assuming 'fireball' texture doesn't exist, use a graphics object or a tinted projectile.
      
      const fireball = scene.physics.add.sprite(this.sprite.x, this.sprite.y, "items"); // Using items placeholder?
      // Actually let's create a Graphics texture on the fly if needed, or use a particle.
      // Better: Create a simple circle texture.
      
      if (!scene.textures.exists("fireball_texture")) {
          const graphics = scene.make.graphics({ x: 0, y: 0 });
          graphics.fillStyle(0xff4500, 1);
          graphics.fillCircle(10, 10, 10);
          graphics.generateTexture("fireball_texture", 20, 20);
      }
      
      fireball.setTexture("fireball_texture");
      
      // Angle calculated but not used; using physics.moveTo instead.
      scene.physics.moveTo(fireball, player.sprite.x, player.sprite.y, 400);
      
      // Cleanup fireball
      scene.time.delayedCall(1000, () => {
          fireball.destroy();
      });
      
      // Hit logic?
      // Proper projectile system involves collider.
      // For now, simple "homing" or just visual + instant damage if close?
      // Let's do a Collider.
      
      scene.physics.add.overlap(fireball, player.sprite, () => {
          fireball.destroy();
          // Deal damage
          // Dragon fire damage: ~50-80?
          const damage = Phaser.Math.Between(50, 100);
          player.takeDamage(damage);
          
          // Visual Text
           scene.events.emit("show_floating_text", {
              x: player.sprite.x,
              y: player.sprite.y - 20,
              text: `-${damage}`,
              color: "#ff0000"
           });
      });
  }
}
