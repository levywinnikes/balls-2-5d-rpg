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
                scene.load.image("item_chest_tex", "assets/tiles/chests/wooden-chest.png");
            }
        },
        create: (scene: Phaser.Scene) => {
            const sprite = scene.add.sprite(0, 0, "item_chest_tex");
            // HD Size for ground entity
            sprite.setDisplaySize(128, 128); 
            return sprite;
        }
      }
    },
    {
      id: "altar",
      name: "container_altar",
      weight: 1000.0,
      maxSlots: 1, // Special single slot functionality
      movable: false, // Stationary
      pickupable: false,
      graphic: {
        preload: (scene: Phaser.Scene) => {
             if(!scene.textures.exists("altar_tex")) {
                 // Placeholder: Using a different colored block or existing asset
                 scene.load.image("altar_tex", "assets/tiles/furniture/altar.png"); 
             }
        },
        create: (scene: Phaser.Scene) => {
            const sprite = scene.add.sprite(0, 0, "altar_tex");
            sprite.setDisplaySize(128, 128);
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
