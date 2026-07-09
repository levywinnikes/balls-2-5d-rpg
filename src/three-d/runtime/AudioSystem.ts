import { AudioManager } from "../../game/systems/AudioManager";

export class AudioSystem {
  readonly manager = AudioManager.getInstance();
  private ready = false;

  async ensureReady(): Promise<void> {
    if (this.ready) return;
    try {
      await this.manager.init();
      this.ready = true;
    } catch (error) {
      console.warn("[3D Slice] Audio init failed:", error);
    }
  }
}
