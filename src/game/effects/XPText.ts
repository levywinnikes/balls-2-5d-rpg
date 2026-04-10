// effects/XPText.ts
export class XPText {
  private scene: Phaser.Scene;
  private text: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, xp: number) {
    this.scene = scene;

    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Arial",
      fontSize: "48px", // Scaled 4x
      color: "#F6E05E", // Gold/Yellow ish
      stroke: "#000000",
      strokeThickness: 6,
      fontStyle: "bold",
    };

    // User requested: "estrelinha + numero"
    this.text = scene.add
      .text(x, y, `★ ${xp} XP`, textStyle)
      .setOrigin(0.5)
      .setDepth(99999999);

    this.animate();
  }

  private animate(): void {
    const randomX = Phaser.Math.Between(-10, 10);

    this.scene.tweens.add({
      targets: this.text,
      x: this.text.x + randomX,
      y: this.text.y - 30,
      alpha: 0,
      duration: 1200,
      ease: "Cubic.out",
      onComplete: () => this.destroy(),
    });

    // Pop effect
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
}
