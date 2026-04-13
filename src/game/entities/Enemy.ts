import Phaser from "phaser";
import { EnemyRegistry, LootItem } from "./EnemyRegistry";
import { EnemyMagicRegistry } from "./EnemyMagicRegistry";
import Player from "./Player";
import BattleSystem from "../systems/BattleSystem";
import GameScene from "../scenes/GameScene";
import { EnemyHud } from "../hud/EnemyHud";
import { PathfindingManager } from "../systems/PathfindingManager";
import { AudioManager } from "../systems/AudioManager";
import { MultiLevelMapData } from "../maps/MapTypes";

export default class Enemy {
  public sprite: Phaser.Physics.Arcade.Sprite;
  public health: number;
  private damage: number;
  public enemyType: string;
  private speed: number;
  public spawnPosition: { x: number; y: number };
  public currentState: "IDLE" | "CHASE" | "RETURN" = "IDLE";
  public aggroRange: number;
  public chaseRange: number;
  public returnToSpawn: boolean;
  public isProvoked: boolean = false;

  // Restored Properties
  private rangeVision: number = 0;
  public pursuitRange: number = 0;
  public stopDistance: number = 0;
  public attackRange: number = 0;
  private lastAttackTime: number = 0;
  private attackCooldown: number = 1000;
  public maxHealth: number = 0;
  private currentPath: { x: number; y: number }[] = [];
  private currentPathIndex: number = 0;
  private lastPathCalculation: number = 0;
  private pathUpdateCooldown: number = 1000;
  private isCalculatingPath: boolean = false;
  public hud: EnemyHud | null = null;
  private target: Phaser.Physics.Arcade.Sprite | null = null;
  public id: string = "";
  public level: string = "0";
  public respawnTime: number = 5000;
  private tileSize: number = 32;
  private defense: number = 0;
  public loot: LootItem[] = [];
  public magicAttacks: string[] = [];
  private magicCooldowns: Map<string, number> = new Map();
  private lastDirection: string = "down";

  private get battleSystem(): BattleSystem {
    return (this.sprite.scene as GameScene).battleSystem;
  }

  constructor(scene: Phaser.Scene, x: number, y: number, type: string, overrides?: any) {
    this.enemyType = type;
    const enemyDef = EnemyRegistry.createEnemy(scene, type, x, y, overrides);
    this.sprite = enemyDef.sprite;
    this.spawnPosition = { x, y };

    this.health = enemyDef.health;
    this.maxHealth = enemyDef.health;
    this.damage = enemyDef.damage;
    this.speed = enemyDef.speed;
    
    // AI Parameters
    this.aggroRange = enemyDef.aggroRange;
    this.chaseRange = enemyDef.chaseRange;
    this.returnToSpawn = enemyDef.returnToSpawn;
    
    // Legacy support or specific overrides
    this.rangeVision = enemyDef.rangeVision; // Kept for interface compat if needed
    this.pursuitRange = enemyDef.pursuitRange; // Deprecated but mapped to chaseRange usually
    
    this.stopDistance = enemyDef.stopDistance;
    this.attackRange = enemyDef.attackRange;
    this.attackCooldown = enemyDef.cooldown; 
    this.hud = new EnemyHud(scene, this);
    
    // --- PHYSICS REVERT ---
    // User wants "Secure Distance" (Player cannot push).
    // Reform: Use Pushable=false instead of Immovable so they collide with each other.
    this.sprite.setImmovable(false);
    (this.sprite.body as Phaser.Physics.Arcade.Body).pushable = false;
    
    // Mass/Drag irrelevant when immovable, but good to reset.
    this.sprite.setMass(1); 
    this.sprite.setDrag(0);
    // this.sprite.setScale(4); // REMOVED: Respect the scale set by the Graphic class
    
    this.loot = enemyDef.loot || []; 
    this.magicAttacks = enemyDef.magicAttacks || [];
  }

  // ... (methods) ...

  public update(player: Player): void {
    if (this.health <= 0 || !this.sprite || !this.sprite.active || !this.sprite.scene) return;

    const currentLevel = (this.sprite.scene as GameScene).registry.get("currentLevel");
    if (this.level !== currentLevel) {
      this.stopMovement();
      this.currentPath = [];
      this.isCalculatingPath = false; 
      return;
    }

    // Update Animation based on velocity/state
    this.updateAnimation();

    // HUD Update
    const oldX = this.sprite.x;
    const oldY = this.sprite.y;
    
    // Y-Sorting for correct depth perception
    this.sprite.setDepth(this.sprite.y);

    if (this.hud && (oldX !== this.sprite.x || oldY !== this.sprite.y)) {
      this.hud.updatePosition();
    }

    const distanceToPlayer = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      player.sprite.x,
      player.sprite.y
    );

    // OPTIMIZATION: Disable AI at long range
    if (distanceToPlayer > 2000) {
        if (this.sprite.body) this.sprite.setVelocity(0, 0);
        return;
    }

    // --- STATE MACHINE ---
    switch (this.currentState) {
        case "IDLE":
            this.handleIdleState(distanceToPlayer);
            break;
        case "CHASE":
            this.handleChaseState(player, distanceToPlayer);
            break;
        case "RETURN":
            this.handleReturnState();
            break;
    }

    // ANTI-STACKING (Soft Separation)
    // Apply AFTER movement logic to ensure it modifies the final velocity
    this.applySeparationForce();

    if (this.hud) {
      this.hud.updatePosition();
    }
  }

  private updateAnimation(): void {
      if (!this.sprite || !this.sprite.body) return;
      
      const velocity = this.sprite.body.velocity;
      const speed = velocity.length();

      // If playing an attack animation, don't interrupt with walk
      if (this.sprite.anims.isPlaying && this.sprite.anims.currentAnim?.key.includes("attack")) {
          // Check if attack is finished? Phaser usually handles 'play' by not restarting if same key.
          // But if we want attack to block walk animation, we wait.
          // However, we just used 'play' with ignoreIfPlaying?
          // For now, if moving, we usually validly walk.
          // Let's prioritize Movement if speed > 0, unless Attacking is strictly blocking?
          // Tibia style: you can glide while attacking.
          // But visually, it's better to show movement if moving.
          // If stopped (attacking), show attack.
          
          if (speed < 5) return; // If stopped and attacking, let it finish.
      }
      
      if (speed > 5) {
          if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
              this.lastDirection = velocity.x > 0 ? "right" : "left";
          } else {
              this.lastDirection = velocity.y > 0 ? "down" : "up";
          }
          
          const animKey = `${this.enemyType}-walk-${this.lastDirection}`;
          if (this.sprite.scene.anims.exists(animKey)) {
              this.sprite.play(animKey, true);
          }
      } else {
          // Idle
          this.stopAnimation();
      }
  }

  private stopAnimation(): void {
      const idleKey = `${this.enemyType}-idle-${this.lastDirection}`;
      const fallbackIdle = `${this.enemyType}-idle`;
      
      if (this.sprite.scene.anims.exists(idleKey)) {
          this.sprite.play(idleKey, true);
      } else if (this.sprite.scene.anims.exists(fallbackIdle)) {
          this.sprite.play(fallbackIdle, true);
      } else {
          this.sprite.stop();
      }
  }

  protected handleIdleState(distToPlayer: number): void {
      // 1. Check Provocation or Aggro Range
      if (this.isProvoked || distToPlayer <= this.aggroRange) {
          this.currentState = "CHASE";
          return;
      }
      
      // 2. Stop moving if idle
      this.stopMovement();
  }

  protected handleChaseState(player: Player, distToPlayer: number): void {
      // 1. Give Up Logic
      const effectiveChaseRange = this.isProvoked ? this.chaseRange * 1.5 : this.chaseRange;

      if (distToPlayer > effectiveChaseRange) {
          this.currentState = this.returnToSpawn ? "RETURN" : "IDLE";
          this.isProvoked = false; 
          this.currentPath = [];
          return;
      }

      // 2. Attack Logic
      if (distToPlayer <= this.attackRange) {
          this.stopMovement();
          if (this.canAttack(player)) {
              this.attack(player);
          }
          return;
      }

      // 3. Movement Logic (Smart Pathfinding)
      const now = Date.now();
      if (
        !this.isCalculatingPath &&
        (now - this.lastPathCalculation > this.pathUpdateCooldown || this.currentPath.length === 0)
      ) {
        this.calculatePathTo(player.sprite.x, player.sprite.y);
      }

      if (this.currentPath.length > 0) {
        this.followPath();
      } else {
        this.moveTowards(player.sprite.x, player.sprite.y); 
      }

      // 4. Magic Attack Logic
      this.tryMagicAttack(player, distToPlayer);
  }

  protected tryMagicAttack(player: Player, distToPlayer: number): void {
      if (!this.magicAttacks || this.magicAttacks.length === 0) return;

      const now = Date.now();
      const hpPercentage = this.health / this.maxHealth;

      for (const magicId of this.magicAttacks) {
          const magic = EnemyMagicRegistry.getMagic(magicId);
          if (!magic) continue;

          // Check Cooldown
          const lastUse = this.magicCooldowns.get(magicId) || 0;
          if (now - lastUse < magic.cooldown) continue;

          // Check HP Requirements
          if (magic.minHpPercentage !== undefined && hpPercentage < magic.minHpPercentage) continue;
          if (magic.maxHpPercentage !== undefined && hpPercentage > magic.maxHpPercentage) continue;

          // Check Range
          if (distToPlayer > magic.range) continue;

          // Check Chance (only if cooldown is ready)
          // We should probably check chance per tick? Or only once per cooldown cycle?
          // Checking per tick (60fps) with low chance is standard.
          if (Math.random() > magic.chance) continue;

          // Execute Magic
          this.executeMagic(magic, player);
          this.magicCooldowns.set(magicId, now);
          
          // Should we stop after one magic? Usually yes, to avoid burst.
          // But maybe some bosses can combo. For now, return after one.
          return;
      }
  }

  protected executeMagic(magic: any, target: Player): void { // using any for magic def temporarily (it is imported though)
       const scene = this.sprite.scene as GameScene;
       
       // Stop movement briefly
       this.stopMovement();
       
       // Visual Feedback (Text)
       scene.events.emit("show_floating_text", {
            x: this.sprite.x,
            y: this.sprite.y - 40,
            text: magic.name,
            color: "#FFA500" // Orange for special attacks
       });

       // Logic based on Type
       if (magic.type === 'projectile') {
           // TODO: Implement projectile logic
           console.log(`${this.enemyType} used projectile magic ${magic.name}`);
       } else {
           // Instant / Direct
           const damage = Phaser.Math.Between(magic.minDamage, magic.maxDamage);
           target.takeDamage(damage);
           
            scene.events.emit("show_floating_text", {
              x: target.sprite.x,
              y: target.sprite.y - 20,
              text: `-${damage}`,
              color: "#ff0000"
           });
       }
  }

  protected handleReturnState(): void {
      const distToSpawn = Phaser.Math.Distance.Between(
          this.sprite.x, this.sprite.y,
          this.spawnPosition.x, this.spawnPosition.y
      );

      if (distToSpawn < 10) { // Reached spawn
          this.currentState = "IDLE";
          this.stopMovement();
          return;
      }

      const now = Date.now();
      if (!this.isCalculatingPath && (now - this.lastPathCalculation > 2000 || this.currentPath.length === 0)) {
           this.calculatePathTo(this.spawnPosition.x, this.spawnPosition.y);
      }

      if (this.currentPath.length > 0) {
          this.followPath();
      } else {
          this.moveTowards(this.spawnPosition.x, this.spawnPosition.y);
      }
  }

  protected moveTowards(targetX: number, targetY: number): void {
      const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, targetX, targetY);
      const nextX = this.sprite.x + Math.cos(angle) * (this.speed * 0.016);
      const nextY = this.sprite.y + Math.sin(angle) * (this.speed * 0.016);
      
      if (this.isTileWalkable(nextX, nextY)) {
          const terrainMod = this.getTerrainSpeedMultiplier(this.sprite.x, this.sprite.y);
          this.sprite.setVelocity(
              Math.cos(angle) * this.speed * terrainMod,
              Math.sin(angle) * this.speed * terrainMod
          );
      } else {
          this.stopMovement(); 
      }
  }

  private filterPath(
    path: { x: number; y: number }[]
  ): { x: number; y: number }[] {
    const tileSize = 32;
    const minDistance = tileSize * 1.5;
    if (path.length <= 2) return path;
    const filtered = [path[0]];
    let lastPoint = path[0];
    for (let i = 1; i < path.length - 1; i++) {
        const distance = Phaser.Math.Distance.Between(
            lastPoint.x * 32, lastPoint.y * 32,
            path[i].x * 32, path[i].y * 32
        );
        if (distance >= minDistance) {
            filtered.push(path[i]);
            lastPoint = path[i];
        }
    }
    filtered.push(path[path.length - 1]);
    return filtered;
  }

  protected stopMovement(): void {
    if (this.sprite && this.sprite.body) {
      this.sprite.setVelocity(0, 0);
    }
    this.currentPath = []; // FIX: Always clear path when stopping to avoid stale movement
  }

  private pendingTarget: { x: number; y: number } | null = null;

  // Removed performPathCalculation - Worker handles it now

  protected async calculatePathTo(targetX: number, targetY: number): Promise<void> {
    // Prevent spam
    if (this.isCalculatingPath) return;

    const startX = Math.floor(this.sprite.x / 32);
    const startY = Math.floor(this.sprite.y / 32);
    const endX = Math.floor(targetX / 32);
    const endY = Math.floor(targetY / 32);

    if (startX === endX && startY === endY) return;

    this.isCalculatingPath = true;
    this.lastPathCalculation = Date.now();

    try {
      const path = await PathfindingManager.getInstance().requestPath(startX, startY, endX, endY);
      
      // Safety check: Enemy might be dead
      if (!this.sprite || !this.sprite.active) return;
      
      if (path && path.length > 0) {
        this.currentPath = this.filterPath(path);
        this.currentPathIndex = 0;
      } else {
        this.currentPath = [];
      }
    } catch (e) {
      console.error("Pathfinding error", e);
    } finally {
      this.isCalculatingPath = false;
    }
  }

  private isTileWalkable(x: number, y: number): boolean {
    const scene = this.sprite.scene as GameScene;
    const mapData = scene.cache.json.get(
      `${scene.registry.get("currentMap")}_data`
    ) as MultiLevelMapData;
    
    const tileX = Math.floor(x / this.tileSize);
    const tileY = Math.floor(y / this.tileSize);

    // Verificar limites do mapa usando metadados BMS
    if (
      tileY < 0 ||
      tileY >= mapData.height ||
      tileX < 0 ||
      tileX >= mapData.width
    ) {
      return false;
    }

    const tileSymbol = (scene as any).mapLoader.getTileAt(tileX, tileY, this.level);
    const tileDef = mapData.tileDefinitions[tileSymbol || ""] || (mapData.entityTemplates ? mapData.entityTemplates[tileSymbol || ""] : null);

    // Tiles não transitáveis:
    // 1. Tiles "..." (vazio/void)
    // 2. Tiles com block: true ou tipo wall
    return !(
      !tileSymbol ||
      tileSymbol === "..." ||
      (tileDef && (tileDef.block || tileDef.type === "wall" || tileDef.isCollidable))
    );
  }

  protected followPath(): void {
    if (
      this.currentPath.length === 0 ||
      this.currentPathIndex >= this.currentPath.length
    ) {
      return;
    }

    const tileSize = 32;
    const nextPoint = this.currentPath[this.currentPathIndex];
    const targetX = nextPoint.x * tileSize + tileSize / 2;
    const targetY = nextPoint.y * tileSize + tileSize / 2;

    // Verificar se o próximo tile ainda é transitável
    if (!this.isTileWalkable(targetX, targetY)) {
      this.currentPath = []; // Cancela o caminho se o tile se tornou bloqueado
      return;
    }

    const distanceToNextPoint = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      targetX,
      targetY
    );

    if (distanceToNextPoint < 10) {
      this.currentPathIndex++;
      return;
    }

    const angle = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      targetX,
      targetY
    );

    const terrainMod = this.getTerrainSpeedMultiplier(this.sprite.x, this.sprite.y);
    this.sprite.setVelocity(
      Math.cos(angle) * this.speed * terrainMod,
      Math.sin(angle) * this.speed * terrainMod
    );
  }

  private getTerrainSpeedMultiplier(x: number, y: number): number {
      const scene = this.sprite.scene as GameScene;
      if (!scene.mapLoader) return 1.0;
      
      const gridX = Math.floor(x / this.tileSize);
      const gridY = Math.floor(y / this.tileSize);
      const category = scene.mapLoader.getTerrainCategory(gridX, gridY, this.level);

      if (category === "grass") return 0.8;
      if (category === "dirty") return 0.9;
      if (category === "sand") return 0.7;
      if (category === "mountain") return 0.6;
      if (category === "water") return 0.4;
      
      return 1.0;
  }

  public canAttack(target: Player): boolean {
    const now = Date.now();
    const distance = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      target.sprite.x,
      target.sprite.y
    );

    // Verificar alcance
    if (distance > this.attackRange) {
      return false;
    }

    // Verificar cooldown
    if (now - this.lastAttackTime < this.attackCooldown) {
      return false;
    }

    // Verificar linha de visão
    if (!this.checkLineOfSight(target.sprite.x, target.sprite.y)) {
      return false;
    }

    return true;
  }

  private checkLineOfSight(targetX: number, targetY: number): boolean {
    const scene = this.sprite.scene as GameScene;
    return scene.mapLoader.checkLineOfSight(
      this.sprite.x,
      this.sprite.y,
      targetX,
      targetY,
      this.level
    );
  }

  public attack(target: Player | Enemy): void {
    if (!this.canAttack(target as Player)) {
      return;
    }

    // Play Attack Animation
    if (this.sprite.scene) {
        const angle = Phaser.Math.Angle.Between(
            this.sprite.x, this.sprite.y, 
            target.sprite.x, target.sprite.y
        );
        // Normalize angle to 4/8 dirs? We only have 4.
        const deg = Phaser.Math.RadToDeg(angle);
        let dir = "down";
        if (deg >= -45 && deg < 45) dir = "right";
        else if (deg >= 45 && deg < 135) dir = "down";
        else if (deg >= -135 && deg < -45) dir = "up";
        else dir = "left";

        const animKey = `${this.enemyType}-attack-${dir}`;
        if (this.sprite.scene.anims.exists(animKey)) {
            this.sprite.play(animKey);
        }
    }

    this.battleSystem.startBattle(this, target);
    this.lastAttackTime = Date.now(); // Mover após startBattle
  }

  public takeDamage(amount: number): boolean {
    // Código existente (mantido sem alterações)
    if (!this.sprite.scene || !this.sprite.active) {
      return false;
    }
    this.health -= amount;
    
    // AI Provocation Logic
    if (this.health > 0) {
        this.isProvoked = true;
        this.currentState = "CHASE";
        this.currentPath = [];
    }

    try {
      if (this.sprite.scene && this.sprite.scene.tweens) {
        this.sprite.setTint(0xff0000);
        this.sprite.scene.tweens.add({
          targets: this.sprite,
          tint: 0xffffff,
          duration: 300,
          onComplete: () => {
            if (this.sprite?.scene) {
              this.sprite.clearTint();
            }
          },
        });
      }
      if (this.hud && this.sprite.scene) {
        this.hud.update();
      }
      if (this.health <= 0) {
        // AUDIO: Play Death Sound
        console.log(`[Enemy] Death Detected for ${this.enemyType}. Calling playEnemyDeath.`);
        AudioManager.getInstance().playEnemyDeath(this.enemyType);
        
        this.sprite.setVelocity(0,0);
        if (this.sprite.body) {
            this.sprite.body.enable = false; // Disable physics
        }

        const deathAnim = `${this.enemyType}-die`;
        if (this.sprite.scene.anims.exists(deathAnim)) {
            this.sprite.play(deathAnim);
        }
        
        // Always trigger smooth fade-out (v2.61)
        this.fadeAndDestroy();
        return true;
      }
    } catch (error) {
      console.error("Error in enemy takeDamage:", error);
      return false;
    }
    return false;
  }

  private fadeAndDestroy(): void {
      if (!this.sprite || !this.sprite.scene) {
          this.destroyEnemy();
          return;
      }

      this.sprite.scene.tweens.add({
          targets: this.sprite,
          alpha: 0,
          duration: 1000,
          ease: 'Power1',
          onComplete: () => {
              this.destroyEnemy();
          }
      });
  }


  public destroyEnemy(): void {
    // ... existing ...
    if (this.hud) {
      this.hud.destroy();
      this.hud = null;
    }
    if (this.sprite && this.sprite.scene) {
      this.sprite.destroy();
    }
  }

  public isDefeated(): boolean {
    const dead = this.health <= 0 || !this.sprite.active;
    if (dead) {
        // Optional debug logging
        // console.warn(`Stats for ${this.id}: Health=${this.health}, Active=${this.sprite.active}`);
    }
    return dead;
  }

  public getDefense(): number {
    const def = EnemyRegistry.getEnemyDefinition(this.enemyType)?.defense || 0;
    return def;
  }

  public getArmor(): number {
    const armor = EnemyRegistry.getEnemyDefinition(this.enemyType)?.armor || 0;
    return armor;
  }

  public getResistance(element: string): number {
    const resistances = EnemyRegistry.getEnemyDefinition(this.enemyType)?.resistances;
    return resistances?.[element] || 0;
  }

  public getDefenseResistance(element: string): number {
    const resistances = EnemyRegistry.getEnemyDefinition(this.enemyType)?.defenseResistances;
    return resistances?.[element] || 0;
  }


  public getExp(): number {
    return EnemyRegistry.getEnemyDefinition(this.enemyType)?.exp || 0;
  }

  public getBloodColor(): number {
    return EnemyRegistry.getEnemyDefinition(this.enemyType)?.bloodColor ?? 0xcc0000;
  }

  private startCooldown(): void {}

  public generateLoot(): { itemId: string; count: number; stars?: number; attributes?: any[] }[] {
    return EnemyRegistry.generateLoot(this.enemyType);
  }

  public getDefenseExp(): number {
    const def = EnemyRegistry.getEnemyDefinition(this.enemyType)?.defenseExp || 0;
    return def;
  }

  public setHealth(health: number): void {
    this.health = health;
    this.maxHealth = health;
    this.updateHud();
  }

  // Soft Separation: Apply velocity away from nearby enemies to prevent stacking
  private applySeparationForce(): void {
      if(!this.sprite?.body) return;
      
      // OPTIMIZATION: Only run if moving or every few frames
      const scene = this.sprite.scene as GameScene;
      if (scene.time.now % 100 > 32) return; // Throttle: Only once every ~100ms or so

      const currentEnemies = scene.getActiveEnemies();
      const separationRadius = 24; // If closer than this, push apart
      const separationStrength = 20; // Force multiplier

      let forceX = 0;
      let forceY = 0;
      let count = 0;

      // OPTIMIZATION: We only care about enemies that are ALSO nearby (visual distance)
      // Since update() is already culled to 1400px, we are much safer.
      currentEnemies.forEach((other: Enemy) => {
          if (other === this || !other.sprite || !other.sprite.active || other.health <= 0) return;

          // Quick Manhattan distance check before expensive sqrt or logic
          const dx = this.sprite.x - other.sprite.x;
          const dy = this.sprite.y - other.sprite.y;
          if (Math.abs(dx) > separationRadius || Math.abs(dy) > separationRadius) return;

          const dist = Math.sqrt(dx*dx + dy*dy);

          if (dist < separationRadius && dist > 0) {
              // Push away
              // Normalize and inverse weight by distance (closer = stronger push)
              forceX += (dx / dist) / dist; 
              forceY += (dy / dist) / dist;
              count++;
          }
      });

      if (count > 0 && this.sprite.body) {
          // Apply the force to current velocity
          const body = this.sprite.body as Phaser.Physics.Arcade.Body;
          const currentVel = body.velocity;
          this.sprite.setVelocity(
              currentVel.x + forceX * separationStrength,
              currentVel.y + forceY * separationStrength
          );
      }
  }

  public getDamage(): number {
    return Phaser.Math.Between(1, this.damage);
  }

  public getHealth(): number {
    return this.health;
  }

  public getMaxHealth(): number {
    return this.maxHealth;
  }

  public setHud(hud: EnemyHud): void {
    this.hud = hud;
  }

  public updateHud(): void {
    if (this.hud) {
      this.hud.updatePosition();
      this.hud.updateHealth();
    }
  }

  public destroy(): void {
      if (this.hud) this.hud.destroy();
      if (this.sprite) this.sprite.destroy();
  }
}
