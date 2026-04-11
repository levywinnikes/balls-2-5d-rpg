import Phaser from "phaser";

export interface ContainerDefinition {
  id: string;
  name: string;
  weight: number;
  maxSlots: number;
  movable: boolean;
  pickupable: boolean; // Controls if it can be stored in inventory
  graphic: {
    preload: (scene: Phaser.Scene) => void;
    create: (scene: Phaser.Scene) => Phaser.GameObjects.Sprite;
  };
  // Properties required to satisfy WeaponDefinition if we cast/merge types, 
  // or we handle them in the Facade. 
  // WeaponRegistry expects: damage, armor, defense, cooldown, range, type, exp_skill, stability, stackable, consumable.
  // We should probably define these defaults here or in the wrapper.
}

export class ContainerRegistry {
  private static containers: ContainerDefinition[] = [
    {
      id: "wooden_chest",
      name: "item_wooden_chest",
      weight: 200.0,
      maxSlots: 10,
      movable: true,
      pickupable: true,
      graphic: {
        preload: (scene: Phaser.Scene) => {
            if(!scene.textures.exists("item_chest_tex")) {
                // Procedural 32x32 wooden chest
                const g = scene.add.graphics();
                g.fillStyle(0x8b4513, 1);  // Brown body
                g.fillRect(0, 0, 32, 32);
                g.fillStyle(0x5c2900, 1);  // Dark border
                g.fillRect(0, 0, 32, 4);   // Top
                g.fillRect(0, 28, 32, 4);  // Bottom
                g.fillRect(0, 0, 4, 32);   // Left
                g.fillRect(28, 0, 4, 32);  // Right
                g.fillStyle(0xfbbf24, 1);  // Gold lock
                g.fillRect(13, 12, 6, 6);
                g.fillStyle(0xd97706, 1);  // Lock hole
                g.fillRect(15, 14, 2, 2);
                g.generateTexture("item_chest_tex", 32, 32);
                g.destroy();
            }
        },
        create: (scene: Phaser.Scene) => {
            if(!scene.textures.exists("item_chest_tex")) {
                const g = scene.add.graphics();
                g.fillStyle(0x8b4513, 1);
                g.fillRect(0, 0, 32, 32);
                g.generateTexture("item_chest_tex", 32, 32);
                g.destroy();
            }
            const sprite = scene.add.sprite(0, 0, "item_chest_tex");
            sprite.setDisplaySize(32, 32);
            return sprite;
        }
      }
    },
    {
      id: "altar",
      name: "container_altar",
      weight: 1000.0,
      maxSlots: 1,
      movable: false,
      pickupable: false,
      graphic: {
        preload: (scene: Phaser.Scene) => {
             if(!scene.textures.exists("altar_tex")) {
                 // Procedural 32x32 altar (stone pedestal with glow)
                 const g = scene.add.graphics();
                 g.fillStyle(0x555577, 1);  // Dark stone
                 g.fillRect(2, 10, 28, 22);
                 g.fillStyle(0x7777aa, 1);  // Lighter top
                 g.fillRect(4, 6, 24, 8);
                 g.fillStyle(0xd8b4fe, 0.6); // Purple glow
                 g.fillCircle(16, 8, 5);
                 g.generateTexture("altar_tex", 32, 32);
                 g.destroy();
             }
        },
        create: (scene: Phaser.Scene) => {
            if(!scene.textures.exists("altar_tex")) {
                const g = scene.add.graphics();
                g.fillStyle(0x555577, 1);
                g.fillRect(2, 10, 28, 22);
                g.generateTexture("altar_tex", 32, 32);
                g.destroy();
            }
            const sprite = scene.add.sprite(0, 0, "altar_tex");
            sprite.setDisplaySize(32, 32);
            return sprite;
        }
      }
    }
  ];

  static preloadAll(scene: Phaser.Scene): void {
    this.containers.forEach((c) => c.graphic.preload(scene));
  }

  static getContainer(id: string): ContainerDefinition | undefined {
    return this.containers.find((c) => c.id === id);
  }

  static getAllContainers(): ContainerDefinition[] {
    return this.containers;
  }
}
