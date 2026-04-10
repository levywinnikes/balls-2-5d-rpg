import Phaser from "phaser";

export class TooltipManager {
  private scene: Phaser.Scene;
  private tooltip: Phaser.GameObjects.Container | null = null;
  private readonly PADDING: number = 8;
  private computedWidth: number = 0;
  private computedHeight: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  showWeaponTooltip(
    info: { name: string; damage: number; type: string },
    target: Phaser.GameObjects.Sprite
  ): void {
    if (this.tooltip) {
      this.destroyCurrentTooltip();
    }

    const cam = this.scene.cameras.main;

    // Posição inicial inteligente relativa ao centro do target na tela
    const screenCenterX = target.x + target.width / 2 - cam.scrollX;
    const screenCenterY = target.y + target.height / 2 - cam.scrollY;

    const background = this.scene.add.graphics();
    background.fillStyle(0x1a1a1a, 0.95);
    background.lineStyle(2, 0xcccccc, 1);

    const nameText = this.scene.add
      .text(0, 0, info.name, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setPosition(this.PADDING, this.PADDING);

    const damageText = this.scene.add
      .text(0, 0, `Damage: ${info.damage}`, {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#ffffff",
      })
      .setPosition(this.PADDING, this.PADDING + 24);

    const typeText = this.scene.add
      .text(0, 0, `Type: ${info.type}`, {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#ffffff",
      })
      .setPosition(this.PADDING, this.PADDING + 44);

    const maxTextWidth = Math.max(
      nameText.width,
      damageText.width,
      typeText.width
    );
    this.computedWidth = maxTextWidth + 2 * this.PADDING;
    this.computedHeight = typeText.y + typeText.height + this.PADDING;

    background.fillRoundedRect(
      0,
      0,
      this.computedWidth,
      this.computedHeight,
      8
    );
    background.strokeRoundedRect(
      0,
      0,
      this.computedWidth,
      this.computedHeight,
      8
    );

    let tooltipX = screenCenterX + 10;
    let tooltipY = screenCenterY - this.computedHeight - 10;

    // Ajustes iniciais para caber na tela (preferência: direita-acima)
    if (tooltipX + this.computedWidth > cam.width) {
      tooltipX = screenCenterX - this.computedWidth - 10;
    }
    if (tooltipX < 0) {
      tooltipX = 10;
    }
    if (tooltipY < 0) {
      tooltipY = screenCenterY + target.displayHeight + 10;
    }
    if (tooltipY + this.computedHeight > cam.height) {
      tooltipY = cam.height - this.computedHeight - 10;
    }

    this.tooltip = this.scene.add
      .container(tooltipX, tooltipY, [
        background,
        nameText,
        damageText,
        typeText,
      ])
      .setScrollFactor(0)
      .setDepth(1200);

    // Listener para seguir o mouse de forma inteligente enquanto hover
    this.scene.input.on("pointermove", this.updateTooltipPosition, this);
  }

  private updateTooltipPosition(pointer: Phaser.Input.Pointer): void {
    if (!this.tooltip) return;

    const cam = this.scene.cameras.main;

    let tooltipX = pointer.x + 10;
    let tooltipY = pointer.y - this.computedHeight - 10;

    // Posicionamento inteligente baseado no mouse (preferência: direita-acima)
    if (tooltipX + this.computedWidth > cam.width) {
      tooltipX = pointer.x - this.computedWidth - 10;
    }
    if (tooltipX < 0) {
      tooltipX = 10;
    }
    if (tooltipY < 0) {
      tooltipY = pointer.y + 10;
    }
    if (tooltipY + this.computedHeight > cam.height) {
      tooltipY = cam.height - this.computedHeight - 10;
    }

    this.tooltip.setPosition(tooltipX, tooltipY);
  }

  destroyCurrentTooltip(): void {
    // Remove listener antes de destruir
    this.scene.input.off("pointermove", this.updateTooltipPosition, this);
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }
}
