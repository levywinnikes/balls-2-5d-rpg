import { Vector3, Color3, StandardMaterial, MeshBuilder } from "@babylonjs/core";
import { SliceSceneContext } from "./SliceSceneContext";
import { SliceEnemy } from "./EnemyStreamSystem";
import { RuneRegistry } from "../../core/magic/RuneRegistry";
import { EnemyMagicRegistry } from "../../game/entities/EnemyMagicRegistry";
import { ItemType } from "../../config/ItemConstants";
import { Projectile3DSystem, ProjectileEnemyTarget, resolveProjectile3DProfile } from "./Projectile3DSystem";
import { setEnemyVisualAnimState, type EnemyVisualAnimState } from "./ThreeDEnemyVisualRegistry";
import { getGeneratedAttackDurationMs } from "./TwoDParitySpriteFactory";
import { t_game } from "../../game/i18n/translations";

export interface SliceCombatSystemConfig {
  ctx: SliceSceneContext;
  projectileSystem: Projectile3DSystem;
  destroyEnemy: (enemy: SliceEnemy, context?: { finishingDamage?: number; isFireKill?: boolean }) => void;
  emitBloodBurst: (pos: Vector3, colorHex: string, count: number, speed: number, radius: number) => void;
  emitPlayerDamagePopup: (sourceId: string, damage: number, symbol?: string, customColor?: string) => void;
  triggerPlayerDeathSequence: () => void;
  hasLineOfSight: (origin: Vector3, target: Vector3) => boolean;
  onPlayerAttackStarted?: (enemy: SliceEnemy, isRanged: boolean) => void;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class SliceCombatSystem {
  private config: SliceCombatSystemConfig;
  public lastPlayerAttackAt: number = 0;
  private lastRuneCastAt: number = 0;

  constructor(config: SliceCombatSystemConfig) {
    this.config = config;
  }

  public applyRuneDamageToEnemy(
    enemy: SliceEnemy,
    damage: number,
    runeId: string,
  ): void {
    const { ctx } = this.config;
    if (enemy.isDead) {
      return;
    }

    const initialHp = enemy.health;
    enemy.health = Math.max(0, enemy.health - damage);
    enemy.isProvoked = true;

    ctx.playerState.emit("floatingText", {
      x: enemy.worldPos.x,
      y: enemy.worldPos.y,
      z: enemy.worldPos.z,
      damage: -damage,
      isCritical: false,
    });

    ctx.playerState.log(
      "combat_damage_dealt",
      { damage, target: enemy.enemyType },
      "#ffffff",
    );

    this.emitCombatEnemyHit(enemy, damage);

    // Apply Intelligence XP
    const actualDamageDealt = Math.min(damage, initialHp);
    const xpGain = actualDamageDealt > 0 ? (100 + actualDamageDealt) : 10;
    ctx.playerState.gainIntelligenceExperience(xpGain);
    ctx.playerState.log(
      "combat_gained_skill_xp",
      { skill: "Intelligence", amount: xpGain },
      "#34d399",
    );

    if (enemy.health <= 0) {
      const rune = RuneRegistry.getRune(runeId);
      const isFireKill = rune?.damage.element === "fire";
      this.config.destroyEnemy(enemy, {
        finishingDamage: damage,
        isFireKill,
      });
    }
  }

  public applyPlayerAttackToEnemy(enemy: SliceEnemy): void {
    const { ctx } = this.config;
    const equippedWeapon = ctx.playerState.getEquippedWeapon();
    const isFireAttack = equippedWeapon?.element === "fire";
    const maxAttack = equippedWeapon
      ? Math.max(1, Math.floor(ctx.playerState.getTotalAttack()))
      : 5;
    const attackRoll = randomInt(1, maxAttack);
    const enemyDefense = Math.max(1, enemy.definition.defense || 1);
    const defenseRoll = randomInt(1, enemyDefense);

    let damageMitigation = 0;
    if (attackRoll <= defenseRoll) {
      if (isFireAttack) {
        damageMitigation = 0.5; // partial block
        ctx.playerState.emit("floatingText", {
          x: enemy.worldPos.x,
          y: enemy.worldPos.y,
          z: enemy.worldPos.z,
          message: "🛡️",
          customColor: "#00FFFF",
        });
        ctx.playerState.log(
          "combat_partially_blocked",
          { target: enemy.enemyType },
          "#aaaaaa",
        );
        if (damageMitigation >= 1) {
          ctx.audioManager.playBlock();
          this.gainCombatExperience3d(0);
          return;
        }
      } else {
        ctx.playerState.emit("floatingText", {
          x: enemy.worldPos.x,
          y: enemy.worldPos.y,
          z: enemy.worldPos.z,
          message: "🛡️",
          customColor: "#00FFFF",
        });
        ctx.playerState.log(
          "combat_blocked_enemy",
          { target: enemy.enemyType },
          "#aaaaaa",
        );
        ctx.audioManager.playBlock();
        this.gainCombatExperience3d(0);
        return;
      }
    }

    const initialDamage = randomInt(1, maxAttack);
    const armor = Math.max(0, enemy.definition.armor || 0);
    const minReduction = armor > 0 ? Math.max(1, Math.ceil(armor * 0.1)) : 0;
    const armorReduction =
      armor > 0 ? randomInt(minReduction, Math.max(minReduction, armor)) : 0;

    let damage = Math.max(0, Math.floor(initialDamage - armorReduction));
    if (damageMitigation > 0) {
      damage = Math.max(1, Math.round(damage * (1 - damageMitigation)));
    }

    if (damage <= 0) {
      ctx.playerState.emit("floatingText", {
        x: enemy.worldPos.x,
        y: enemy.worldPos.y,
        z: enemy.worldPos.z,
        message: "🛡️",
        customColor: "#C0C0C0",
      });
      ctx.playerState.log(
        "combat_blocked_armor_enemy",
        { target: enemy.enemyType },
        "#aaaaaa",
      );
      ctx.audioManager.playBlock();
      this.gainCombatExperience3d(0);
      return;
    }

    if (isFireAttack) {
      const fireRes = Math.max(
        -0.95,
        Math.min(0.95, enemy.definition.resistances?.fire ?? 0),
      );
      damage = Math.max(1, Math.round(damage * (1 - fireRes)));
    }

    const critChance = ctx.playerState.getCriticalChance();
    const isCritical = Math.random() * 100 <= critChance;
    if (isCritical) {
      const critMult = Math.max(0, ctx.playerState.getCriticalDamageMultiplier());
      const minCrit = maxAttack;
      const maxCrit = Math.max(minCrit, Math.floor(maxAttack * (1 + critMult)));
      damage = randomInt(minCrit, maxCrit);
      ctx.playerState.gainStrengthExperience(100);
      ctx.playerState.gainDexterityExperience(100);
      ctx.audioManager.playCritical();
      ctx.playerState.log("combat_critical_hit", { damage }, "#ff00ff");
    } else {
      ctx.audioManager.playAttack();
    }

    const initialEnemyHp = enemy.health;
    enemy.health = Math.max(0, enemy.health - damage);
    enemy.isProvoked = true;

    ctx.playerState.emit("floatingText", {
      x: enemy.worldPos.x,
      y: enemy.worldPos.y,
      z: enemy.worldPos.z,
      damage: -damage,
      isCritical: isCritical,
    });

    ctx.playerState.log(
      "combat_damage_dealt",
      { damage, target: enemy.enemyType },
      "#ffffff",
    );

    this.emitCombatEnemyHit(enemy, damage);

    const effectiveDamage = Math.max(0, Math.min(damage, initialEnemyHp));
    this.gainCombatExperience3d(effectiveDamage);

    if (enemy.health <= 0) {
      this.config.destroyEnemy(enemy, {
        finishingDamage: damage,
        isFireKill: isFireAttack,
      });
    }
  }

  public applyEnemyAttackToPlayer(enemy: SliceEnemy, now: number): void {
    const { ctx } = this.config;
    const cooldown = Math.max(0, enemy.definition.cooldown || 1000);
    if (now - enemy.lastAttackAt < cooldown) {
      return;
    }

    enemy.lastAttackAt = now;
    const attackLockMs = getGeneratedAttackDurationMs(enemy.enemyType);
    this.setEnemyAnimState(enemy, "attack", attackLockMs);

    const isFireAttack =
      enemy.enemyType === "dragon" ||
      Boolean(
        enemy.definition.magicAttacks?.some((magicId) =>
          magicId.toLowerCase().includes("fire"),
        ),
      );
    const defenseRollMax = Math.max(1, ctx.playerState.getTotalDefense());
    const attackDamage = Math.max(1, enemy.definition.damage);
    const attackRoll = randomInt(1, attackDamage);
    const defenseRoll = randomInt(1, defenseRollMax);
    let damageMitigation = 0;

    const totalReflexXp = 100 + attackRoll;

    if (defenseRoll >= attackRoll) {
      ctx.playerState.gainReflexExperience(totalReflexXp);

      if (isFireAttack) {
        damageMitigation =
          ctx.playerState.getEquippedShield()?.defenseResistances?.fire || 0;
        ctx.playerState.emit("floatingText", {
          x: ctx.player.position.x,
          y: ctx.player.position.y,
          z: ctx.player.position.z,
          message: "🛡️",
          customColor: "#00FFFF",
        });
        ctx.playerState.log(
          "combat_blocked_player",
          { target: enemy.enemyType, xp: totalReflexXp },
          "#aaaaff",
        );
        if (damageMitigation >= 1) {
          ctx.audioManager.playBlock();
          return;
        }
      } else {
        ctx.playerState.emit("floatingText", {
          x: ctx.player.position.x,
          y: ctx.player.position.y,
          z: ctx.player.position.z,
          message: "🛡️",
          customColor: "#00FFFF",
        });
        ctx.playerState.log(
          "combat_blocked_player",
          { target: enemy.enemyType, xp: totalReflexXp },
          "#aaaaff",
        );
        ctx.audioManager.playBlock();
        return;
      }
    } else {
      ctx.playerState.gainReflexExperience(10);
      ctx.playerState.log(
        "combat_gained_skill_xp",
        { skill: "Reflex", amount: 10 },
        "#34d399",
      );
    }

    let finalDamage = Math.max(1, attackRoll - Math.floor(defenseRoll / 2));
    if (damageMitigation > 0) {
      finalDamage = Math.max(
        1,
        Math.round(finalDamage * (1 - damageMitigation)),
      );
    }

    const armor = Math.max(0, ctx.playerState.getTotalArmor());
    const minReduction = armor > 0 ? Math.max(1, Math.ceil(armor * 0.1)) : 0;
    const armorReduction =
      armor > 0 ? randomInt(minReduction, Math.max(minReduction, armor)) : 0;
    finalDamage = Math.max(0, finalDamage - armorReduction);

    if (finalDamage <= 0) {
      ctx.playerState.emit("floatingText", {
        x: ctx.player.position.x,
        y: ctx.player.position.y,
        z: ctx.player.position.z,
        message: "🛡️",
        customColor: "#C0C0C0",
      });
      ctx.playerState.log(
        "combat_blocked_armor_player",
        { target: enemy.enemyType },
        "#aaaaaa",
      );
      ctx.audioManager.playBlock();
      return;
    }

    const playerDied = ctx.playerState.takeDamage(finalDamage);

    this.config.emitPlayerDamagePopup(`${enemy.uid}:melee`, finalDamage);

    ctx.playerState.log(
      "combat_damage_taken",
      { damage: finalDamage, target: enemy.enemyType },
      "#ff4444",
    );
    ctx.audioManager.playAttack();

    if (playerDied) {
      this.config.triggerPlayerDeathSequence();
    }
  }

  public tryEnemyMagicAttack(enemy: SliceEnemy, now: number): boolean {
    const { ctx } = this.config;
    const magicIds = enemy.definition.magicAttacks || [];
    if (!magicIds.length) {
      return false;
    }

    const hpRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 1;
    const distanceToPlayerPx =
      Vector3.Distance(enemy.worldPos, ctx.player.position) * 32;

    for (const magicId of magicIds) {
      const magicDef = EnemyMagicRegistry.getMagic(magicId);
      if (!magicDef) {
        continue;
      }

      const lastCastAt = enemy.magicCooldowns.get(magicId) || 0;
      if (now - lastCastAt < magicDef.cooldown) {
        continue;
      }

      if (
        magicDef.minHpPercentage !== undefined &&
        hpRatio < magicDef.minHpPercentage
      ) {
        continue;
      }

      if (
        magicDef.maxHpPercentage !== undefined &&
        hpRatio > magicDef.maxHpPercentage
      ) {
        continue;
      }

      if (distanceToPlayerPx > magicDef.range) {
        continue;
      }

      if (!this.config.hasLineOfSight(enemy.worldPos, ctx.player.position)) {
        continue;
      }

      if (Math.random() > magicDef.chance) {
        continue;
      }

      enemy.magicCooldowns.set(magicId, now);
      enemy.lastAttackAt = now;
      this.setEnemyAnimState(
        enemy,
        "attack",
        getGeneratedAttackDurationMs(enemy.enemyType),
      );

      const spellDamage = randomInt(magicDef.minDamage, magicDef.maxDamage);
      const playerDied = ctx.playerState.takeDamage(spellDamage);

      ctx.playerState.emit("floatingText", {
        x: enemy.worldPos.x,
        y: enemy.worldPos.y,
        z: enemy.worldPos.z,
        message: "🔥",
        customColor: "#FF4500",
        isAmbient: true,
      });

      this.config.emitPlayerDamagePopup(
        `${enemy.uid}:magic:${magicId}`,
        spellDamage,
        "🔥",
        "#FF4500",
      );

      ctx.playerState.log(
        "combat_damage_taken",
        { damage: spellDamage, target: enemy.enemyType },
        "#ff4444",
      );
      ctx.audioManager.playFireHit();

      if (playerDied) {
        this.config.triggerPlayerDeathSequence();
      }

      return true;
    }

    return false;
  }

  public castRune3d(): void {
    const { ctx } = this.config;
    const now = Date.now();
    if (now - this.lastRuneCastAt < 1000) {
      return;
    }

    const slots = ctx.playerState.getEquippedRuneSlots();
    const runeId = slots[ctx.activeRuneSlotIndex];
    if (!runeId) return;

    const def = RuneRegistry.getRune(runeId);
    if (!def) return;

    // Find target enemy
    let targetEnemy: SliceEnemy | null = null;
    if (ctx.selectedEnemyUid) {
      targetEnemy = ctx.enemies.get(ctx.selectedEnemyUid) || null;
      if (targetEnemy?.isDead) targetEnemy = null;
    }
    if (!targetEnemy) {
      // pick nearest alive enemy within 8 units
      let nearestDist = 8;
      ctx.enemies.forEach((e) => {
        if (e.isDead) return;
        const d = Vector3.Distance(ctx.player.position, e.worldPos);
        if (d < nearestDist) {
          nearestDist = d;
          targetEnemy = e;
        }
      });
    }
    if (!targetEnemy) {
      return;
    }

    this.lastRuneCastAt = now;

    // Build projectile mesh
    const hexColor = def.effect3d?.color ?? "#ff5500";
    const projMat = new StandardMaterial("rune_proj_mat_" + now, ctx.scene);
    projMat.emissiveColor = Color3.FromHexString(hexColor);
    projMat.disableLighting = true;

    const proj = MeshBuilder.CreateSphere(
      "rune_proj_" + now,
      { diameter: 0.18, segments: 4 },
      ctx.scene,
    );
    proj.material = projMat;
    proj.position = ctx.player.position.clone();
    proj.position.y += 0.3;

    const speed = def.effect3d?.speed ?? 14;
    const impactRadius = def.effect3d?.radius ?? 1.0;

    // Animate projectile frame-by-frame using onBeforeRender
    const finalTarget = targetEnemy;
    const removeObs = ctx.scene.onBeforeRenderObservable.add(() => {
      const dt = ctx.scene.getEngine().getDeltaTime() / 1000;
      const toTarget = finalTarget.worldPos.subtract(proj.position);
      const dist = toTarget.length();
      if (dist < 0.2) {
        if (finalTarget.isDead) {
          proj.dispose();
          projMat.dispose();
          ctx.scene.onBeforeRenderObservable.remove(removeObs);
          ctx.playerState.gainIntelligenceExperience(10);
          ctx.playerState.log(
            "combat_gained_skill_xp",
            { skill: "Intelligence", amount: 10 },
            "#34d399",
          );
          return;
        }

        // Impact: apply damage
        const playerInt = ctx.playerState.getIntelligenceData().level;
        const dmg = RuneRegistry.calculateDamage(
          runeId,
          ctx.playerState.getLevel(),
          playerInt,
        );
        const damage = Math.max(
          1,
          dmg.min + Math.floor(Math.random() * (dmg.max - dmg.min + 1)),
        );
        this.applyRuneDamageToEnemy(finalTarget, damage, runeId);

        // Impact flash: scale-up then dispose
        const flashMat = new StandardMaterial("rune_flash_" + now, ctx.scene);
        flashMat.emissiveColor = Color3.FromHexString(hexColor);
        flashMat.wireframe = true;
        const flash = MeshBuilder.CreateSphere(
          "rune_flash_mesh_" + now,
          { diameter: impactRadius * 2, segments: 4 },
          ctx.scene,
        );
        flash.material = flashMat;
        flash.position = finalTarget.worldPos.clone();
        let flashAge = 0;
        const flashObs = ctx.scene.onBeforeRenderObservable.add(() => {
          flashAge += ctx.scene.getEngine().getDeltaTime() / 1000;
          flash.scaling.setAll(1 + flashAge * 4);
          const alpha = Math.max(0, 1 - flashAge / 0.3);
          flashMat.emissiveColor = Color3.FromHexString(hexColor).scale(alpha);
          if (flashAge > 0.3) {
            flash.dispose();
            flashMat.dispose();
            ctx.scene.onBeforeRenderObservable.remove(flashObs);
          }
        });

        // Cleanup projectile
        proj.dispose();
        projMat.dispose();
        ctx.scene.onBeforeRenderObservable.remove(removeObs);
        return;
      }

      const step = toTarget.normalize().scale(speed * dt);
      proj.position.addInPlace(step);
    });

    ctx.playerState.log("action_cast_rune", { runeId }, "#ff8800");
  }

  public tryAutoPlayerAttack(now: number): void {
    const { ctx } = this.config;
    if (!ctx.selectedEnemyUid) {
      return;
    }

    const enemy = ctx.enemies.get(ctx.selectedEnemyUid);
    if (!enemy || enemy.isDead) {
      ctx.setSelectedEnemy(null);
      return;
    }

    const cooldownMs = this.getPlayerAttackCooldownMs();
    if (now - this.lastPlayerAttackAt < cooldownMs) {
      return;
    }

    const attackRangeUnits = this.getPlayerAttackRangeUnits();
    const distanceToEnemy = Vector3.Distance(ctx.player.position, enemy.worldPos);
    if (distanceToEnemy > attackRangeUnits) {
      return;
    }

    // Line of sight check
    if (!this.config.hasLineOfSight(ctx.player.position, enemy.worldPos)) {
      return;
    }

    const equippedWeapon = ctx.playerState.getEquippedWeapon();
    if (equippedWeapon?.type === ItemType.DISTANCE) {
      const fired = this.firePlayerWeaponProjectile(enemy);
      if (fired) {
        this.lastPlayerAttackAt = now;
        this.config.onPlayerAttackStarted?.(enemy, true);
      }
    } else {
      this.lastPlayerAttackAt = now;
      this.config.onPlayerAttackStarted?.(enemy, false);
      this.applyPlayerAttackToEnemy(enemy);
    }
  }

  public firePlayerWeaponProjectile(aimEnemy: SliceEnemy): boolean {
    const { ctx } = this.config;
    const equippedWeapon = ctx.playerState.getEquippedWeapon();
    if (!equippedWeapon || equippedWeapon.type !== ItemType.DISTANCE) {
      return false;
    }

    const origin = ctx.player.position.clone();
    origin.y += 0.52;

    const targetPos = aimEnemy.worldPos.clone();
    targetPos.y = origin.y;
    const direction = targetPos.subtract(origin);
    if (direction.lengthSquared() < 0.0001) {
      return false;
    }

    const enemyTargets: ProjectileEnemyTarget[] = [];
    ctx.enemies.forEach((enemy) => {
      if (enemy.isDead) {
        return;
      }
      enemyTargets.push({
        uid: enemy.uid,
        worldPos: enemy.worldPos.clone(),
        isDead: enemy.isDead,
      });
    });

    ctx.audioManager.playRangedWeaponShot(equippedWeapon.id);

    return this.config.projectileSystem.fire({
      origin,
      direction,
      maxRange: this.getPlayerAttackRangeUnits(),
      profile: resolveProjectile3DProfile(equippedWeapon.id),
      enemies: enemyTargets,
      onEnemyHit: (hit) => {
        const enemyObj = ctx.enemies.get(hit.uid);
        if (enemyObj && !enemyObj.isDead) {
          this.applyPlayerAttackToEnemy(enemyObj);
        }
      },
    });
  }

  public getPlayerAttackRangeUnits(): number {
    const { ctx } = this.config;
    const equippedWeapon = ctx.playerState.getEquippedWeapon();
    const weaponRange = equippedWeapon?.range || 50;
    return Math.max(1, weaponRange / 32);
  }

  public getPlayerAttackCooldownMs(): number {
    const { ctx } = this.config;
    const equippedWeapon = ctx.playerState.getEquippedWeapon();
    return Math.max(0, equippedWeapon?.cooldown ?? 1000);
  }

  private setEnemyAnimState(
    enemy: SliceEnemy,
    nextState: EnemyVisualAnimState,
    lockMs = 0,
  ): void {
    const now = Date.now();
    if (now < enemy.animLockedUntil && nextState !== "death") {
      return;
    }

    const restart = nextState === "attack";
    if (enemy.animState !== nextState || restart) {
      enemy.animState = nextState;
      setEnemyVisualAnimState(enemy.meshRoot, nextState, restart);
    }

    if (lockMs > 0) {
      enemy.animLockedUntil = now + lockMs;
    }
  }

  private emitCombatEnemyHit(enemy: SliceEnemy, damage: number): void {
    const { ctx } = this.config;
    if (damage <= 0) {
      return;
    }
    ctx.playerState.emit("combatEnemyHit", {
      uid: enemy.uid,
      enemyType: enemy.enemyType,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
      damage,
      isFocused: enemy.uid === ctx.selectedEnemyUid,
    });
    ctx.playerState.emit("combatEnemyHealthChanged", {
      uid: enemy.uid,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
    });
  }

  private gainCombatExperience3d(damageDealt: number = 0): void {
    const { ctx } = this.config;
    const totalXp = damageDealt > 0 ? (100 + damageDealt) : 10;
    const isFireAttack = ctx.playerState.getEquippedWeapon()?.element === "fire";
    const equippedWeapon = ctx.playerState.getEquippedWeapon();

    if (isFireAttack) {
      ctx.playerState.gainIntelligenceExperience(totalXp);
      ctx.playerState.log(
        "combat_gained_skill_xp",
        { skill: "Intelligence", amount: totalXp },
        "#34d399",
      );
    } else if (
      !equippedWeapon ||
      equippedWeapon.type === ItemType.SWORD ||
      equippedWeapon.type === ItemType.AXE ||
      equippedWeapon.type === ItemType.CLUB
    ) {
      ctx.playerState.gainStrengthExperience(totalXp);
      ctx.playerState.log(
        "combat_gained_skill_xp",
        { skill: "Strength", amount: totalXp },
        "#34d399",
      );
    } else if (equippedWeapon.type === ItemType.DISTANCE) {
      ctx.playerState.gainDexterityExperience(totalXp);
      ctx.playerState.log(
        "combat_gained_skill_xp",
        { skill: "Dexterity", amount: totalXp },
        "#34d399",
      );
    } else {
      ctx.playerState.gainStrengthExperience(totalXp);
      ctx.playerState.log(
        "combat_gained_skill_xp",
        { skill: "Strength", amount: totalXp },
        "#34d399",
      );
    }
  }

  public castRuneAtTarget(targetEnemyUid: string): void {
    const { ctx } = this.config;
    if (!ctx.targetingRuneId) return;

    const runeId = ctx.targetingRuneId;
    ctx.runeTargetingMode = false;
    ctx.targetingRuneId = null;
    const def = RuneRegistry.getRune(runeId);
    if (!def) return;

    const now = Date.now();
    if (now - this.lastRuneCastAt < 1000) {
      ctx.playerState.emit("message", t_game("msg_rune_cooldown_active"));
      return;
    }

    const targetEnemy = ctx.enemies.get(targetEnemyUid);
    if (!targetEnemy || targetEnemy.isDead) return;

    this.lastRuneCastAt = now;

    // Build projectile mesh (same as castRune3d)
    const hexColor = def.effect3d?.color ?? "#ff5500";
    const projMat = new StandardMaterial("rune_proj_mat_" + now, ctx.scene);
    projMat.emissiveColor = Color3.FromHexString(hexColor);
    projMat.disableLighting = true;

    const proj = MeshBuilder.CreateSphere(
      "rune_proj_" + now,
      { diameter: 0.18, segments: 4 },
      ctx.scene,
    );
    proj.material = projMat;
    proj.position = ctx.player.position.clone();
    proj.position.y += 0.3;

    const speed = def.effect3d?.speed ?? 14;
    const impactRadius = def.effect3d?.radius ?? 1.0;

    // Animate projectile
    const finalTarget = targetEnemy;
    const removeObs = ctx.scene.onBeforeRenderObservable.add(() => {
      const dt = ctx.scene.getEngine().getDeltaTime() / 1000;
      const toTarget = finalTarget.worldPos.subtract(proj.position);
      const dist = toTarget.length();
      if (dist < 0.2) {
        if (finalTarget.isDead) {
          proj.dispose();
          projMat.dispose();
          ctx.scene.onBeforeRenderObservable.remove(removeObs);
          ctx.playerState.gainIntelligenceExperience(10);
          ctx.playerState.log(
            "combat_gained_skill_xp",
            { skill: "Intelligence", amount: 10 },
            "#34d399",
          );
          return;
        }

        // Impact: apply damage
        const playerInt = ctx.playerState.getIntelligenceData().level;
        const dmg = RuneRegistry.calculateDamage(
          runeId,
          ctx.playerState.getLevel(),
          playerInt,
        );

        const damage = Math.max(
          1,
          dmg.min + Math.floor(Math.random() * (dmg.max - dmg.min + 1)),
        );
        this.applyRuneDamageToEnemy(finalTarget, damage, runeId);

        // Impact flash
        const flashMat = new StandardMaterial("rune_flash_" + now, ctx.scene);
        flashMat.emissiveColor = Color3.FromHexString(hexColor);
        flashMat.wireframe = true;
        const flash = MeshBuilder.CreateSphere(
          "rune_flash_mesh_" + now,
          { diameter: impactRadius * 2, segments: 4 },
          ctx.scene,
        );
        flash.material = flashMat;
        flash.position = finalTarget.worldPos.clone();
        let flashAge = 0;
        const flashObs = ctx.scene.onBeforeRenderObservable.add(() => {
          flashAge += ctx.scene.getEngine().getDeltaTime() / 1000;
          flash.scaling.setAll(1 + flashAge * 4);
          const alpha = Math.max(0, 1 - flashAge / 0.3);
          flashMat.emissiveColor = Color3.FromHexString(hexColor).scale(alpha);
          if (flashAge > 0.3) {
            flash.dispose();
            flashMat.dispose();
            ctx.scene.onBeforeRenderObservable.remove(flashObs);
          }
        });

        // Remove rune from inventory
        const rune = ctx.playerState
          .getEnchantedRunes()
          .find((r) => r.runeId === runeId);
        if (rune && rune.count > 0) {
          rune.count--;
        }
        ctx.playerState.emit("runesUpdated");

        proj.dispose();
        projMat.dispose();
        ctx.scene.onBeforeRenderObservable.remove(removeObs);
      } else {
        const step = speed * dt;
        proj.position.addInPlace(
          toTarget.normalize().scale(Math.min(step, dist)),
        );
      }
    });

    ctx.playerState.emit("runeCasted");
    ctx.playerState.log("action_cast_rune", { runeId }, "#ff8800");
  }
}
