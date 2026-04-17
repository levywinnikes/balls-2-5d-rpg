type RuntimeErrorSource = "window.error" | "window.unhandledrejection" | "console.error";

export interface RuntimeErrorEntry {
  source: RuntimeErrorSource;
  message: string;
  stack?: string;
  timestamp: number;
}

export class RuntimeErrorMonitor {
  private static installed = false;
  private static readonly MAX_ERRORS = 80;
  private static readonly errors: RuntimeErrorEntry[] = [];
  private static originalConsoleError: typeof console.error | null = null;

  public static install(): void {
    if (this.installed || typeof window === "undefined") return;

    window.addEventListener("error", (event) => {
      const err = event.error as Error | undefined;
      this.record({
        source: "window.error",
        message: event.message || err?.message || "Unknown runtime error",
        stack: err?.stack,
        timestamp: Date.now(),
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      if (reason instanceof Error) {
        this.record({
          source: "window.unhandledrejection",
          message: reason.message,
          stack: reason.stack,
          timestamp: Date.now(),
        });
        return;
      }

      this.record({
        source: "window.unhandledrejection",
        message: typeof reason === "string" ? reason : JSON.stringify(reason),
        timestamp: Date.now(),
      });
    });

    this.originalConsoleError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      const normalized = args
        .map((arg) => {
          if (arg instanceof Error) return arg.message;
          if (typeof arg === "string") return arg;
          try {
            return JSON.stringify(arg);
          } catch (_e) {
            return String(arg);
          }
        })
        .join(" ");

      this.record({
        source: "console.error",
        message: normalized,
        timestamp: Date.now(),
      });

      if (this.originalConsoleError) {
        this.originalConsoleError(...args);
      }
    };

    this.installed = true;
  }

  public static clear(): void {
    this.errors.length = 0;
  }

  public static getErrors(): RuntimeErrorEntry[] {
    return [...this.errors];
  }

  public static hasErrors(): boolean {
    return this.errors.length > 0;
  }

  private static record(entry: RuntimeErrorEntry): void {
    this.errors.push(entry);
    if (this.errors.length > this.MAX_ERRORS) {
      this.errors.splice(0, this.errors.length - this.MAX_ERRORS);
    }
  }
}
