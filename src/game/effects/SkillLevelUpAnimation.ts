// effects/SkillLevelUpAnimation.ts
export class SkillLevelUpAnimation {
  private scene: Phaser.Scene;
  private text: Phaser.GameObjects.Text;
  private particles: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    skillName: string,
    level: number
  ) {
    this.scene = scene;
    
    // Determine Style based on Skill
    let color = "#FFFFFF";
    let icon = "";
    
    if (skillName.toLowerCase().includes("defense") || skillName.toLowerCase().includes("shielding")) {
        color = "#60A5FA"; // Blue
        icon = "🛡️";
    } else if (skillName.toLowerCase().includes("melee") || skillName.toLowerCase().includes("sword")) {
        color = "#F87171"; // Red
        icon = "⚔️";
    } else if (skillName.toLowerCase().includes("range") || skillName.toLowerCase().includes("distance")) {
        color = "#34D399"; // Green
        icon = "🏹";
    }

    // Texto com Icone
    this.text = scene.add
      .text(x, y, `${icon} ${skillName} ${level}!`, {
        fontFamily: "Arial",
        fontSize: "64px", // Scaled 4x
        color: color,
        stroke: "#000000",
        strokeThickness: 8,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(2000);

    // Partículas simples
    this.particles = this.scene.add
      .particles(x, y + 20, "flares", {
        frame: "white",
        scale: { start: 0.1, end: 0 },
        lifespan: 600,
        speed: 50,
        quantity: 5,
        blendMode: "ADD",
      })
      .setDepth(999);

    this.animate();
  }

  private animate(): void {
    // Animação de entrada
    this.scene.tweens.add({
      targets: this.text,
      y: this.text.y - 20,
      alpha: 1,
      duration: 300,
      ease: "Power1",
    });

    // Animação de saída
    this.scene.tweens.add({
      targets: this.text,
      y: this.text.y - 50,
      alpha: 0,
      duration: 500,
      delay: 1000,
      ease: "Power1",
      onComplete: () => this.destroy(),
    });

    // Partículas apenas uma vez
    this.particles.explode(5, this.text.x, this.text.y);
  }

  destroy(): void {
    this.text.destroy();
    this.particles.destroy();
  }
}
