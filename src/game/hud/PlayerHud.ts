import Phaser from "phaser";
import Player from "../entities/Player";
import { XPTable } from "../data/XPTable";

export default class PlayerHud {
  private scene: Phaser.Scene;

  // Otimização: Separação em duas camadas gráficas
  private staticGraphics: Phaser.GameObjects.Graphics; // Fica parado (cache visual)
  private dynamicGraphics: Phaser.GameObjects.Graphics; // Só o que mexe

  private levelText: Phaser.GameObjects.Text;
  private hpText: Phaser.GameObjects.Text;

  // Cache de valores para evitar processamento inútil de texto
  private lastDisplayedLevel: number = -1;
  private lastDisplayedHPString: string = "";

  // Variáveis de Animação
  private displayedHealth: number;
  private ghostHealth: number;

  private readonly config = {
    x: 50,
    y: 55,
    hexSize: 28,
    segmentWidth: 18,
    segmentHeight: 14,
    segmentGap: 4,
    segmentSkew: 8,
    totalSegments: 10,
    colors: {
      bg: 0x111111,
      border: 0x333333,
      xpActive: 0xaa00ff,
      hpFull: 0x00d2ff,
      hpLow: 0xff004d,
      hpEmpty: 0x222222,
      hpGhost: 0xffffff,
    },
    fontFamily: '"Verdana", "Arial", sans-serif',
  };

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.displayedHealth = player.getHealth();
    this.ghostHealth = player.getHealth();

    // 1. Cria Camada Estática (Fundo) - Renderizada UMA vez
    this.staticGraphics = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(1000);

    // 2. Cria Camada Dinâmica (Frente) - Renderizada no update
    this.dynamicGraphics = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(1001);

    this.levelText = scene.add
      .text(this.config.x, this.config.y, "1", {
        font: `bold 28px ${this.config.fontFamily}`,
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setShadow(0, 0, "#aa00ff", 6)
      .setScrollFactor(0)
      .setDepth(1002);

    this.hpText = scene.add
      .text(0, 0, "", {
        font: `bold 11px ${this.config.fontFamily}`,
        color: "#cccccc",
      })
      .setScrollFactor(0)
      .setDepth(1002);

    // OTIMIZAÇÃO: Desenha a base estática agora e nunca mais mexe nela
    this.drawStaticLayer(player.getMaxHealth());

    // Desenha a parte dinâmica inicial
    this.drawDynamicLayer(player.getMaxHealth(), player.getExperience());
  }

  // =================================================================
  // LÓGICA DE UPDATE (Só mexe no que é dinâmico)
  // =================================================================
  public update(player: Player): void {
    const targetHealth = Math.max(0, player.getHealth());
    const maxHealth = player.getMaxHealth();

    // Detecta mudança na vida para animar
    if (targetHealth !== this.displayedHealth) {
      // Tween Rápido (Barra Colorida)
      this.scene.tweens.addCounter({
        from: this.displayedHealth,
        to: targetHealth,
        duration: 200,
        ease: "Sine.easeOut",
        onUpdate: (tween) => {
          this.displayedHealth = tween.getValue() ?? 0;
          this.drawDynamicLayer(maxHealth, player.getExperience());
        },
      });

      // Tween Lento (Barra Fantasma)
      if (targetHealth < this.ghostHealth) {
        this.scene.tweens.addCounter({
          from: this.ghostHealth,
          to: targetHealth,
          duration: 800,
          delay: 200,
          ease: "Linear",
          onUpdate: (tween) => {
            this.ghostHealth = tween.getValue() ?? 0;
            this.drawDynamicLayer(maxHealth, player.getExperience());
          },
        });
      } else {
        this.ghostHealth = targetHealth;
        // Força redraw imediato se curou
        this.drawDynamicLayer(maxHealth, player.getExperience());
      }

      // Atualiza valor lógico imediato para evitar loops
      if (targetHealth > this.displayedHealth)
        this.displayedHealth = targetHealth;
    }
    // Se a vida não mudou, mas XP mudou, redesenha só a dinâmica
    else {
      // Uma verificação simples para não redesenhar à toa se nada mudou
      // (Aqui assumimos que XP pode mudar a qualquer frame, se quiser otimizar mais,
      // crie uma variável lastXP)
      this.drawDynamicLayer(maxHealth, player.getExperience());
    }

    // OTIMIZAÇÃO: Só atualiza texto se mudou (setText é custoso)
    const xpInfo = XPTable.getLevelInfo(player.getExperience());
    if (this.lastDisplayedLevel !== xpInfo.level) {
      this.levelText.setText(xpInfo.level.toString());
      this.lastDisplayedLevel = xpInfo.level;
    }

    const hpString = `${Math.floor(targetHealth)}/${maxHealth}`;
    if (this.lastDisplayedHPString !== hpString) {
      const totalWidth =
        this.config.totalSegments *
        (this.config.segmentWidth + this.config.segmentGap);
      const startX = this.config.x + this.config.hexSize + 15;
      this.hpText.setText(hpString);
      this.hpText.setPosition(
        startX + totalWidth - this.hpText.width,
        this.config.y + 10,
      );
      this.lastDisplayedHPString = hpString;
    }
  }

  // =================================================================
  // CAMADA 1: ESTÁTICA (Fundo preto, slots vazios)
  // =================================================================
  private drawStaticLayer(max: number): void {
    this.staticGraphics.clear();
    const c = this.config;

    // 1. Fundo do Hexágono e Borda Inativa
    this.staticGraphics.fillStyle(c.colors.bg, 0.95);
    this.drawHexPath(this.staticGraphics, c.x, c.y, c.hexSize);
    this.staticGraphics.fillPath();

    this.staticGraphics.lineStyle(3, c.colors.border, 0.5);
    this.drawHexPath(this.staticGraphics, c.x, c.y, c.hexSize);
    this.staticGraphics.strokePath();

    // 2. Slots de Vida VAZIOS (Cinza Escuro)
    const startX = c.x + c.hexSize + 15;
    const startY = c.y - c.segmentHeight / 2;

    this.staticGraphics.fillStyle(c.colors.hpEmpty, 0.5);

    for (let i = 0; i < c.totalSegments; i++) {
      const segX = startX + i * (c.segmentWidth + c.segmentGap);
      this.drawSkewedRect(
        this.staticGraphics,
        segX,
        startY,
        c.segmentWidth,
        c.segmentHeight,
        c.segmentSkew,
      );
      this.staticGraphics.fillPath();
    }
  }

  // =================================================================
  // CAMADA 2: DINÂMICA (Barras coloridas, XP, Brilhos)
  // =================================================================
  private drawDynamicLayer(max: number, currentXP: number): void {
    this.dynamicGraphics.clear();
    const c = this.config;

    // 1. Borda de XP (Progresso)
    const xpInfo = XPTable.getLevelInfo(currentXP);
    if (xpInfo.progress > 0) {
      this.dynamicGraphics.lineStyle(3, c.colors.xpActive, 1);
      this.drawPartialHexagon(
        this.dynamicGraphics,
        c.x,
        c.y,
        c.hexSize,
        xpInfo.progress,
      );
      this.dynamicGraphics.strokePath();
    }

    // 2. Segmentos de Vida (Ativos e Fantasma)
    const startX = c.x + c.hexSize + 15;
    const startY = c.y - c.segmentHeight / 2;
    const hpPerSegment = max / c.totalSegments;

    const isCritical = this.displayedHealth / max < 0.3;
    const activeColor = isCritical ? c.colors.hpLow : c.colors.hpFull;

    for (let i = 0; i < c.totalSegments; i++) {
      const segX = startX + i * (c.segmentWidth + c.segmentGap);
      const segmentStartVal = i * hpPerSegment;

      // Barra Fantasma
      let ghostRatio = (this.ghostHealth - segmentStartVal) / hpPerSegment;

      // Otimização matemática: se ratio <= 0, nem tenta desenhar
      if (ghostRatio > 0) {
        ghostRatio = ghostRatio > 1 ? 1 : ghostRatio; // Clamp manual rápido

        this.dynamicGraphics.fillStyle(c.colors.hpGhost, 0.6);
        const ghostW = c.segmentWidth * ghostRatio;
        this.drawSkewedRect(
          this.dynamicGraphics,
          segX,
          startY,
          ghostW,
          c.segmentHeight,
          c.segmentSkew,
        );
        this.dynamicGraphics.fillPath();
      }

      // Barra Real
      let realRatio = (this.displayedHealth - segmentStartVal) / hpPerSegment;

      if (realRatio > 0) {
        realRatio = realRatio > 1 ? 1 : realRatio; // Clamp manual rápido

        this.dynamicGraphics.fillStyle(activeColor, 1);
        const realW = c.segmentWidth * realRatio;
        this.drawSkewedRect(
          this.dynamicGraphics,
          segX,
          startY,
          realW,
          c.segmentHeight,
          c.segmentSkew,
        );
        this.dynamicGraphics.fillPath();

        // Brilho (Opcional - se pesar, remova este bloco)
        this.dynamicGraphics.fillStyle(0xffffff, 0.3);
        this.drawSkewedRect(
          this.dynamicGraphics,
          segX,
          startY,
          realW,
          c.segmentHeight / 2,
          c.segmentSkew,
        );
        this.dynamicGraphics.fillPath();
      }
    }
  }

  // =================================================================
  // FUNÇÕES AUXILIARES DE DESENHO (Agora recebem o graphics alvo)
  // =================================================================

  private drawHexPath(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
  ) {
    g.beginPath();
    const startAngle = -90;
    // Otimização: Loop fixo é mais rápido
    for (let i = 0; i <= 6; i++) {
      const angle = Phaser.Math.DegToRad(startAngle + i * 60);
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  }

  private drawPartialHexagon(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    percent: number,
  ) {
    const totalSides = 6;
    const progressTotal = percent * totalSides;
    const fullSides = Math.floor(progressTotal);
    const partialSideFactor = progressTotal - fullSides;

    g.beginPath();
    const startAngle = -90;
    const startRad = Phaser.Math.DegToRad(startAngle);
    g.moveTo(x + radius * Math.cos(startRad), y + radius * Math.sin(startRad));

    for (let i = 1; i <= fullSides + 1; i++) {
      const angleDeg = startAngle + i * 60;
      const rad = Phaser.Math.DegToRad(angleDeg);
      const px = x + radius * Math.cos(rad);
      const py = y + radius * Math.sin(rad);

      if (i === fullSides + 1) {
        const prevAngle = startAngle + (i - 1) * 60;
        const prevRad = Phaser.Math.DegToRad(prevAngle);
        const prevX = x + radius * Math.cos(prevRad);
        const prevY = y + radius * Math.sin(prevRad);

        const currentX = prevX + (px - prevX) * partialSideFactor;
        const currentY = prevY + (py - prevY) * partialSideFactor;
        g.lineTo(currentX, currentY);
      } else {
        g.lineTo(px, py);
      }
    }
  }

  private drawSkewedRect(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    skew: number,
  ) {
    g.beginPath();
    g.moveTo(x + skew, y);
    g.lineTo(x + w + skew, y);
    g.lineTo(x + w, y + h);
    g.lineTo(x, y + h);
    g.closePath();
  }

  public destroy(): void {
    this.staticGraphics.destroy();
    this.dynamicGraphics.destroy();
    this.levelText.destroy();
    this.hpText.destroy();
  }
}
