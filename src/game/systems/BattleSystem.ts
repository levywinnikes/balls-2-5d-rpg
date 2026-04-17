import Player from "../entities/Player";
import { ItemType } from "../../config/ItemConstants";

import { PlayerState } from "../entities/Player/PlayerState";
import { FloatingText } from "../effects/FloatingText";
import { EnemyRegistry } from "../entities/EnemyRegistry";
import Enemy from "../entities/Enemy";
import Dragon from "../entities/Dragon";
import GameScene from "../scenes/GameScene";
import { SkillLevelUpAnimation } from "../effects/SkillLevelUpAnimation";
import { BloodSystem } from "./BloodSystem";
import { AudioManager } from "./AudioManager";
import { StatManager } from "./StatManager";
// Actually BattleSystem doesn't have React Context.
// We can check localStorage directly OR instantiate with config.
// Let's check config during emit.
import { t_game } from "../i18n/translations";

type BattleParticipant = Player | Enemy;

export default class BattleSystem {
  private scene: Phaser.Scene;
  private battleLog: string[] = [];
  private bloodSystem: BloodSystem;

  private player: Player;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.bloodSystem = new BloodSystem(scene);
  }

  public spawnEnemy(x: number, y: number, type: string): Enemy {
    if (type === "dragon") {
      return new Dragon(this.scene, x, y);
    }
    const enemy = new Enemy(this.scene, x, y, type);
    return enemy;
  }
  public startBattle(
    attacker: BattleParticipant,
    target: BattleParticipant
  ): void {
    try {
      if (attacker instanceof Player && target instanceof Enemy) {
        if (target.health <= 0) return; // Prevent attacking dead enemies
        if (this.canPlayerAttack(target)) {
          this.handlePlayerAttack(attacker, target);
        } else {
          new FloatingText(
            this.scene,
            target.sprite.x,
            target.sprite.y - 20,
            "🛡️", // Blocked
            true
          );
          this.logBattle("combat_blocked_enemy", { target: target.enemyType });
        }
      } else if (attacker instanceof Enemy && target instanceof Player) {
        this.handleEnemyAttack(attacker, target);
      }
    } catch (error) {
      console.error("Erro durante a batalha:", error);
      // System errors stay in English or generic
      this.logBattle(`Battle error: ${error}`);
    }
  }

  // No método handleEnemyAttack da BattleSystem
  private handleEnemyAttack(enemy: Enemy, player: Player): void {
    const attackRange = enemy.attackRange;
    const distance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, player.sprite.x, player.sprite.y);
    console.log(`[COMBAT:LOG] Enemy ${enemy.id} (${enemy.enemyType}) attacking player. Dist: ${distance.toFixed(1)}px, Range: ${attackRange}px`);

    const attackDamage = enemy.getDamage();
    const playerDefense = player.getTotalDefense();
    
    // Check if it's a fire attack (e.g., from a Dragon)
    const isFire = enemy.enemyType === "dragon"; // TODO: Map this better if more enemies use fire

    // Roll de defesa (1 a defesa total)
    const defenseRoll = Phaser.Math.Between(1, playerDefense);

    // Roll de ataque (1 a dano do inimigo)
    const attackRoll = Phaser.Math.Between(1, attackDamage);

    let damageMitigation = 0;

    // Se o roll de defesa for maior ou igual ao de ataque
    if (defenseRoll >= attackRoll) {
      if (isFire) {
          // Dano de fogo: Usa a eficiência de bloqueio do escudo equipado
          const shield = player.getEquippedShield();
          damageMitigation = shield?.defenseResistances?.fire || 0;
          
          // MOSTRAR ESCUDO mesmo sendo bloqueio parcial
          new FloatingText(this.scene, player.sprite.x, player.sprite.y - 20, "🛡️", false, "#00FFFF");
          this.logBattle("combat_partially_blocked_player", { target: enemy.enemyType }, "#aaaaaa");
          
          // Se anular 100%, para aqui. Se não, continua para mostrar o dano que passou.
          if (damageMitigation >= 1) {
              AudioManager.getInstance().playBlock();
              return;
          }
      } else {
          // Ganha experiência de defesa (Bloqueio Total)
          const defenseExp = enemy.getDefenseExp(); 
          const totalReflexXp = defenseExp + attackRoll; 
          player.gainReflexExperience(totalReflexXp);

          new FloatingText(this.scene, player.sprite.x, player.sprite.y - 20, "🛡️", false, "#00FFFF");
          this.logBattle("combat_blocked_player", { target: enemy.enemyType, xp: totalReflexXp }, "#aaaaff");
          AudioManager.getInstance().playBlock();
          return;
      }
    }

    // Calcular dano base
    let damage = Math.max(1, attackDamage - Math.floor(defenseRoll / 2));
    
    if (damageMitigation > 0) {
        damage = Math.max(1, Math.round(damage * (1 - damageMitigation)));
    }

    // Resistência Elemental do Jogador (vindo do escudo/equips)
    if (isFire) {
        // Checar o escudo equipado
        const shield = player.getEquippedShield();
        if (shield && shield.resistances?.fire !== undefined) {
             damage = Math.round(damage * (1 - shield.resistances.fire));
        }
        // TODO: Player base resistance or other armor pieces
    }

    // --- NOVA LÓGICA DE ARMADURA ---
    const armor = player.getTotalArmor();
    if (armor > 0) {
        const minReduction = Math.ceil(armor * 0.1);
        const armorReduction = Phaser.Math.Between(minReduction, armor);
        
        const originalDamage = damage;
        damage = Math.max(0, damage - armorReduction);

        if (originalDamage > 0 && damage === 0) {
            new FloatingText(this.scene, player.sprite.x, player.sprite.y - 20, "🛡️ Armor", false, "#C0C0C0");
            this.logBattle("combat_blocked_armor_player", { target: enemy.enemyType }, "#aaaaaa");
            return;
        }
    }
    // --------------------------------

    player.takeDamage(damage);

    if (damage > 0) {
        new FloatingText(this.scene, player.sprite.x, player.sprite.y - (damageMitigation > 0 ? 60 : 20), -damage, false, isFire ? "#FF4500" : undefined, isFire ? "🔥" : undefined);
        this.logBattle("combat_damage_taken", { damage, target: enemy.enemyType }, "#ff4444");
        
        if (isFire) {
            AudioManager.getInstance().playFireHit();
        } else {
            AudioManager.getInstance().playAttack();
        }

        // PLAYER BLOOD
        if (localStorage.getItem("tgs_settings_blood") !== "false") {
             const maxHp = player.getMaxHealth();
             this.bloodSystem.emitBlood(player.sprite.x, player.sprite.y, damage, maxHp, 0xff0000);
        }
    }
  }

  private handleReflexSkillLevelUp(player: Player): void {
    const scene = this.scene as GameScene;
    new SkillLevelUpAnimation(
      scene,
      player.sprite.x,
      player.sprite.y - 30,
      "Reflex",
      player.getReflexLevel()
    );
  }

  private isInAttackRange(
    attacker: BattleParticipant,
    target: BattleParticipant
  ): boolean {
    const distance = this.getDistance(attacker, target);

    // Usa o attackRange específico de cada classe
    const requiredRange =
      attacker instanceof Player
        ? (attacker as Player).getAttackRange() // Pega do Player
        : (attacker as Enemy).attackRange; // Pega do Enemy

    return distance <= requiredRange;
  }

  private getDistance(a: BattleParticipant, b: BattleParticipant): number {
    return Phaser.Math.Distance.Between(
      a.sprite.x,
      a.sprite.y,
      b.sprite.x,
      b.sprite.y
    );
  }

  private canPlayerAttack(target: Enemy): boolean {
    return this.player.canAttack(target);
  }

  private handlePlayerAttack(player: Player, enemy: Enemy): void {
    const weapon = player.getEquippedWeapon();
    const isFire = weapon?.element === "fire";

    // 1. Pegar o ataque máximo do jogador (STAT, não roll)
    const maxAttack = player.getAttackStats();
    const attackRoll = Phaser.Math.Between(1, maxAttack);

    // 2. Pegar a defesa do inimigo
    const maxDefense = enemy.getDefense();
    const defenseRoll = Phaser.Math.Between(1, maxDefense);

    let damageMitigation = 0; // 0 to 1 scale

    // 3. Verificar Defesa
    if (attackRoll <= defenseRoll) {
      if (isFire) {
          // Dano de fogo: Usa a eficiência de bloqueio configurada (ex: 0.10 para 10% de anulação)
          damageMitigation = enemy.getDefenseResistance("fire");
          
          // MOSTRAR ESCUDO mesmo sendo bloqueio parcial
          new FloatingText(this.scene, enemy.sprite.x, enemy.sprite.y - 20, "🛡️", false, "#00FFFF");
          this.logBattle("combat_partially_blocked", { target: enemy.enemyType }, "#aaaaaa");
          
          if (damageMitigation >= 1) {
              AudioManager.getInstance().playBlock();
              return;
          }
      } else {
          // Ataque normal: Bloqueio Total
          new FloatingText(this.scene, enemy.sprite.x, enemy.sprite.y - 20, "🛡️", false, "#00FFFF");
          this.logBattle("combat_blocked_enemy", { target: enemy.enemyType }, "#aaaaaa");
          AudioManager.getInstance().playBlock(); 
          return;
      }
    }

    // 4. Calcular Dano Base
    let damage = 0;
    const critChance = player.getCriticalChance();
    const isCritical = Phaser.Math.FloatBetween(0, 100) <= critChance;

    if (isCritical) {
        // CRITICAL HIT LOGIC
        // Min Damage = Max Attack
        // Max Damage = Max Attack * (1 + Strength%)
        const critMult = player.getCriticalDamageMultiplier();
        const minCrit = maxAttack;
        const maxCrit = Math.floor(maxAttack * (1 + critMult));
        
        damage = Phaser.Math.Between(minCrit, maxCrit);

        // XP Reward for Crit
        player.gainStrengthExperience(100);
        player.gainDexterityExperience(100);
        
        // Log
        console.log(`[Combat] CRITICAL HIT! Chance: ${critChance.toFixed(1)}% Dmg: ${damage} (Range: ${minCrit}-${maxCrit})`);
        this.logBattle("combat_critical_hit", { damage }, "#ff00ff"); // Magenta for crit
    } else {
        // Normal Hit
        damage = Phaser.Math.Between(1, maxAttack);
    }
    
    // Aplicar mitigação da defesa (se houver)
    if (damageMitigation > 0) {
        damage = Math.max(1, Math.round(damage * (1 - damageMitigation)));
    }

    // 5. Resistência Elemental do Inimigo
    if (isFire) {
        const fireRes = enemy.getResistance("fire");
        // Dano = Dano * (1 - Resistencia)
        damage = Math.round(damage * (1 - fireRes));
    }

    // --- NOVA LÓGICA DE ARMADURA (Inimigo) ---
    const armor = enemy.getArmor();
    if (armor > 0) {
        const minReduction = Math.ceil(armor * 0.1);
        const armorReduction = Phaser.Math.Between(minReduction, armor);
        const originalDamage = damage;
        damage = Math.max(0, damage - armorReduction);

        if (originalDamage > 0 && damage === 0) {
             new FloatingText(
                this.scene,
                enemy.sprite.x,
                enemy.sprite.y - 20,
                "🛡️ Armor",
                false,
                "#C0C0C0"
            );
            // Gain XP for "blocked hit" (using calculated damage before full mitigation? or 0?)
            // If it was fully blocked by armor, technically damage was 0.
            // But let's afford the base XP at least.
            this.gainCombatExperience(player, 0); 
            this.logBattle("combat_blocked_armor_enemy", { target: enemy.enemyType }, "#aaaaaa");
            return;
        }
    }
    // --------------------------------------------

    // Capture HP before damage for XP calculation
    const enemyHp = enemy.getHealth();
    // Clamp effective damage to 0. If enemyHP is negative (dying), bonus should be 0, not negative.
    const effectiveDamage = Math.max(0, Math.min(damage, enemyHp)); 

    const isDead = enemy.takeDamage(damage);

    // Mostrar dano
    if (damage > 0) {
        const weapon = player.getEquippedWeapon();
        const isFire = weapon?.element === "fire";

        let icon = undefined;
        let color = undefined;

        if (isCritical) {
            icon = "💔";
            color = "#ff00ff"; // Macintosh/Magenta for Crit
        } else if (isFire) {
            icon = "🔥";
            color = "#FF4500";
        }

        new FloatingText(
            this.scene,
            enemy.sprite.x,
            enemy.sprite.y - (damageMitigation > 0 ? 60 : 20),
            -damage, // Pass negative for damage visual
            false,
            color,
            icon
        );
        this.logBattle("combat_damage_dealt", { damage: damage, target: enemy.enemyType }, "#ffffff");
        
        if (isCritical) {
            AudioManager.getInstance().playCritical();
        } else if (isFire) {
            AudioManager.getInstance().playFireHit();
        } else {
            AudioManager.getInstance().playAttack(); // Swipe + Impact
        }
        
        // BLOOD EFFECT
        if (localStorage.getItem("tgs_settings_blood") !== "false") {
             const isFireKill = isDead && isFire;
             const bloodColor = isFireKill ? 0x222222 : enemy.getBloodColor();
             const maxHp = EnemyRegistry.getEnemyDefinition(enemy.enemyType)?.health || 100;
             
             // Standard Blood
             this.bloodSystem.emitBlood(enemy.sprite.x, enemy.sprite.y, damage, maxHp, bloodColor);
             
             // Persistent Trail (Rastro) - Scale with Damage
             const damagePct = damage / maxHp;
             let poolCount = 1;
             let poolScale = 1.0;

             if (damagePct > 0.5) {
                 poolCount = 7; // MESSY
                 poolScale = 2.5; 
             } else if (damagePct > 0.2) {
                 poolCount = 3;
                 poolScale = 1.5;
             }

             this.bloodSystem.emitPersistentBlood(
                 enemy.sprite.x + Phaser.Math.Between(-15, 15), 
                 enemy.sprite.y + Phaser.Math.Between(-15, 15), 
                 bloodColor,
                 poolCount,
                 poolScale,
                  damage > (maxHp * 0.5)
             );
        }
    }

    // Ganhar experiência
    // Bonus XP based on effective damage (capped by enemy HP)
    this.gainCombatExperience(player, effectiveDamage);

    // Verificar se inimigo morreu
    if (isDead) {
      // Check for Overkill / Shatter
      // If damage was > 50% of Max Health, we consider it a "Strong Finish" -> Shatter
      // Or stick to user's 200%? 200% is huge. Let's do > 50% for visual satisfaction test.
      const maxHp = EnemyRegistry.getEnemyDefinition(enemy.enemyType)?.health || 100;
      const overkill = damage > (maxHp * 0.5);
      const isFireKill = isFire;

      if (overkill && localStorage.getItem("tgs_settings_blood") !== "false") {
          this.bloodSystem.emitShatter(enemy.sprite.x, enemy.sprite.y, enemy.getBloodColor(), isFireKill);
          AudioManager.getInstance().playSplash();
          // Hide sprite immediately to simulate disintegration
          enemy.sprite.setVisible(false);
      }

      this.handleEnemyDeath(enemy, player);
    }
  }

  private gainCombatExperience(player: Player, damageDealt: number = 0): void {
    const weapon = player.getEquippedWeapon();
    const weaponBaseXp = weapon ? weapon.exp_skill : 100;
    
    // New Scaling Logic
    const flatBonus = player.getExpPerHit(); // Flat XP per hit (e.g. +5)
    const damagePercent = player.getExpDamagePercent(); // Percent (e.g. 15 = 15%)
    
    // Formula: Base + Flat + (Damage * (1 + Percent/100))
    const damageXp = damageDealt * (1 + (damagePercent / 100));
    
    const totalXp = Math.floor(weaponBaseXp + flatBonus + damageXp);

    console.log('[Combat XP Debug]', {
      weapon: weapon?.id || 'none',
      weaponType: weapon?.type,
      weaponElement: weapon?.element,
      damageDealt,
      totalXp,
      weaponBaseXp,
      flatBonus,
      damagePercent
    });

    if (weapon?.element === "fire") {
      console.log('[Combat XP] Giving Intelligence XP (Fire weapon):', totalXp);
      player.gainIntelligenceExperience(totalXp);
      this.logBattle("combat_gained_skill_xp", { skill: "Intelligence", amount: totalXp }, "#34d399");
    } else if (!weapon || weapon.type === ItemType.SWORD || weapon.type === ItemType.AXE || weapon.type === ItemType.CLUB) {
      console.log('[Combat XP] Giving Strength XP (Melee weapon):', totalXp);
      player.gainStrengthExperience(totalXp);
      this.logBattle("combat_gained_skill_xp", { skill: "Strength", amount: totalXp }, "#34d399");
    } else if (weapon.type === ItemType.DISTANCE) {
      console.log('[Combat XP] Giving Dexterity XP (Ranged weapon):', totalXp);
      player.gainDexterityExperience(totalXp);
      this.logBattle("combat_gained_skill_xp", { skill: "Dexterity", amount: totalXp }, "#34d399");
    } else {
      console.warn('[Combat XP] Unknown weapon type, defaulting to Strength:', weapon.type, totalXp);
      player.gainStrengthExperience(totalXp);
      this.logBattle("combat_gained_skill_xp", { skill: "Strength", amount: totalXp }, "#34d399");
    }
  }

  private handleEnemyDeath(enemy: Enemy, player: Player): void {
    const enemyDef = EnemyRegistry.getEnemyDefinition(enemy.enemyType);
    const xpReward = enemyDef?.exp || 10;
    player.gainExperience(xpReward);

    // xp notification is now centralized in PlayerState.gainExperience
    this.logBattle("combat_killed", { target: enemy.enemyType }, "#ffaa00");
    this.logBattle("combat_gained_xp", { xp: xpReward }, "#ffff00");

    // Call Scene Handler for Loot/Death Lifecycle (Fix for Bug #123)
    if (this.scene instanceof GameScene) {
        try {
            (this.scene as GameScene).handleEnemyDeath(enemy);
        } catch (e) {
            console.error("Failed to call GameScene.handleEnemyDeath:", e);
        }
    }
  }

  private logBattle(key: string, params: any = {}, color: string = "#ccc"): void {
    // We store the key/param structure in local battle log too if viewed?
    // Actually battleLog string array is less useful now, maybe we deprecate it or store strings? 
    // For now we push the raw key to local log (debug) and emit formatted event.
    this.battleLog.push(key); 
    if (this.battleLog.length > 20) this.battleLog.shift();
    PlayerState.getInstance().log(key, params, color);
  }

  public getBattleLog(): string[] {
    return [...this.battleLog]; // Retorna cópia do array
  }

  public cleanup(): void {
    this.battleLog = [];
  }

  // --- MAGIC SYSTEM ---
  public castRuneEffect(runeId: string, x: number, y: number): void {
      const { RuneRegistry } = require("../magic/RuneRegistry");
      const def = RuneRegistry.getRune(runeId);
      if (!def) return;

      const element = def.damage.element || "fire";
      const isStar = element === "star";
      const ps = PlayerState.getInstance();
      const gameScene = this.scene as GameScene;

      // 0. WALL CHECK (Raycast Validation)
      // Check if line of sight is blocked by walls
      // We check from Player Center to Target Center
      const startX = this.player.sprite.x;
      const startY = this.player.sprite.y;
      const currentLevel = gameScene.registry.get("currentLevel") || "0"; 

      const hasLos = gameScene.mapLoader.checkLineOfSight(startX, startY, x, y, currentLevel);

      if (!hasLos) {
          ps.emit("message", t_game("msg_target_obstructed" as any));
          new FloatingText(this.scene, this.player.sprite.x, this.player.sprite.y - 40, "🚫", true, "#ff0000");
          
          // REFUND CHARGE ("Não perder o gatilho/item")
          // Logic: The item was already consumed by logic before calling this. We must add it back.
          const existingRune = ps.enchantedRunes.find(r => r.runeId === runeId);
          if (existingRune) {
              existingRune.count++;
          } else {
              ps.enchantedRunes.push({ runeId, count: 1 });
          }
          ps.emit("runesUpdated");
          return; // STOP HERE
      }

      // 1. Calculate Base Damage (Variable part done on impact? No, let's roll now for consistency or inside impact?)
      // Rolling inside impact is better to ensure state at impact time, but rolling now is fine too.
      // Let's keep damage calc here to pass to projectile as "payload" or closure.

      // 2. Determine Projectile Type & Target
      let targetEntity: Enemy | null = null;
      let targetPos = { x, y };
      let projectileType: "homing" | "linear" = "linear";

      const enemies = gameScene.getActiveEnemies();
      
      if (isStar) {
          projectileType = "homing";
          // Find closest enemy to click
          let closest: Enemy | null = null;
          let closestDist = Infinity;
          const clickTolerance = 64; // 2 tiles

          if (enemies) {
              enemies.forEach(e => {
                  if (e.isDefeated() || !e.sprite || !e.sprite.active) return;
                  const dist = Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y);
                  if (dist <= clickTolerance && dist < closestDist) {
                      closest = e;
                      closestDist = dist;
                  }
              });
          }

          if (closest) {
              targetEntity = closest;
              targetPos = { x: (closest as Enemy).sprite.x, y: (closest as Enemy).sprite.y };
          } else {
              // No target for Star Rune -> Refund
              ps.emit("message", t_game("msg_star_rune_no_target" as any));
              const existingRune = ps.enchantedRunes.find(r => r.runeId === runeId);
              if (existingRune) existingRune.count++;
              else ps.enchantedRunes.push({ runeId, count: 1 });
              ps.emit("runesUpdated");
              return;
          }
      } else {
          // Fire Burst (Linear)
          projectileType = "linear";
          targetPos = { x: x, y: y };
      }

      // 3. Spawn Projectile
      const { RuneProjectile } = require("../entities/projectiles/RuneProjectile");
      // Use the group if possible, or new instance
      // gameScene.projectiles.get(...) might need casting or custom group logic. 
      // Safest is `new RuneProjectile(...)` and add to group or let it add itself.
      // In RuneProjectile constructor we did `scene.add.existing`.
      
      const projectileTexture = def.graphic.texture || `rune_proj_${element}`;

      const projectile = new RuneProjectile(
          this.scene,
          startX,
          startY,
          projectileTexture,
          targetEntity,
          targetPos,
          projectileType,
          (impactTarget: Enemy | null) => {
              this.applyRuneImpact(runeId, impactTarget, isStar ? null : targetPos, def, isStar);
          }
      );
      
      // Add collision with Enemies
      if (enemies) {
          // We need a group for enemies? `enemies` is just an array.
          // GameScene has `enemiesByLevel` map.
          // We can construct a temp array or use physics.overlap with array.
          const activeSprites = enemies.map(e => e.sprite).filter(s => s && s.active);
          
          this.scene.physics.add.overlap(projectile, activeSprites, (obj1, obj2) => {
               const proj = obj1 as any; // RuneProjectile
               const enemySprite = obj2 as Phaser.Physics.Arcade.Sprite;
               const enemy = enemies.find(e => e.sprite === enemySprite);
               
               if (enemy && proj.active) {
                   proj.handleImpact(enemy);
               }
          });
      }
      
      projectile.launch();
      
      // Play Launch Sound
      if (isStar) AudioManager.getInstance().playStarHit(); // Launch sound? Using Hit for now
      else AudioManager.getInstance().playFireHit();
  }

  // Extracted Impact Logic
  private applyRuneImpact(runeId: string, hitEnemy: Enemy | null, groundPos: {x:number, y:number} | null, def: any, isStar: boolean) {
      const { RuneRegistry } = require("../magic/RuneRegistry");
      const ps = PlayerState.getInstance();
      const element = def.damage.element || "fire";
      const gameScene = this.scene as GameScene;

      // 1. Calculate Damage (Standard/Star)
      let dmg = 0;
      if (isStar) {
          const starData = StatManager.getInstance().calculateStarPoints(ps);
          dmg = RuneRegistry.calculateStarRuneDamage(starData.totalPoints);
      } else {
          const damageRange = RuneRegistry.calculateDamage(runeId, this.player.getLevel(), this.player.getIntelligenceLevel());
          dmg = Phaser.Math.Between(damageRange.min, damageRange.max);
      }

      // Willpower Bonus
      const willpowerBonusPct = this.player.getWillpowerBonusPercent ? this.player.getWillpowerBonusPercent() : 0; 
      const boostedDmg = Math.round(dmg * (1 + willpowerBonusPct / 100.0));

      const targets: Enemy[] = [];

      if (hitEnemy) {
          // Direct Hit (Interception or Homing)
          // If it is Linear (Area) but hit an enemy directly -> "Premature Detonation"
          // Does it explode Area around the HIT ENEMY? Or just single target?
          // User: "Explode no Inimigo (Detonação Prematura)"
          // User: "Explode no Chão (Dano em Área)"
          // Implies area damage logic applies in BOTH cases, centered on impact point.
          
          if (isStar) {
              targets.push(hitEnemy);
          } else {
              // Fire Burst: Area around the HIT ENEMY
              // Recalculate area neighbors
              const radiusTiles = def.damage.area?.radius || 1;
              const realRadius = radiusTiles * gameScene.mapLoader.getTileSize();
              const impactX = hitEnemy.sprite.x;
              const impactY = hitEnemy.sprite.y;

              const levelEnemies = gameScene.getActiveEnemies();
              levelEnemies.forEach((e: Enemy) => {
                  if (e.isDefeated() || !e.sprite?.active) return;
                  if (Phaser.Math.Distance.Between(impactX, impactY, e.sprite.x, e.sprite.y) <= realRadius) {
                      targets.push(e);
                  }
              });
          }
      } else if (groundPos && !isStar) {
          // Ground Hit (Area)
           const radiusTiles = def.damage.area?.radius || 1;
           const realRadius = radiusTiles * gameScene.mapLoader.getTileSize();
           const levelEnemies = gameScene.getActiveEnemies();
           levelEnemies.forEach((e: Enemy) => {
               if (e.isDefeated() || !e.sprite?.active) return;
               if (Phaser.Math.Distance.Between(groundPos.x, groundPos.y, e.sprite.x, e.sprite.y) <= realRadius) {
                   targets.push(e);
               }
           });
           
           // Visual for Ground Hit
           new FloatingText(this.scene, groundPos.x, groundPos.y, "💥", true, "#FF4500"); // Explosion
      }

      if (targets.length === 0 && !groundPos) {
           // Missed everything?
      }

      // Apply Damage to Targets
      targets.forEach(enemy => {
           // ... (Reused existing damage logic)
            const initialHp = enemy.getHealth();
            const enemyX = enemy.sprite.x;
            const enemyY = enemy.sprite.y;
            let finalDamage = boostedDmg;

            if (!isStar) {
                const res = enemy.getResistance(element);
                finalDamage = Math.round(finalDamage * (1 - res));
            }

            const wasDead = enemy.takeDamage(finalDamage);

            // Feedback
            if (isStar) {
                new FloatingText(this.scene, enemyX, enemyY - 40, -finalDamage, false, "#FFD700", "⭐");
                this.logBattle("combat_damage_dealt", { damage: finalDamage, target: enemy.enemyType }, "#FFD700");
            } else {
                new FloatingText(this.scene, enemyX, enemyY - 40, -finalDamage, false, "#FF4500", "🔥");
                this.logBattle("combat_damage_dealt", { damage: finalDamage, target: enemy.enemyType }, "#ff4444");
            }

            // Blood/FX
             if (localStorage.getItem("tgs_settings_blood") !== "false") {
                const maxHp = EnemyRegistry.getEnemyDefinition(enemy.enemyType)?.health || 100;
                if (isStar && wasDead) {
                    this.bloodSystem.emitGlitter(enemyX, enemyY);
                    AudioManager.getInstance().playOverkillStar();
                } else if (wasDead && element === "fire" && finalDamage > (maxHp * 0.5)) {
                    this.bloodSystem.emitShatter(enemyX, enemyY, 0x222222, true);
                } else {
                    this.bloodSystem.emitBlood(enemyX, enemyY, finalDamage, maxHp, isNaN(enemy.getBloodColor()) ? 0xff0000 : enemy.getBloodColor());
                }
            }

            // XP
            const actualDamageDealt = Math.min(finalDamage, initialHp);
            const xpGain = 100 + actualDamageDealt;
            this.player.gainIntelligenceExperience(xpGain);
            
            if (wasDead) {
                this.handleEnemyDeath(enemy, this.player);
            }
      });
  }
}
