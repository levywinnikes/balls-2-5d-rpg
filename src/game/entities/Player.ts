import Phaser from "phaser";
import { PlayerGraphic } from "../graphics/PlayerGraphic";
import { WeaponDefinition } from "./weapons/WeaponRegistry";
import Enemy from "./Enemy";
import BattleSystem from "../systems/BattleSystem";
import { PlayerState } from "./Player/PlayerState";
import { XPTable } from "../data/XPTable";
import type GameScene from "../scenes/GameScene";
import { StrengthXpTable } from "../data/StrengthXpTable";
import { DexterityXpTable } from "../data/DexterityXpTable";
import { ReflexXpTable } from "../data/ReflexXpTable";
import { IntelligenceXpTable } from "../data/IntelligenceXpTable";
import { PlayerHealthBar } from "../hud";

import { AudioManager } from "../systems/AudioManager";
import { IRON_SHIELD_JOKES } from "../data/IronShieldJokes";
import { FloatingText } from "../effects/FloatingText";

export default class Player {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private shadow: Phaser.GameObjects.Sprite;
  private currentSpeed: number = 120;
  private shiftKey: Phaser.Input.Keyboard.Key;
  private lastDirection: "up" | "down" | "left" | "right" = "down";
  private lastAttackTime: number = 0;
  private hud: PlayerHealthBar;
  private currentTerrain: string = "floor";

  // Ambient Text Timer
  private lastShieldJokeTime: number = Date.now();
  private SHIELD_JOKE_INTERVAL: number = 60000; // 1 Minute

  // REMOVIDO: Flags de atualização de HUD (healthChanged, experienceChanged, etc.)
  // O React agora ouve os eventos do PlayerState diretamente.

  private state: PlayerState;
  public isFalling: boolean = false;

  private battleSystem?: BattleSystem;
  private tileSize: number = 32;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    this.state = PlayerState.getInstance();
    this.currentSpeed = this.state.getCurrentSpeed();
    this.sprite = PlayerGraphic.create(scene, x, y);
    this.sprite.setCollideWorldBounds(true);

    // Initial shadow creation
    const { BaseTileGraphic } = require("../graphics/tiles/BaseTileGraphic");
    this.shadow = scene.add.sprite(
      x,
      y + 4,
      BaseTileGraphic.SHADOW_TEXTURE_KEY,
    );
    this.shadow.setAlpha(0.4);
    this.shadow.setDepth(this.sprite.depth - 1);
    this.shadow.setScale(1.2);

    this.hud = new PlayerHealthBar(scene, this);

    // @ts-ignore: Phaser types workaround
    this.shiftKey = scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
    );
  }

  update(cursors: Phaser.Types.Input.Keyboard.CursorKeys): void {
    // Only move if not busy (falling/dead/attacking?)
    if (!this.sprite.active) return;

    // Check Input Block (e.g. Dashboard Open)
    if (this.state.getInputBlocked()) {
      this.sprite.setVelocity(0);
      this.sprite.play("player-idle", true); // Or keep last idle
      return;
    }

    // --- TERRAIN LOGIC (Data-Driven v3.0) ---
    let speedMultiplier = 1.0;
    const scene = this.sprite.scene as GameScene;
    if (scene.mapLoader) {
      const level = this.state.getCurrentLevel();
      const gridX = Math.floor(this.sprite.x / this.tileSize);
      const gridY = Math.floor(this.sprite.y / this.tileSize);

      // Get Tile ID from MapLoader (returns ID or Category)
      const tileId = scene.mapLoader.getTerrainCategory(gridX, gridY, level);

      if (tileId) {
        const { TileRegistry } = require("../graphics/tiles/TileRegistry");
        const tileDef = TileRegistry.getTileDefinition(tileId);

        if (tileDef) {
          this.currentTerrain = tileDef.stepSound || "floor";
          speedMultiplier = tileDef.speedModifier ?? 1.0;
        } else {
          this.currentTerrain = "floor";
        }
      } else {
        this.currentTerrain = "floor";
      }

      // Boots Mitigation (Terrain Resistance)
      if (speedMultiplier < 1.0) {
        const boots = this.state.getEquippedBoots();
        if (boots && boots.terrainResistance) {
          const penalty = 1.0 - speedMultiplier;
          const reduction = penalty * boots.terrainResistance;
          speedMultiplier = 1.0 - (penalty - reduction);
        }
      }
    }

    this.currentSpeed =
      (this.shiftKey.isDown
        ? this.state.getSprintSpeed()
        : this.state.getCurrentSpeed()) *
      speedMultiplier *
      this.state.getSpeedPenaltyMultiplier(); // Apply Overburden Penalty

    // SUPER SPEED OVERRIDE
    if (this.state.getDiagnosticSettings().enableSuperSpeed) {
      this.currentSpeed *= 6.0;
    }

    const noClip = this.state.getDiagnosticSettings().enableNoClip;
    if (this.sprite.body) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).checkCollision.none =
        noClip;
    }

    this.sprite.setVelocity(0);

    const movingLeft = cursors.left?.isDown;
    const movingRight = cursors.right?.isDown;
    const movingUp = cursors.up?.isDown;
    const movingDown = cursors.down?.isDown;

    const directionX = (movingLeft ? -1 : 0) + (movingRight ? 1 : 0);
    const directionY = (movingUp ? -1 : 0) + (movingDown ? 1 : 0);

    if (directionX !== 0 || directionY !== 0) {
      // PREDICTIVE MOVEMENT CHECK FOR VOID
      const scene = this.sprite.scene as any;
      if (scene && scene.checkPlayerVoidMove && !noClip) {
        const moveDir = { x: directionX, y: directionY };
        const shouldBlock = scene.checkPlayerVoidMove(
          this.sprite.x,
          this.sprite.y,
          moveDir,
        );
        if (shouldBlock) {
          // Blocked by Safety
          this.sprite.setVelocity(0);
          // Update direction but don't move
          this.updateLastDirection(
            movingLeft,
            movingRight,
            movingUp,
            movingDown,
          );
          this.sprite.play(`player-idle-${this.lastDirection}`, true);
          return;
        }
      }

      const direction = new Phaser.Math.Vector2(
        directionX,
        directionY,
      ).normalize();
      this.sprite.setVelocity(
        direction.x * this.currentSpeed,
        direction.y * this.currentSpeed,
      );
      this.updateLastDirection(movingLeft, movingRight, movingUp, movingDown);
      this.sprite.play(`player-walk-${this.lastDirection}`, true);

      // TRIGGER FOOTSTEP AUDIO
      AudioManager.getInstance().playFootstep(this.currentTerrain);
    } else {
      // Optional: Play directional idle (e.g. "player-idle-down") if we had them.
      // For now, just stop animation or play generic idle.
      // If we want to stay in the last direction frame, we can just stop.
      // But standard behavior is often "idle" animation.
      // Let's stick to generic idle for now or just stop on the last frame?
      // User asked for "animation dele andando".
      // Let's use generic idle for simplicity unless user complains.
      this.sprite.play(`player-idle-${this.lastDirection}`, true);
    }

    // Update World HUD
    this.hud.update();

    // Update Depth for Y-Sorting (Dynamic Layering)
    // Assumes player is always on current level relative to rendering
    // FIX: Add a base depth of +10 to ensure player is ABOVE the floor tiles at the same Y
    this.sprite.setDepth(this.sprite.y + 10);

    // Sync Shadow Position and Depth
    if (this.shadow) {
      this.shadow.setPosition(this.sprite.x, this.sprite.y + 10);
      this.shadow.setDepth(this.sprite.depth - 1); // Directly below player but above floor
      this.shadow.setAlpha(0.6); // Darker shadow
      this.shadow.setScale(1.5); // Larger shadow
    }

    // --- IRON SHIELD BANTER LOGIC ---
    const now = Date.now();
    if (now - this.lastShieldJokeTime >= this.SHIELD_JOKE_INTERVAL) {
      if (this.state.equippedShieldId === "iron_shield") {
        // 1. Get Joke Key
        const jokeKeys = IRON_SHIELD_JOKES;
        const randomKey = jokeKeys[Math.floor(Math.random() * jokeKeys.length)];

        // 2. Translate and Show
        // Using dynamic import to avoid circular dependencies if any, or just convenience
        import("../i18n/translations").then(({ t_game }) => {
          const jokeText = t_game(randomKey as any);
          FloatingText.createAmbientText(
            this.sprite.scene,
            this.sprite.x,
            this.sprite.y - 50, // Above head
            `"${jokeText}"`,
          );
        });

        // Reset Timer (Randomize slightly 45s-75s)
        this.SHIELD_JOKE_INTERVAL = 45000 + Math.random() * 30000;
        this.lastShieldJokeTime = now;
      } else {
        // Not equipped? Just reset timer to check again later (standard 1m)
        this.lastShieldJokeTime = now;
        this.SHIELD_JOKE_INTERVAL = 60000;
      }
    }
  }

  public setBattleSystem(battleSystem: BattleSystem): void {
    this.battleSystem = battleSystem;
  }

  // Métodos getters diretos do State (Wrappers de conveniência)
  public getTotalDefense(): number {
    return this.state.getTotalDefense();
  }

  public getTotalArmor(): number {
    return this.state.getTotalArmor();
  }
  public getReflexLevel(): number {
    return this.state.getReflexLevel();
  }
  public getReflexExperience(): number {
    return this.state.getReflexExperience();
  }
  public getHealth(): number {
    return this.state.getHealth();
  }
  public getMaxHealth(): number {
    return this.state.getMaxHealth();
  }
  public getLevel(): number {
    return this.state.getLevel();
  }
  public getExperience(): number {
    return this.state.getExperience();
  }
  public getStrengthLevel(): number {
    return this.state.getStrengthLevel();
  }
  public getDexterityLevel(): number {
    return this.state.getDexterityLevel();
  }
  public getStrengthExperience(): number {
    return this.state.getStrengthExperience();
  }
  public getDexterityExperience(): number {
    return this.state.getDexterityExperience();
  }
  public getIntelligenceLevel(): number {
    return this.state.getIntelligenceLevel();
  }
  public getCurrentSpeed(): number {
    return this.currentSpeed;
  }

  // Removed local getSpeedPenaltyMultiplier, relying on PlayerState if needed or calculating locally using state

  public getEquippedWeapon(): WeaponDefinition | null {
    return this.state.getEquippedWeapon();
  }

  public getEquippedShield(): WeaponDefinition | null {
    return this.state.getEquippedShield();
  }

  // Métodos de Lógica de Jogo
  public gainReflexExperience(amount: number): boolean {
    return this.state.gainReflexExperience(amount);
  }

  // private handleReflexSkillLevelUp() removed as PlayerState handles the event emission.

  public getReflexExperienceProgress() {
    return ReflexXpTable.getLevelInfo(this.getReflexExperience());
  }

  public takeDamage(amount: number): boolean {
    const isDefeated = this.state.takeDamage(amount);
    // REMOVIDO: this.healthChanged = true;
    if (isDefeated) {
      this.handleDefeat();
    }
    return isDefeated;
  }

  private handleDefeat(): void {
    // FIX: Do not handle defeat here.
    // We want GameScene.update() to detect Health <= 0 and trigger the proper handlePlayerDeath() flow
    // which handles FadeOut, Scene Restart, and Persistence.
    console.log("Player defeated - Waiting for GameScene to handle death.");
  }

  public canAttack(target: Enemy): boolean {
    const now = Date.now();
    const distance = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      target.sprite.x,
      target.sprite.y,
    );
    const weapon = this.state.getEquippedWeapon();
    const attackRange = weapon ? weapon.range : 50;
    const attackCooldown = weapon ? weapon.cooldown : 1000;

    if (distance > attackRange || now - this.lastAttackTime < attackCooldown) {
      return false;
    }

    return this.checkLineOfSight(target.sprite.x, target.sprite.y);
  }

  public checkLineOfSight(targetX: number, targetY: number): boolean {
    const scene = this.sprite.scene as GameScene;
    const currentLevel = scene.registry.get("currentLevel");

    return scene.mapLoader.checkLineOfSight(
      this.sprite.x,
      this.sprite.y,
      targetX,
      targetY,
      currentLevel,
    );
  }

  public gainExperience(amount: number): void {
    this.state.gainExperience(amount);
  }

  public gainStrengthExperience(amount: number): void {
    this.state.gainStrengthExperience(amount);
  }

  public gainDexterityExperience(amount: number): void {
    this.state.gainDexterityExperience(amount);
  }

  public gainIntelligenceExperience(amount: number): void {
    this.state.gainIntelligenceExperience(amount);
  }

  private handleLevelUp(): void {
    const currentLevel = this.getLevel();

    // Old Pop-up Removed
    // const scene = this.sprite.scene as GameScene;
    // new LevelUpAnimation(scene, this.sprite.x, this.sprite.y, currentLevel);

    // this.state.emit("skyrimSkillUp", { type: "level", level: currentLevel }); // Handled in PlayerState

    // Atualiza status base
    this.state.recalculateMaxHealth();
    this.state.setHealth(this.state.getMaxHealth()); // Heal to full on Level Up

    // Update Attack Damage (Legacy/Base)
    const baseDamage = 10;
    const damagePerLevel = 2;
    const newAttackDamage = baseDamage + (currentLevel - 1) * damagePerLevel;

    this.state.setAttackDamage(newAttackDamage);
    this.currentSpeed = this.state.getCurrentSpeed();
  }

  public getStrengthExperienceProgress() {
    return StrengthXpTable.getLevelInfo(this.getStrengthExperience());
  }
  public getIntelligenceExperienceProgress() {
    return IntelligenceXpTable.getLevelInfo(
      this.state.getIntelligenceExperience(),
    );
  }
  public getDexterityExperienceProgress() {
    return DexterityXpTable.getLevelInfo(this.getDexterityExperience());
  }

  public getWillpowerBonusPercent(): number {
    return this.state.getWillpowerBonusPercent();
  }

  public getCriticalChance(): number {
    return this.state.getCriticalChance();
  }

  public getCriticalDamageMultiplier(): number {
    return this.state.getCriticalDamageMultiplier();
  }

  public getAttackDamage(): number {
    const maxDamage = this.state.getTotalAttack();
    return Phaser.Math.Between(1, maxDamage);
  }

  public getAttackStats(): number {
    return this.state.getTotalAttack();
  }

  public getExpPerHit(): number {
    return this.state.getExpPerHit();
  }

  public getExpDamagePercent(): number {
    return this.state.getExpDamagePercent();
  }

  public getAttackRange(): number {
    const weapon = this.getEquippedWeapon();
    return weapon?.range || 200;
  }

  public getExperienceProgress() {
    return XPTable.getLevelInfo(this.getExperience());
  }

  public setLastAttackTime(time: number): void {
    this.lastAttackTime = time;
  }

  // REMOVIDO: métodos hasHealthChanged, hasExperienceChanged, needsHudUpdate, etc.

  public isDefeated(): boolean {
    return this.getHealth() <= 0;
  }

  private updateLastDirection(
    left: boolean,
    right: boolean,
    up: boolean,
    down: boolean,
  ): void {
    if (left) this.lastDirection = "left";
    if (right) this.lastDirection = "right";
    if (up) this.lastDirection = "up";
    if (down) this.lastDirection = "down";
  }

  public setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
  }
}
