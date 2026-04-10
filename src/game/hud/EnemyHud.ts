import Enemy from "../entities/Enemy";
import { PlayerState } from "../entities/Player/PlayerState";

export class EnemyHud {
  private healthBar: Phaser.GameObjects.Graphics;
  private healthText: Phaser.GameObjects.Text; // Keeping variable ref but not using for now
  private enemy: Enemy;
  private isVisible: boolean = false;

  constructor(scene: Phaser.Scene, enemy: Enemy) {
    this.enemy = enemy;

    // Health Bar Container (Depth 100 to be behind damage popups)
    this.healthBar = scene.add.graphics().setDepth(100).setVisible(false);

    // Text (Unused in new design, but kept to avoid strict null checks if referenced elsewhere)
    this.healthText = scene.add.text(0, 0, "").setVisible(false);

    this.update();
  }

  public update(): void {
    if (!this.enemy.sprite.active) {
      this.destroy();
      return;
    }

    const healthPercent = this.enemy.getHealth() / this.enemy.getMaxHealth();
    
    // Robust Visibility Check
    const playerLevel = PlayerState.getInstance().getZLevel();
    const enemyLevel = this.enemy.level; // Use direct property

    // Show HUD only if damaged AND on same floor
    const onSameFloor = String(playerLevel) === String(enemyLevel);

    if (healthPercent < 1 && onSameFloor) {
      this.isVisible = true;
      this.healthBar.setVisible(true);
      this.updatePosition();
      this.updateHealth();
    } else {
      this.isVisible = false;
      this.healthBar.setVisible(false);
    }
  }

  public updatePosition(): void {
    const x = this.enemy.sprite.x;
    const y = this.enemy.sprite.y; // Draw logic handles offset
    this.healthBar.setPosition(x, y);
  }

  public updateHealth(): void {
    const healthPercent = Phaser.Math.Clamp(
      this.enemy.getHealth() / this.enemy.getMaxHealth(),
      0,
      1
    );

    // Visual Constants
    const barHeight = 8;
    const barWidth = 40; 
    const yOffset = -45;

    this.healthBar.clear();

    // 1. Background (Dark Gray)
    this.healthBar.fillStyle(0x222222, 0.8);
    this.healthBar.fillRect(
      -barWidth / 2,
      yOffset,
      barWidth,
      barHeight
    );

    // 2. Health Bar Fill
    const color = this.getHealthColor(healthPercent);
    this.healthBar.fillStyle(color, 1);
    
    if (healthPercent > 0) {
        // -1 width for internal border effect or +1 padding?
        // Let's do 1px padding inside
        this.healthBar.fillRect(
          -barWidth / 2 + 1, 
          yOffset + 1,
          (barWidth - 2) * healthPercent,
          barHeight - 2
        );
    }

    // 3. Border (Black thin outlines)
    this.healthBar.lineStyle(1, 0x000000, 1);
    this.healthBar.strokeRect(
      -barWidth / 2,
      yOffset,
      barWidth,
      barHeight
    );
  }

  private getHealthColor(percent: number): number {
    if (percent > 0.6) return 0x4ade80; // Soft Green
    if (percent > 0.3) return 0xfacc15; // Soft Yellow
    return 0xf87171; // Soft Red
  }

  public destroy(): void {
    this.healthBar.destroy();
    if (this.healthText) this.healthText.destroy(); // Safety check
  }
}
