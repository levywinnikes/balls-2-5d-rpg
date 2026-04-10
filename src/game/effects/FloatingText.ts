export class FloatingText {
  private scene: Phaser.Scene;
  private text: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    content: number | string, // Aceita número ou string
    isCritical: boolean = false,
    customColor?: string, // Cor personalizada opcional
    icon?: string, // Ícone personalizado opcional (ex: 🔥)
    isAmbient: boolean = false // New flag for ambient text
  ) {
    this.scene = scene;

    // Configuração do texto
    // Ambient: Smaller, standard font weight
    const fontSize = isAmbient ? "10px" : (isCritical ? "64px" : "48px"); 
    const baseColor = customColor || (isCritical ? "#FF0000" : "#FF3333");
    const fontWeight = isAmbient ? "normal" : "bold";
    const strokeThickness = isAmbient ? 2 : 6;
    
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Arial",
      fontSize: fontSize,
      color: baseColor,
      stroke: "#000000",
      strokeThickness: strokeThickness,
      fontStyle: fontWeight,
    };

    // Converte para string se for número
    let displayText = typeof content === "number" ? Math.abs(content).toString() : content;
    
    // Icon logic
    if (icon) {
        displayText = `${icon} ${displayText}`;
    } else if (typeof content === "number") {
        if (content < 0) {
            // Default Damage: Heart Icon
            displayText = `❤ ${Math.abs(content)}`;
        } else if (content > 0 && !customColor) { 
             // Default Healing: Green Heart
             displayText = `💚 +${content}`;
        }
    } else if (typeof content === "string" && content.includes("-")) {
        // Fallback if string "-10" passed
        displayText = `❤ ${content.replace("-", "")}`;
    }

    this.text = scene.add
      .text(x, y, displayText, textStyle)
      .setOrigin(0.5)
      .setDepth(99999999);

    // Efeito adicional para críticos
    if (isCritical) {
      scene.tweens.add({
        targets: this.text,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 200,
        yoyo: true,
      });
    }

    this.animate(isAmbient);
  }

  private animate(isAmbient: boolean = false): void {
    if (isAmbient) {
        // Ambient: Slow float up, long fade
        this.scene.tweens.add({
            targets: this.text,
            y: this.text.y - 40, 
            alpha: 0,
            duration: 4000, 
            ease: "Linear",
            onComplete: () => {
              this.destroy();
            },
        });
        return;
    }

    // "Mais sutil" (Subtle): Less movement, slightly faster fade
    const randomX = Phaser.Math.Between(-10, 10); // Reduced horizontal spread

    this.scene.tweens.add({
      targets: this.text,
      x: this.text.x + randomX,
      y: this.text.y - 30, // Was 50, now 30 (Shorter float)
      alpha: 0,
      duration: 1200, // Slightly longer duration but...
      ease: "Cubic.out", // Smooth deceleration
      onComplete: () => {
        this.destroy();
      },
    });
    
    // Scale Popup for "Pop" effect (Cute)
    this.text.setScale(0.5);
    this.scene.tweens.add({
        targets: this.text,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: "Back.out"
    });
  }

  destroy(): void {
    if (this.tween) {
      this.tween.stop();
      this.tween.remove();
    }
    if (this.text) {
      this.text.destroy();
    }
  }

  // Método estático para facilitar a criação
  static createDamageText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    damage: number,
    isCritical: boolean = false
  ): FloatingText {
    return new FloatingText(scene, x, y, damage, isCritical);
  }

  static createText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    message: string,
    color: string = "#FFFFFF",
    isCritical: boolean = false
  ): FloatingText {
    return new FloatingText(scene, x, y, message, isCritical, color);
  }

  static createAmbientText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    message: string,
  ): FloatingText {
      // Hex for Gold/Yellow: #FFD700
      return new FloatingText(scene, x, y, message, false, "#FFD700", undefined, true);
  }
}
