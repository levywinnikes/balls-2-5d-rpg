import Phaser from "phaser";

export class ItemGraphic {
  static preload(scene: Phaser.Scene, textureKey: string, filename: string): void {
    scene.load.image(textureKey, `assets/items/${filename}`);
  }

  static create(scene: Phaser.Scene, textureKey: string): Phaser.GameObjects.Sprite {
    const sprite = scene.add.sprite(0, 0, textureKey);
    // Ajustar tamanho se necessário, mas os assets já são 128x128
    sprite.setDisplaySize(32, 32); // Tamanho padrão no chão/mão (ajustável)
    sprite.setOrigin(0.5, 0.5);
    return sprite;
  }
}
