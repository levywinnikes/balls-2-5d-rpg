import Enemy from "../entities/Enemy";
import { PlayerState } from "../entities/Player/PlayerState";

// Adicione esta classe para gerenciar o indicador de seleção
export class EnemySelectionIndicator {
  private scene: Phaser.Scene;
  private indicator: Phaser.GameObjects.Graphics;
  private target: Enemy | null = null;
  private offsetY: number = -20;
  private animationTween: Phaser.Tweens.Tween | null = null;
  private color: number = 0xffff00; // Amarelo como cor padrão

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.indicator = scene.add.graphics();
    this.indicator.setDepth(1000); // Garante que fique acima de outros elementos
  }

  public setTarget(enemy: Enemy | null): void {
    this.target = enemy;

    // Limpa animação anterior
    if (this.animationTween) {
      this.animationTween.stop();
      this.animationTween = null;
    }

    // Se não há alvo, limpa o indicador
    if (!enemy) {
      this.indicator.clear();
      return;
    }

    // Configura animação de pulsação
    this.animationTween = this.scene.tweens.addCounter({
      from: 1,
      to: 1.2,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        this.updateIndicator();
      },
    });

    // Atualiza imediatamente
    this.updateIndicator();
  }

  private updateIndicator(): void {
    this.indicator.clear();

    if (!this.target || this.target.isDefeated()) {
      this.setTarget(null);
      return;
    }

    const playerLevel = PlayerState.getInstance().getZLevel();
    const enemyLevel = this.target.level; // Use property directly

    if (String(playerLevel) !== String(enemyLevel)) {
        this.indicator.clear();
        // Option: Deselect target entirely? 
        // For now just hiding visual is requested, but usually you lose target.
        // User asked: "Tanto eu quanto o bixo deveria perder o alvo" (Both me and beast should lose target)
        // So we should probably nullify the target here.
        this.setTarget(null);
        return; 
    }

    const scale = this.animationTween?.getValue() || 1;
    // Prefer body (hitbox) size if available, otherwise visual bounds
    const body = this.target.sprite.body as Phaser.Physics.Arcade.Body | undefined;
    
    let centerX, centerY, width, height;

    if (body) {
        centerX = body.center.x;
        centerY = body.center.y;
        width = body.width;
        height = body.height;
    } else {
        const bounds = this.target.sprite.getBounds();
        centerX = bounds.centerX;
        centerY = bounds.centerY;
        width = bounds.width;
        height = bounds.height;
    }

    // Offset logic (removed explicit offsetY override as body center is usually good, 
    // but we might want `body.bottom` - radius for ground cursor? 
    // User wants "around the unit". Center is fine.)
    
    // const radius = Math.max(bounds.width, bounds.height) * 0.6; // Old logic
    // New logic: Fit circle to body corners (approx sqrt(2) * size/2? or just size/2 * padding)
    // 48px body -> Radius ~30-35px.
    const radius = (Math.max(width, height) * 0.75) * scale;

    // Desenha um indicador Premium/RPG (Gold/Elegante)
    // Evitar "Barbie/Hotpink"
    const primaryColor = 0xffd700; // Gold
    
    // Efeito de brilho (Glow)
    this.indicator.lineStyle(2, primaryColor, 0.3 * scale);
    this.indicator.strokeCircle(centerX, centerY, radius + 2);
    this.indicator.strokeCircle(centerX, centerY, radius + 5);

    // Brackets arredondados (Soft Styles)
    this.indicator.lineStyle(5, primaryColor, 0.9); // Thicker line
    const bracketSize = 18; // Bigger brackets
    
    // Top-Left
    this.indicator.beginPath();
    this.indicator.moveTo(centerX - radius, centerY - radius + bracketSize);
    this.indicator.lineTo(centerX - radius, centerY - radius);
    this.indicator.lineTo(centerX - radius + bracketSize, centerY - radius);
    this.indicator.strokePath();

    // Top-Right
    this.indicator.beginPath();
    this.indicator.moveTo(centerX + radius - bracketSize, centerY - radius);
    this.indicator.lineTo(centerX + radius, centerY - radius);
    this.indicator.lineTo(centerX + radius, centerY - radius + bracketSize);
    this.indicator.strokePath();

    // Bottom-Left
    this.indicator.beginPath();
    this.indicator.moveTo(centerX - radius, centerY + radius - bracketSize);
    this.indicator.lineTo(centerX - radius, centerY + radius);
    this.indicator.lineTo(centerX - radius + bracketSize, centerY + radius);
    this.indicator.strokePath();

    // Bottom-Right
    this.indicator.beginPath();
    this.indicator.moveTo(centerX + radius - bracketSize, centerY + radius);
    this.indicator.lineTo(centerX + radius, centerY + radius);
    this.indicator.lineTo(centerX + radius, centerY + radius - bracketSize);
    this.indicator.strokePath();

    // Sparkles ✨ (White/Gold - Classy)
    this.indicator.fillStyle(0xffffff, 1); // White stars
    this.indicator.fillCircle(centerX - radius, centerY - radius, 3);
    this.indicator.fillCircle(centerX + radius, centerY + radius, 3);
    this.indicator.fillStyle(0xffaa00, 1); // Orange/Gold stars
    this.indicator.fillCircle(centerX + radius, centerY - radius, 3);
    this.indicator.fillCircle(centerX - radius, centerY + radius, 3);
  }

  public setColor(color: number): void {
    this.color = color;
    this.updateIndicator();
  }

  public destroy(): void {
    if (this.animationTween) {
      this.animationTween.stop();
    }
    this.indicator.destroy();
  }
}
