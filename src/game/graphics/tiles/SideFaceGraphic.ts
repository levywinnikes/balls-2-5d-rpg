import Phaser from "phaser";

/**
 * SideFaceGraphic — Gerador de faces laterais para o efeito "Cidade de Papelão 3D"
 * 
 * Gera sprites retangulares que simulam as paredes laterais entre andares.
 * Cada face é uma faixa colorida com gradiente para simular iluminação.
 * 
 * Direções:
 * - south: faixa horizontal abaixo do tile (32 x height)
 * - north: faixa horizontal acima do tile (32 x height)
 * - east:  faixa vertical à direita do tile (width x 32)
 * - west:  faixa vertical à esquerda do tile (width x 32)
 */
export type SideFaceDirection = "south" | "north" | "east" | "west";

// Cache de texturas para evitar regeneração
const generatedTextures = new Set<string>();

export class SideFaceGraphic {
  /**
   * Gera a textura procedural para uma face lateral
   */
  static generateTexture(
    scene: Phaser.Scene,
    direction: SideFaceDirection,
    baseColor: number,
    height: number,
    width: number = 32
  ): string {
    const key = `sideface_${direction}_${baseColor.toString(16)}_${height}_${width}`;

    if (generatedTextures.has(key) && scene.textures.exists(key)) {
      return key;
    }

    const isVertical = direction === "east" || direction === "west";
    const texW = isVertical ? width : 32;
    const texH = isVertical ? 32 : height;

    const graphics = scene.add.graphics();

    // Cor base escurecida (faces laterais são mais escuras)
    const r = (baseColor >> 16) & 0xff;
    const g = (baseColor >> 8) & 0xff;
    const b = baseColor & 0xff;

    // Fator de escurecimento por direção
    let darkFactor: number;
    switch (direction) {
      case "south":
        darkFactor = 0.6;  // Mais iluminada (luz vem de cima)
        break;
      case "north":
        darkFactor = 0.3;  // Mais escura (sombra)
        break;
      case "east":
        darkFactor = 0.5;  // Meio-tom
        break;
      case "west":
        darkFactor = 0.45; // Ligeiramente mais escura que east
        break;
    }

    // Gradiente vertical (de cima pra baixo) para faces horizontais
    // Gradiente horizontal para faces verticais
    const steps = isVertical ? texW : texH;
    for (let i = 0; i < steps; i++) {
      // Gradiente: mais claro no topo, mais escuro embaixo
      const t = i / Math.max(1, steps - 1);
      const gradientFactor = darkFactor * (1 - t * 0.3); // 30% de variação

      const fr = Math.floor(r * gradientFactor);
      const fg = Math.floor(g * gradientFactor);
      const fb = Math.floor(b * gradientFactor);
      const color = Phaser.Display.Color.GetColor(fr, fg, fb);

      graphics.fillStyle(color, 1);
      if (isVertical) {
        graphics.fillRect(i, 0, 1, texH);
      } else {
        graphics.fillRect(0, i, texW, 1);
      }
    }

    // Borda sutil para definição
    const borderColor = Phaser.Display.Color.GetColor(
      Math.floor(r * 0.25),
      Math.floor(g * 0.25),
      Math.floor(b * 0.25)
    );
    graphics.lineStyle(1, borderColor, 0.6);
    graphics.strokeRect(0, 0, texW, texH);

    // Detalhes de textura (linhas horizontais para parecer tijolos)
    if (!isVertical && texH > 8) {
      graphics.lineStyle(1, borderColor, 0.3);
      const brickRows = Math.floor(texH / 8);
      for (let row = 1; row < brickRows; row++) {
        const lineY = row * 8;
        graphics.strokeLineShape(new Phaser.Geom.Line(0, lineY, texW, lineY));
        // Juntas alternadas (padrão tijolo)
        const offset = row % 2 === 0 ? 0 : 16;
        graphics.strokeLineShape(new Phaser.Geom.Line(offset, lineY - 8, offset, lineY));
        if (offset + 16 < texW) {
          graphics.strokeLineShape(new Phaser.Geom.Line(offset + 16, lineY - 8, offset + 16, lineY));
        }
      }
    } else if (isVertical && texW > 4) {
      graphics.lineStyle(1, borderColor, 0.3);
      const brickCols = Math.floor(texW / 8);
      for (let col = 1; col < brickCols; col++) {
        const lineX = col * 8;
        graphics.strokeLineShape(new Phaser.Geom.Line(lineX, 0, lineX, texH));
      }
    }

    graphics.generateTexture(key, texW, texH);
    graphics.destroy();

    generatedTextures.add(key);
    return key;
  }

  /**
   * Cria o sprite de uma face lateral
   */
  static createFace(
    scene: Phaser.Scene,
    x: number,
    y: number,
    direction: SideFaceDirection,
    baseColor: number,
    height: number,
    sideWidth: number = 8,
    reusable?: Phaser.GameObjects.Sprite
  ): Phaser.GameObjects.Sprite {
    const isVertical = direction === "east" || direction === "west";
    const texW = isVertical ? sideWidth : 32;
    const texH = isVertical ? 32 : height;

    const textureKey = this.generateTexture(scene, direction, baseColor, height, isVertical ? sideWidth : 32);

    let sprite: Phaser.GameObjects.Sprite;

    if (reusable) {
      sprite = reusable;
      sprite.setTexture(textureKey);
      sprite.setPosition(x, y);
      sprite.setActive(true);
      sprite.setVisible(true);
      sprite.setAlpha(1);
      sprite.clearTint();
    } else {
      sprite = scene.add.sprite(x, y, textureKey);
    }

    sprite.setDisplaySize(texW, texH);
    sprite.setOrigin(0.5, 0);  // Origin no topo para posicionar corretamente

    return sprite;
  }

  /**
   * Determina a cor base da face lateral baseado no tipo de tile
   */
  static getColorForTileId(tileId: string): number {
    // Matchear padrões de IDs para cores apropriadas
    if (tileId.includes("house-wall")) return 0x5a3825;    // Marrom madeira
    if (tileId.includes("brick-wall")) return 0x808080;    // Cinza tijolo
    if (tileId.includes("cave-wall")) return 0x4a4a4a;     // Cinza escuro
    if (tileId.includes("dungeon-wall")) return 0x1e293b;  // Azul escuro
    if (tileId.includes("gothic-wall")) return 0x78716c;   // Pedra
    if (tileId.includes("stone-wall")) return 0x4b5563;    // Pedra cinza
    if (tileId.includes("foundation")) return 0x262626;    // Quase preto
    if (tileId.includes("wall")) return 0x808080;          // Cinza genérico
    if (tileId.includes("floor")) return 0x5a3825;         // Madeira
    if (tileId.includes("pavement")) return 0x606060;      // Concreto
    if (tileId.includes("grass")) return 0x3d8c50;         // Verde terra
    if (tileId.includes("sand")) return 0xc4a050;          // Areia
    if (tileId.includes("basalt")) return 0x303030;        // Basalto
    if (tileId.includes("cobblestone")) return 0x505860;   // Paralelepípedo
    
    // Default: cinza médio
    return 0x606060;
  }
}
