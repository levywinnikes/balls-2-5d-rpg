type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  ts: number;
  level: LogLevel;
  category: string;
  msg: string;
  data?: Record<string, unknown>;
}

const MAX_ENTRIES = 5000;

class PhysicsLogger {
  private entries: LogEntry[] = [];
  private enabled = false;
  private overlayEl: HTMLDivElement | null = null;
  private overlayVisible = false;

  enable() {
    this.enabled = true;
    this.log("info", "logger", "Logging enabled");
  }

  disable() {
    this.enabled = false;
    this.log("info", "logger", "Logging disabled");
  }

  toggle() {
    if (this.enabled) this.disable();
    else this.enable();
  }

  get isEnabled() {
    return this.enabled;
  }

  log(level: LogLevel, category: string, msg: string, data?: Record<string, unknown>) {
    if (!this.enabled) return;
    this.entries.push({ ts: performance.now(), level, category, msg, data });
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
    const prefix = `[${category}]`;
    switch (level) {
      case "error": console.error(prefix, msg, data ?? ""); break;
      case "warn":  console.warn(prefix, msg, data ?? ""); break;
      default:      console.log(prefix, msg, data ?? "");
    }
    if (this.overlayVisible) this.updateOverlay();
  }

  info(category: string, msg: string, data?: Record<string, unknown>) {
    this.log("info", category, msg, data);
  }
  warn(category: string, msg: string, data?: Record<string, unknown>) {
    this.log("warn", category, msg, data);
  }
  error(category: string, msg: string, data?: Record<string, unknown>) {
    this.log("error", category, msg, data);
  }
  debug(category: string, msg: string, data?: Record<string, unknown>) {
    this.log("debug", category, msg, data);
  }

  getEntries(): ReadonlyArray<LogEntry> {
    return this.entries;
  }

  clear() {
    this.entries = [];
    if (this.overlayVisible) this.updateOverlay();
  }

  download(filename = "physics-log.json") {
    const blob = new Blob([JSON.stringify(this.entries, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  showOverlay(container?: HTMLElement) {
    if (this.overlayEl) return;
    const el = document.createElement("div");
    el.id = "__physicsLoggerOverlay";
    el.style.cssText = `
      position: fixed; top: 8px; right: 8px; width: 420px; max-height: 80vh;
      background: rgba(0,0,0,0.85); color: #0f0; font: 11px/1.4 monospace;
      padding: 8px; border-radius: 6px; overflow-y: auto; z-index: 9999;
      pointer-events: auto;
    `;
    (container ?? document.body).appendChild(el);
    this.overlayEl = el;
    this.overlayVisible = true;
    this.updateOverlay();
  }

  hideOverlay() {
    this.overlayEl?.remove();
    this.overlayEl = null;
    this.overlayVisible = false;
  }

  toggleOverlay(container?: HTMLElement) {
    if (this.overlayVisible) this.hideOverlay();
    else this.showOverlay(container);
  }

  private updateOverlay() {
    if (!this.overlayEl) return;
    const recent = this.entries.slice(-30).reverse();
    this.overlayEl.innerHTML = recent
      .map(
        (e) =>
          `<div style="color:${e.level === "error" ? "#f44" : e.level === "warn" ? "#fa0" : "#0f0"}">
            ${e.category} ${e.msg}${e.data ? " " + JSON.stringify(e.data) : ""}
          </div>`,
      )
      .join("");
    this.overlayEl.scrollTop = 0;
  }
}

export const physicsLogger = new PhysicsLogger();

if (typeof window !== "undefined") {
  (window as any).__physicsLogger = physicsLogger;
  (window as any).__pl = physicsLogger;
}
