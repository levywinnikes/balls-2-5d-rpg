export interface SliceInputManagerConfig {
  canvas: HTMLCanvasElement;
  isPaused: () => boolean;
  isPlayerDeathSequenceActive: () => boolean;
  isFirstPerson: () => boolean;
  ensureAudioReady: () => Promise<void>;
  onCastRune: () => void;
  onCycleRuneSlot: () => void;
  onToggleDebugColliders: () => void;
  onToggleCameraMode: (firstPerson: boolean) => void;
  onCycleCameraPreset: () => void;
  onToggleFallSafety: () => void;
  onInteract: () => void;
}

export class SliceInputManager {
  private config: SliceInputManagerConfig;
  private pressedKeys = new Set<string>();
  private jumpRequested = false;

  constructor(config: SliceInputManagerConfig) {
    this.config = config;
    this.setupListeners();
  }

  private setupListeners(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.config.canvas.addEventListener("contextmenu", this.handleContextMenu);
    this.config.canvas.addEventListener("pointerdown", this.handlePointerDown);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.config.isPaused() || this.config.isPlayerDeathSequenceActive()) {
      return;
    }
    void this.config.ensureAudioReady();

    const key = event.key.toLowerCase();
    this.pressedKeys.add(key);

    if (event.code === "Space") {
      this.jumpRequested = true;
      event.preventDefault();
    }

    if (key === "g" && !event.repeat) {
      this.config.onToggleDebugColliders();
    }

    if (key === "v" && !event.repeat) {
      this.config.onToggleCameraMode(!this.config.isFirstPerson());
    }

    if (key === "c" && !event.repeat) {
      if (this.config.isFirstPerson()) {
        return;
      }
      this.config.onCycleCameraPreset();
    }

    if (key === "f" && !event.repeat) {
      this.config.onToggleFallSafety();
    }

    if (key === "q" && !event.repeat) {
      this.config.onCastRune();
    }

    if (key === "r" && !event.repeat) {
      this.config.onCycleRuneSlot();
    }

    if (key === "e" && !event.repeat) {
      this.config.onInteract();
    }
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.key.toLowerCase());
  };

  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private handlePointerDown = (): void => {
    if (this.config.isPaused() || this.config.isPlayerDeathSequenceActive()) {
      return;
    }
    this.requestPointerLockIfPossible();
  };

  public requestPointerLockIfPossible(): void {
    if (!this.config.isFirstPerson() || document.pointerLockElement === this.config.canvas) {
      return;
    }

    try {
      this.config.canvas.requestPointerLock?.();
    } catch {
      // Browser blocks pointer lock outside user gesture; ignore and retry.
    }
  }

  public isKeyPressed(key: string): boolean {
    return this.pressedKeys.has(key.toLowerCase());
  }

  public getMovementInput(): { moveForward: number; moveRight: number } {
    let moveForward = 0;
    let moveRight = 0;

    if (this.pressedKeys.has("w") || this.pressedKeys.has("arrowup")) moveForward += 1;
    if (this.pressedKeys.has("s") || this.pressedKeys.has("arrowdown")) moveForward -= 1;
    if (this.pressedKeys.has("a") || this.pressedKeys.has("arrowleft")) moveRight -= 1;
    if (this.pressedKeys.has("d") || this.pressedKeys.has("arrowright")) moveRight += 1;

    return { moveForward, moveRight };
  }

  public consumeJumpRequested(): boolean {
    const requested = this.jumpRequested;
    this.jumpRequested = false;
    return requested;
  }

  public clearPressedKeys(): void {
    this.pressedKeys.clear();
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.config.canvas.removeEventListener("contextmenu", this.handleContextMenu);
    this.config.canvas.removeEventListener("pointerdown", this.handlePointerDown);
  }
}
