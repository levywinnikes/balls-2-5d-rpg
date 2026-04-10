import Phaser from "phaser";

export class DraggableWindow {
  private scene: Phaser.Scene;
  public window: Phaser.GameObjects.Container;
  public content: Phaser.GameObjects.Container;
  private isDragging: boolean = false;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  public width: number;
  public height: number;
  public windowType: string;
  private static activeWindow: DraggableWindow | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    content: Phaser.GameObjects.Container,
    windowType: string
  ) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.windowType = windowType;

    this.window = scene.add.container(x, y).setScrollFactor(0).setDepth(1000);

    const background = scene.add
      .rectangle(0, 0, width, height, 0x333333, 0.9)
      .setStrokeStyle(2, 0xcccccc)
      .setScrollFactor(0)
      .setDepth(1001);

    const titleBar = scene.add
      .rectangle(0, -height / 2 + 15, width, 30, 0x555555, 1)
      .setScrollFactor(0)
      .setDepth(1002)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", this.startDrag.bind(this));

    const titleText = scene.add
      .text(0, -height / 2 + 15, title, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1003);

    const closeButton = scene.add
      .rectangle(width / 2 - 20, -height / 2 + 15, 20, 20, 0xff5555)
      .setScrollFactor(0)
      .setDepth(1003)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.close())
      .on("pointerover", () => closeButton.setFillStyle(0xff7777))
      .on("pointerout", () => closeButton.setFillStyle(0xff5555));

    const closeText = scene.add
      .text(width / 2 - 20, -height / 2 + 15, "X", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1004);

    this.content = content.setScrollFactor(0).setDepth(1001);
    this.content.setPosition(0, 0);

    this.window.add([
      background,
      titleBar,
      titleText,
      closeButton,
      closeText,
      this.content,
    ]);

    this.scene.input.off("pointermove", this.drag.bind(this));
    this.scene.input.off("pointerup", this.stopDrag.bind(this));
    this.scene.input.on("pointermove", this.drag.bind(this));
    this.scene.input.on("pointerup", this.stopDrag.bind(this));
  }

  private startDrag(pointer: Phaser.Input.Pointer): void {
    if (DraggableWindow.activeWindow && DraggableWindow.activeWindow !== this) {
      return;
    }
    this.isDragging = true;
    DraggableWindow.activeWindow = this;
    this.dragOffset = {
      x: pointer.x - this.window.x,
      y: pointer.y - this.window.y,
    };
    this.window.setDepth(1300); // Higher depth while dragging for better UX
  }

  private drag(pointer: Phaser.Input.Pointer): void {
    if (this.isDragging && DraggableWindow.activeWindow === this) {
      this.window.setPosition(
        pointer.x - this.dragOffset.x,
        pointer.y - this.dragOffset.y
      );
      this.constrainToScreen();
    }
  }

  private constrainToScreen(): void {
    const padding = 20;
    const { width, height } = this.scene.game.config;
    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;

    this.window.x = Phaser.Math.Clamp(
      this.window.x,
      halfWidth + padding,
      Number(width) - halfWidth - padding
    );

    this.window.y = Phaser.Math.Clamp(
      this.window.y,
      halfHeight + padding,
      Number(height) - halfHeight - padding
    );
  }

  private stopDrag(): void {
    if (this.isDragging) {
      this.isDragging = false;
      DraggableWindow.activeWindow = null;
      this.window.setDepth(1200); // Reset to normal depth after dragging
      this.scene.events.emit("windowMoved", {
        type: this.windowType,
        x: this.window.x,
        y: this.window.y,
      });
    }
  }

  public close(destroy: boolean = false): void {
    if (this.isDragging) {
      this.stopDrag();
    }
    if (destroy) {
      this.window.destroy();
    } else {
      this.window.setVisible(false);
      this.window.setActive(false);
    }
  }

  public show(): void {
    this.window.setVisible(true);
    this.window.setActive(true);
  }

  public updateContent(newContent: Phaser.GameObjects.Container): void {
    this.window.remove(this.content, true);
    this.content = newContent.setScrollFactor(0);
    this.window.add(this.content);
    this.content.setPosition(0, 0);
  }

  public get isOpen(): boolean {
    return this.window.active && this.window.visible;
  }

  public setPosition(x: number, y: number): void {
    this.window.setPosition(x, y);
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.window.x, y: this.window.y };
  }

  public getBounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      this.window.x - this.width / 2,
      this.window.y - this.height / 2,
      this.width,
      this.height
    );
  }

  public setDepth(depth: number): void {
    this.window.setDepth(depth);
  }
}
