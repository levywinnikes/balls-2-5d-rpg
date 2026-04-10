import Phaser from "phaser";
import type Player from "../entities/Player";

export class PlayerHealthBar {
  private healthBar: Phaser.GameObjects.Graphics;
  private player: Player;
  private isVisible: boolean = false;
  private scene: Phaser.Scene;

  // Configuration
  private readonly barWidth = 40;
  private readonly barHeight = 6;
  private readonly yOffset = -70; // Above head (0.85 scale character)
  
  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;

    // Depth 999999 to be above player sprite but below damage text
    this.healthBar = scene.add.graphics().setDepth(999999).setVisible(false);
  }

  public update(): void {
    if (!this.player.sprite.active) {
      this.destroy();
      return;
    }

    const health = this.player.getHealth();
    const maxHealth = this.player.getMaxHealth();
    
    // Safety check div by zero
    const healthPercent = maxHealth > 0 ? Phaser.Math.Clamp(health / maxHealth, 0, 1) : 0;

    // Show if damaged (less than 100%)
    if (healthPercent < 1 && health > 0) {
        this.isVisible = true;
        this.healthBar.setVisible(true);
        this.draw(healthPercent);
        this.updatePosition();
    } else {
        this.isVisible = false;
        this.healthBar.setVisible(false);
    }
  }

  private updatePosition(): void {
    const x = this.player.sprite.x;
    const y = this.player.sprite.y;
    this.healthBar.setPosition(x, y);
  }

  private draw(percent: number): void {
    this.healthBar.clear();

    const w = this.barWidth;
    const h = this.barHeight;
    const y = this.yOffset;

    // Background (Dark)
    this.healthBar.fillStyle(0x222222, 0.8);
    this.healthBar.fillRect(-w / 2, y, w, h);

    // Fill
    const color = this.getHealthColor(percent);
    this.healthBar.fillStyle(color, 1);
    
    if (percent > 0) {
        this.healthBar.fillRect(
            -w / 2 + 1,
            y + 1,
            (w - 2) * percent,
            h - 2
        );
    }

    // Border (Clean Black)
    this.healthBar.lineStyle(1, 0x000000, 1);
    this.healthBar.strokeRect(-w / 2, y, w, h);
  }

  private getHealthColor(percent: number): number {
    if (percent > 0.6) return 0x4ade80; // Green
    if (percent > 0.3) return 0xfacc15; // Yellow
    return 0xf87171; // Red
  }

  public destroy(): void {
    this.healthBar.destroy();
  }
}
