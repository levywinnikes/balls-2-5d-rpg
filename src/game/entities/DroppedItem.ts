// DroppedItem.ts
import Phaser from "phaser";
import { WeaponRegistry } from "../entities/weapons/WeaponRegistry";
import { PlayerState } from "../entities/Player/PlayerState";
import { InventorySystem } from "../systems/InventorySystem";
import { MultiLevelMapData } from "../maps/MapTypes";
import { MapLoader } from "../maps/MapLoader";
import { t_game } from "../i18n/translations";
import { TileRegistry } from "../graphics/tiles/TileRegistry";
import { ContainerRegistry } from "./containers/ContainerRegistry";
import { AudioManager } from "../systems/AudioManager";

export class DroppedItem extends Phaser.Physics.Arcade.Sprite {
  public readonly uid: string = Phaser.Utils.String.UUID();
  public itemId: string;
  public weaponId: string;
  public level: string;
  public createdAt: number = 0; // Public for SaveSystem
  public count: number = 1;
  public stars: number = 0;
  public attributes: any[] = [];

  public starParticles: any = null;
  private isBeingDragged: boolean = false;
  private isHovered: boolean = false;
  private tooltipActive: boolean = false;
  public originalPosition: { x: number; y: number } = { x: 0, y: 0 };
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private isDraggable: boolean = true;
  private isDestroyed: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    weaponId: string,
    level: string,
    createdAt?: number, // Optional param for persistence
    count: number = 1,
    stars: number = 0,
    attributes: any[] = [],
  ) {
    // Primeiro, determinar qual textura usar
    const weaponDef = WeaponRegistry.getWeaponDefinition(weaponId);
    let textureKey: string;

    if (!weaponDef) {
      console.error(`Weapon ${weaponId} not found, using default sprite`);
      textureKey = "default_item";
    } else {
      const sprite = WeaponRegistry.createWeaponGraphic(scene, weaponId);
      if (scene.textures.exists(sprite.texture.key)) {
        textureKey = sprite.texture.key;
      } else {
        console.warn(
          `Texture ${sprite.texture.key} missing for ${weaponId}. Using default.`,
        );
        // Fallback to a known safe texture or maintain current logic if "items" sprite sheet is used
        // Actually, createWeaponGraphic returns a Sprite. If texture is missing, Sprite might be blank.
        // Let's trust logic below if we didn't want to use createWeaponGraphic's return key blindly?
        // No, the original code used sprite.texture.key.
        textureKey = "default_item";
        // If "default_item" doesn't exist, we might have another error, but better than crashing later?
        // Actually, we can check if "items" exists.
        if (scene.textures.exists("items")) textureKey = "items";
      }
      sprite.destroy(); // Destruir o sprite temporário
    }

    // Chamada única do super()
    super(scene, x, y, textureKey);
    this.itemId = Phaser.Math.RND.uuid(); // Assign unique ID
    this.weaponId = weaponId;
    this.level = level;
    this.count = count;
    this.stars = stars;
    this.attributes = attributes;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Initialize createdAt from param OR current time (new drop)
    this.createdAt = createdAt || Date.now();

    // --- VISUAL EFFECT FOR STARS ---
    // REMOVED at user request (no glow/particles)
    if (this.stars > 0) {
      // Kept empty block or just removed logic to avoid visual noise
    }

    // Forçar tamanho visual fixo independente da resolução da imagem original
    this.setDisplaySize(24, 24); // ~75% do tile de 32px

    if (this.body) {
      // Ajustar corpo físico para corresponder melhor ao tamanho visual
      this.body.setSize(20, 20);
      this.body.setOffset(2, 2); // Centralizar no sprite de 24px
    }

    // Configurar interatividade para arraste
    this.setInteractive({ draggable: true });
    this.setupDragEvents();

    this.updateDepth();

    // --- ANIMATION SUPPORT ---
    if (this.weaponId === "light_torch") {
      const torchFrames = [
        "light_torch_1",
        "light_torch_2",
        "light_torch_3",
        "light_torch_4",
      ];
      const hasTorchFrames = torchFrames.every((key) =>
        scene.textures.exists(key),
      );

      if (hasTorchFrames) {
        try {
          if (!scene.anims.exists("light_torch_anim")) {
            scene.anims.create({
              key: "light_torch_anim",
              frames: torchFrames.map((key) => ({ key })),
              frameRate: 5,
              repeat: -1,
            });
          }
          this.play("light_torch_anim");
        } catch (error) {
          console.error(
            "[DroppedItem] Failed to initialize light_torch animation",
            error,
          );
        }
      }
    }
  }

  public update(time: number, delta: number): void {
    if (this.isDestroyed || !this.scene) return;

    // Decay Logic
    // Containers NEVER decay
    const def = WeaponRegistry.getWeaponDefinition(this.weaponId);

    // --- TOOLTIP LOGIC (CTRL KEY) ---
    if (this.isHovered) {
      // Access Ctrl Key from GameScene OR ActivePointer
      let ctrlPressed = (this.scene as any).ctrlKey?.isDown;

      // Fallback: Check active pointer event (Works well for hover-while-holding)
      if (!ctrlPressed && this.scene.input.activePointer) {
        const event = this.scene.input.activePointer.event as MouseEvent;
        if (event && event.ctrlKey) {
          ctrlPressed = true;
        }
      }

      if (ctrlPressed && !this.tooltipActive) {
        // SHOW TOOLTIP
        const playerState = PlayerState.getInstance();
        // Calculate Decay Time for display
        const age = Date.now() - (this.createdAt || 0);
        const DECAY_TIME = 80 * 1000;
        const timeLeftMs = Math.max(0, DECAY_TIME - age);
        const timeLeftSec = Math.floor(timeLeftMs / 1000);

        playerState.requestItemTooltip({
          itemId: this.itemId,
          weaponId: this.weaponId,
          x: this.x,
          y: this.y,
          def: def,
          timeLeft: timeLeftSec,
          stars: this.stars,
          attributes: this.attributes,
        });
        this.tooltipActive = true;
      } else if (!ctrlPressed && this.tooltipActive) {
        // HIDE TOOLTIP
        PlayerState.getInstance().clearItemTooltip();
        this.tooltipActive = false;
      }
    }

    if (def?.type === "container") {
      return;
    }

    if (!this.createdAt) {
      this.createdAt = Date.now();
    }

    const age = Date.now() - (this.createdAt || 0);
    const DECAY_TIME = 5 * 60 * 1000; // 5 minutes
    const BLINK_TIME = 4 * 60 * 1000; // 4 minutes

    if (age > DECAY_TIME) {
      // Destroy Item (Smoother: Fade + Shrink)
      if (!(this as any).isDecaying) {
        (this as any).isDecaying = true;

        // Stop blinking tween if running
        if (this.scene.tweens.isTweening(this)) {
          this.scene.tweens.killTweensOf(this);
        }

        this.scene.tweens.add({
          targets: this,
          alpha: 0,
          scaleX: 0,
          scaleY: 0,
          y: this.y + 10, // Sinks into ground slightly
          duration: 1500, // Slower fade
          ease: "Power2",
          onComplete: () => {
            const playerState = PlayerState.getInstance();
            // Ensure we remove it from persistence BEFORE destroying
            playerState.removePersistentDroppedItem(this.level, this.itemId);
            this.destroy();
          },
        });
      }
    } else if (age > BLINK_TIME) {
      // Blink Red + Heartbeat (Pumping)
      if (!(this as any).isBlinking) {
        (this as any).isBlinking = true;

        // Base scale is whatever setDisplaySize set it to.
        // We use a relative scale tween or just a small multiplier if we knew the base.
        // Safest is to oscillate slightly around current scale.

        this.scene.tweens.add({
          targets: this,
          tint: 0xff0000,
          scaleX: this.scaleX * 0.9,
          scaleY: this.scaleY * 0.9,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }

    // Depth Update during drag or idle
    if (this.isBeingDragged) {
      this.setDepth(99999);
    } else {
      this.updateDepth();
    }
  }

  private setupDragEvents(): void {
    // Helper para validar interação (Distância + LoS + Z-Level)
    const validateInteraction = (): boolean => {
      const scene = this.scene as any; // Cast to access player
      if (!scene.player) return false;

      const playerState = PlayerState.getInstance();

      // Z-Level Check FIRST
      // ParseInt used because level is string "0", "-1", etc.
      if (this.level !== playerState.getCurrentLevel()) {
        // Silent fail or message? User said "should not be clickable".
        // Silent is better for z-level mismatch usually.
        return false;
      }

      const dist = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        scene.player.sprite.x,
        scene.player.sprite.y,
      );

      if (dist > playerState.pickupRange) {
        playerState.emit("message", t_game("msg_too_far")); // Feedback visual
        return false;
      }

      if (!scene.player.checkLineOfSight(this.x, this.y)) {
        playerState.emit("message", t_game("msg_blocked"));
        return false;
      }
      return true;
    };

    // Evento quando começa a arrastar
    this.on("dragstart", (pointer: Phaser.Input.Pointer) => {
      if (!this.isDraggable) return;

      // VALIDAÇÃO DE ALCANCE NO DRAG
      if (!validateInteraction()) {
        // Precisamos cancelar o drag se falhar
        // Phaser não tem um "cancelDrag" explícito fácil aqui, mas podemos impedir a lógica de drag
        // Se retornarmos sem setar isBeingDragged = true, o evento 'drag' subsequente vai ignorar.
        return;
      }

      this.isBeingDragged = true;
      this.originalPosition = { x: this.x, y: this.y };

      // Calcular offset do mouse em relação ao sprite
      this.dragOffset.x = this.x - pointer.worldX;
      this.dragOffset.y = this.y - pointer.worldY;

      // Visual feedback
      this.setAlpha(0.7);
      this.setTint(0x888888);

      // Desativar física temporariamente
      if (this.body) {
        this.body.enable = false;
      }

      // Notify PlayerState (UI Drag)
      PlayerState.getInstance().startGroundDrag({
        item: {
          uid: this.itemId,
          itemId: this.itemId,
          weaponId: this.weaponId,
          x: this.x,
          y: this.y,
          level: this.level,
          count: this.count,
        },
        sprite: this,
      });

      // Clear tooltip if dragging
      PlayerState.getInstance().clearItemTooltip();

      // Listen for explicit reset (e.g. from UI drop failure OR walk-away cancel)
      const onResetDrag = () => {
        if (!this.isBeingDragged) return;

        // 1. Move back
        this.x = this.originalPosition.x;
        this.y = this.originalPosition.y;

        // 2. Restore Visuals
        this.setAlpha(1);
        this.clearTint();
        this.isBeingDragged = false;
        (this as any)._wasReset = true; // Flag for dragend to ignore

        // 3. Restore Physics
        if (this.body) {
          this.body.enable = true;
        }
        this.updateDepth();
      };
      PlayerState.getInstance().once("resetGroundDrag", onResetDrag);

      // Safety cleanup if drag ends normally without reset
      this.once("dragend", () => {
        PlayerState.getInstance().off("resetGroundDrag", onResetDrag);
      });
    });

    // Evento durante o arraste
    this.on(
      "drag",
      (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (!this.isBeingDragged) return;

        // FIXED: User requested "Ghost Only" drag.
        // The original sprite stays in place (placeholder) while the React DragGhost follows mouse.
        // We DO NOT update this.x / this.y here anymore.

        // this.x = dragX;
        // this.y = dragY;

        // We might want to ensure depth is high if we were moving it, but acting as placeholder
        // it should probably stay at normal depth or just slightly indicated?
        // Let's keep alpha change from dragstart but disable movement.
      },
    );

    // Evento quando solta o item
    this.on("dragend", (pointer: Phaser.Input.Pointer) => {
      if (!this.isBeingDragged) return;

      this.isBeingDragged = false;
      this.setAlpha(1.0);
      this.clearTint();

      // Check reset flag (Prioritize UI Drop success)
      if ((this as any)._wasReset) {
        // Logic handled by UI
        this.x = this.originalPosition.x;
        this.y = this.originalPosition.y;
        (this as any)._wasReset = false;
        if (this.body) (this.body as Phaser.Physics.Arcade.Body).enable = true;
        this.updateDepth();
        return;
      }

      // FIXED: Use Pointer Position for Drop Logic (since sprite stayed put)
      const dropX = pointer.worldX;
      const dropY = pointer.worldY;

      // Verificar se pode ser solto na nova posição
      if (this.isValidDropPosition(dropX, dropY)) {
        // Posição válida, mover para lá
        this.handleValidDrop(dropX, dropY); // Updated to accept coords
        this.showValidDropIndicator();
      } else {
        // Posição inválida, nada acontece visualmente além de resetar alpha
        this.showInvalidDropIndicator();

        // Restaurar aparência normal após breve feedback
        this.scene.time.delayedCall(500, () => {
          this.showNeutralAppearance();
        });
      }

      // Reativar física
      if (this.body) {
        this.body.enable = true;
      }

      this.updateDepth();
    });

    // INTERACTIONS (Click / Right Click)
    this.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const def = WeaponRegistry.getWeaponDefinition(this.weaponId);
      const isContainer = def?.type === "container";
      const isCtrl = this.scene.input.keyboard?.addKey(
        Phaser.Input.Keyboard.KeyCodes.CTRL,
      ).isDown;

      // 1. RIGHT CLICK HANDLER
      if (pointer.rightButtonDown()) {
        if (isCtrl) {
          // CTRL + RIGHT -> PICKUP
          if (validateInteraction()) {
            if (!isContainer) this.pickup();
            else
              PlayerState.getInstance().emit(
                "message",
                t_game("container_move_hint"),
              );
          }
        } else {
          // RIGHT CLICK (No Ctrl) -> CONTEXT MENU
          if (validateInteraction()) {
            const options: any[] = [];

            // Pick Up
            if (!isContainer) {
              options.push({
                label: t_game("action_pickup"),
                action: () => this.pickup(),
              });
            } else {
              // Container Options
              options.push({
                label: t_game("action_open"),
                action: () => {
                  let name = "Container";
                  const wDef = this.weaponId
                    ? WeaponRegistry.getWeaponDefinition(this.weaponId)
                    : null;
                  if (wDef) name = t_game(wDef.name as any);
                  else {
                    const cDef = ContainerRegistry.getContainer(this.itemId);
                    if (cDef) name = t_game(cDef.name as any);
                  }

                  PlayerState.getInstance().openContainer(
                    this.weaponId || `ground_${this.x}_${this.y}`,
                    this.itemId,
                    name,
                  );
                },
              });
            }

            // Inspect
            options.push({
              label: t_game("action_inspect"),
              action: () => {
                const weight = def ? def.weight : "?";
                const name = def ? t_game(def.name as any) : "Item";
                PlayerState.getInstance().emit(
                  "message",
                  `${name}: ${weight} oz.`,
                );
              },
            });

            PlayerState.getInstance().emit("requestContextMenu", {
              x: (pointer.event as MouseEvent).clientX,
              y: (pointer.event as MouseEvent).clientY,
              targetName: def ? t_game(def.name as any) : "Item",
              options,
            });
          }
        }
        pointer.event.preventDefault(); // Stop canvas menu?
        return;
      }

      // 2. LEFT CLICK -> Drag Only (Handled by drag events)
      // We disable the old double click pickup here by simply doing nothing.
    });

    // TOOLTIP & HOVER
    this.on("pointerover", () => {
      if (!this.isBeingDragged) {
        // ALWAYS allow tooltip inspection, even on lower levels
        // Visual feedback (tint) only if interactive (same level) - handled by updateDepth for lower levels
        // But we might want a highlight effect?
        // If same level, we can lighten. If lower level, keep dark.

        const currentLevel =
          (this.scene as any).registry.get("currentLevel") || "0";

        // Highlight effect only if on same level (interactive)
        if (this.level === currentLevel) {
          this.setTint(0xcccccc); // Light highlight
        }

        this.isHovered = true;
      }
    });

    this.on("pointerout", () => {
      if (!this.isBeingDragged) {
        this.isHovered = false;
        if (this.tooltipActive) {
          PlayerState.getInstance().clearItemTooltip();
          this.tooltipActive = false;
        }
        // Restore default appearance
        this.updateDepth();
      }
    });
  }

  private isValidDropPosition(worldX: number, worldY: number): boolean {
    const scene = this.scene as any;
    const mapLoader = scene.mapLoader as MapLoader;
    if (!mapLoader) return false;

    const tileSize = mapLoader.getTileSize();
    const gridX = Math.floor(worldX / tileSize);
    const gridY = Math.floor(worldY / tileSize);

    const mapData = this.scene.cache.json.get(
      `${this.scene.registry.get("currentMap")}_data`,
    ) as MultiLevelMapData;
    if (!mapData) return false;

    const playerState = PlayerState.getInstance();
    const currentLevel = playerState.getCurrentLevel();

    // --- Determine Target Level ---
    // If we are throwing to a tile that is Solid Floor on an UPPER level, let's detect it.
    let targetLevel = currentLevel;
    // currentLevelInt removed as unused

    // Check levels from highest down to current
    // Check levels from highest down to current
    // DISABLED for now: Throwing to upper floors causes items to disappear because
    // upper floors are generally not rendered/visible.
    // User Request: "If the floor above is not visible... do not try to throw to it".
    /*
    const levels = Object.keys(mapData.levels).map(l => parseInt(l)).sort((a,b) => b-a);
    for (const lvl of levels) {
        if (lvl <= currentLevelInt) break; // Only check upper floors
        
        const tile = mapLoader.getTileAt(gridX, gridY, lvl.toString());
        if (tile && tile !== "...") {
            // Found a floor!
            // Check vertical path: all floors between current and this one must be "..." at this (X,Y)
            let pathClear = true;
            for (let way = currentLevelInt + 1; way < lvl; way++) {
                const wayTile = mapLoader.getTileAt(gridX, gridY, way.toString());
                if (wayTile !== "...") {
                    pathClear = false;
                    break;
                }
            }

            if (pathClear) {
                targetLevel = lvl.toString();
                break;
            }
        }
    }
    */

    // Now validate targetLevel position collision
    const targetTileId = mapLoader.getTileAt(gridX, gridY, targetLevel);
    if (targetTileId) {
      const tileDef = TileRegistry.getTileDefinition(targetTileId);
      // If it's a wall or obstacle on the target floor, we cannot land there.
      if (tileDef && tileDef.isCollidable) {
        console.warn(
          `[DroppedItem] Drop BLOCKED by collision on Level ${targetLevel} at (${gridX},${gridY}). Tile: ${targetTileId}`,
        );
        return false;
      }
    }

    // Check Distance
    const player = scene.player;
    if (player) {
      const distance = Phaser.Math.Distance.Between(
        worldX,
        worldY,
        player.sprite.x,
        player.sprite.y,
      );
      if (distance > 600) return false;
      if (!player.checkLineOfSight(worldX, worldY)) return false;
    }

    (this as any)._pendingTargetLevel = targetLevel;
    return true;
  }

  private handleValidDrop(targetX?: number, targetY?: number): void {
    if (this.isDestroyed || this.isPickingUp) return;
    const scene = this.scene as any;
    const playerState = PlayerState.getInstance();
    const targetLevel = (this as any)._pendingTargetLevel || this.level;

    // Use target coords if provided (from dragend), else use current x/y
    const useX = targetX !== undefined ? targetX : this.x;
    const useY = targetY !== undefined ? targetY : this.y;

    const tileSize = scene.mapLoader ? scene.mapLoader.getTileSize() : 32;
    const gridX = Math.floor(useX / tileSize);
    const gridY = Math.floor(useY / tileSize);

    // Determine direction for displacement if falling
    let dir = undefined;
    if (scene.player) {
      dir = {
        x: gridX - Math.floor(scene.player.sprite.x / tileSize),
        y: gridY - Math.floor(scene.player.sprite.y / tileSize),
      };
    }

    // Calculate final landing (Handles falling through targetLevel if it was void)
    const landing = scene.calculateItemLanding(gridX, gridY, targetLevel, dir);

    // Update position and level
    this.x = landing.x * tileSize + tileSize / 2;
    this.y = landing.y * tileSize + tileSize / 2;
    const oldLevel = this.level;
    this.level = landing.level;

    // Persist changes
    playerState.removePersistentDroppedItem(oldLevel, this.itemId);
    playerState.addPersistentDroppedItem(this.level, {
      itemId: this.itemId,
      weaponId: this.weaponId,
      x: this.x,
      y: this.y,
      createdAt: this.createdAt,
    });

    console.log(`[Item] Moved to (${this.x}, ${this.y}) Level ${this.level}`);

    // Visual Refresh
    this.updateDepth();
  }

  public getWeaponId(): string {
    return this.weaponId;
  }

  public updateWeaponId(newId: string): void {
    if (this.weaponId === newId) return;
    this.weaponId = newId;

    // Removed unused weaponDef
    if (newId === "light_torch") {
      // Establish Animation if needed
      if (!this.scene.anims.exists("light_torch_anim")) {
        this.scene.anims.create({
          key: "light_torch_anim",
          frames: [
            { key: "light_torch_1" },
            { key: "light_torch_2" },
            { key: "light_torch_3" },
            { key: "light_torch_4" },
          ],
          frameRate: 5,
          repeat: -1,
        });
      }
      this.play("light_torch_anim");
    } else {
      // Switch to static texture
      if (this.anims.isPlaying) this.stop();

      // Determine texture key
      // Since we can't easily call createWeaponGraphic to extract key without creating dummy,
      // we use specific logic or try standard keys.
      // For torch: "torch" or "item_torch"? Registry says "torch".
      // Generally ID matches Texture Key for simple items.
      // If complex, we might need a lookup.
      // Fallback to ID.
      let texKey = newId;
      if (!this.scene.textures.exists(texKey)) {
        // Try "items" atlas or fallback?
        if (this.scene.textures.exists("default_item")) texKey = "default_item";
      }
      this.setTexture(texKey);
    }
  }

  public getLevel(): string {
    return this.level;
  }

  public updateDepth(): void {
    // Verificar se o item foi destruído ou não tem scene
    if (this.isDestroyed || !this.scene || !this.scene.registry) {
      return;
    }

    try {
      const currentLevel =
        (this.scene.registry.get("currentLevel") as string) || "0";
      const levelDiff = parseInt(this.level) - parseInt(currentLevel);

      // FIXED DEPTH LOGIC:
      // Items on ground should be BELOW players/walls (which use Y-sorting)
      // but ABOVE the floor (Layer 0).
      // Assigning a fixed low positive value usually ensures this.
      // E.g. LevelDiff*10K + 2.
      const depth = levelDiff * 100000 + 5;

      this.setDepth(depth);

      const mapData = this.scene.cache.json.get(
        `${this.scene.registry.get("currentMap")}_data`,
      ) as MultiLevelMapData;

      if (!mapData || !mapData.levels) return;

      const currentLevelData = mapData.levels[currentLevel];
      if (!currentLevelData) return;

      const tileX = Math.floor(this.x / 32);
      const tileY = Math.floor(this.y / 32);
      const mapLoader = (this.scene as any).mapLoader as MapLoader;
      const symbol = mapLoader.getTileAt(tileX, tileY, currentLevel);

      // VISIBILITY & DARKENING LOGIC
      // If same level -> Visible, No Tint
      // If lower level (-1 relative) -> Visible if "void" (...), Tinted Dark
      // If undefined/other -> Visible based on logic

      let isVisible = false;
      let shouldTint = false;

      if (this.level === currentLevel) {
        isVisible = true;
        shouldTint = false;
      } else if (parseInt(this.level) < parseInt(currentLevel)) {
        // Check if we can see through
        if (
          symbol === "..." ||
          mapData.tileDefinitions[symbol || ""]?.under === "..."
        ) {
          isVisible = true;
          shouldTint = true;
        }
      }

      this.setVisible(isVisible);

      if (isVisible) {
        if (shouldTint) {
          this.setTint(0x555555); // Darken for depth perception
        } else {
          this.clearTint();
        }
      }
    } catch (error) {
      console.warn("Error updating dropped item depth:", error);
    }
  }

  // ... (rest of class)

  private isPickingUp: boolean = false;

  public pickup(): void {
    if (this.isDestroyed || this.isPickingUp) return;

    // Prevent dragging race conditions
    if (this.isBeingDragged) {
      // If we are dragging, we probably shouldn't maximize pickup?
      // Or if double click happens while dragging?
      // Let's allow it but force stop drag behavior.
      this.isBeingDragged = false;
      if (this.body) this.body.enable = true;
    }

    this.isPickingUp = true;
    const playerState = PlayerState.getInstance();

    // Tentar adicionar ao inventário
    // Passamos this.itemId como UID explícito para preservar conteudos de containers!
    const success = playerState.addItem(
      this.weaponId,
      1,
      this.itemId,
      this.stars || 0,
      [...(this.attributes || [])],
    );

    if (success) {
      AudioManager.getInstance().playPickup();
      playerState.removePersistentDroppedItem(this.level, this.itemId);

      const inventorySystem = (this.scene as any)
        .inventorySystem as InventorySystem;
      if (inventorySystem) {
        inventorySystem.showPickupMessage(this.weaponId);
      }

      PlayerState.getInstance().clearItemTooltip();
      this.destroy();
    } else {
      // Falha (Peso, Slots, etc)
      this.isPickingUp = false;
      this.setAlpha(1);
      this.setVisible(true);
    }
  }

  private showValidDropIndicator(): void {
    this.clearTint();
    this.setTint(0x00ff00); // Verde para posição válida
  }

  private showInvalidDropIndicator(): void {
    this.setTint(0xff0000); // Vermelho para posição inválida
  }

  private showNeutralAppearance(): void {
    this.clearTint();
    this.setAlpha(1.0);
  }

  // Método para destruir o item corretamente
  public destroy(): void {
    if (this.isDestroyed) return;

    this.isDestroyed = true;
    this.isBeingDragged = false;
    this.removeAllListeners();

    // Remover do grupo de itens dropados se existir
    // Safe removal from group
    const scene = this.scene as any;
    if (scene && scene.droppedItemsGroup && scene.droppedItemsGroup.children) {
      try {
        scene.droppedItemsGroup.remove(this, true, true);
      } catch (e) {
        // Ignore removal errors during shutdown
      }
    }

    super.destroy();
  }
}
