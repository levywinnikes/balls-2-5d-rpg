// effects/LevelUpAnimation.ts
export class LevelUpAnimation {
  private scene: Phaser.Scene;
  private letters: Phaser.GameObjects.Text[] = [];
  private container: Phaser.GameObjects.Container;
  private fullText: string;

  constructor(scene: Phaser.Scene, x: number, y: number, level: number) {
    this.scene = scene;
    this.fullText = `⭐ LEVEL ${level} ⭐`;
    this.container = scene.add.container(x, y).setDepth(1001);

    this.createLetters();
    this.animate();
  }

  private createLetters(): void {
    const letterStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Arial",
      fontSize: "128px", // Huge for Level Up 4x
      color: "#FFD700", // GOLD
      stroke: "#000000",
      strokeThickness: 12,
      fontStyle: "bold",
    };

    // Espaçamento entre letras
    let xOffset = -((this.fullText.length * 20) / 2);

    for (let i = 0; i < this.fullText.length; i++) {
      const letter = this.scene.add
        .text(xOffset + i * 80, 0, this.fullText[i], letterStyle) // Spread out letters
        .setOrigin(0.5)
        .setAlpha(0)
        .setScale(0.5);

      this.letters.push(letter);
      this.container.add(letter);
    }
  }

  private animate(): void {
    // Animação de digitação (letras aparecendo uma por uma)
    this.letters.forEach((letter, index) => {
      this.scene.tweens.add({
        targets: letter,
        alpha: 1,
        scale: 1,
        y: -10,
        duration: 200,
        delay: index * 100,
        ease: "Back.out",
      });
    });

    // Animação pulsante após todas as letras aparecerem
    this.scene.time.delayedCall(this.fullText.length * 100, () => {
      this.scene.tweens.add({
        targets: this.container,
        scale: 1.2,
        duration: 300,
        yoyo: true,
        repeat: 3,
        ease: "Sine.inOut",
      });

      // Animação de saída (letras subindo e desaparecendo)
      this.letters.forEach((letter, index) => {
        this.scene.tweens.add({
          targets: letter,
          y: letter.y - 50,
          alpha: 0,
          scale: 1.5,
          duration: 400,
          delay: 1500 + index * 50,
          ease: "Power2",
          onComplete:
            index === this.letters.length - 1
              ? () => this.destroy()
              : undefined,
        });
      });
    });
  }

  destroy(): void {
    this.letters.forEach((letter) => letter.destroy());
    this.container.destroy();
  }
}
