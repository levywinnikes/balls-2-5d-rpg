/**
 * BENCHMARK RUNNER
 * Encapsulates all E2E benchmark logic and step execution.
 * Extracted from GameScene for modularity and maintainability.
 */

import Phaser from "phaser";
import { PlayerState } from "../entities/Player/PlayerState";
import { RuntimeErrorMonitor } from "../services/RuntimeErrorMonitor";
import { t_game } from "../i18n/translations";
import { QuestManager } from "./QuestManager";
import { TransitionSystem } from "./TransitionSystem";
import { SaveSystem } from "./SaveSystem";

export interface BenchmarkErrorContext {
  stepLabel: string;
  expectedBehavior: string;
  actualBehavior: string;
  relevantState?: Record<string, any>;
  stackTrace?: string;
  timestamp: number;
}

export interface BenchmarkStepResult {
  label: string;
  ok: boolean;
  durationMs: number;
  error?: string;
  errorContext?: BenchmarkErrorContext;
}

export interface BenchmarkConfig {
  benchmarkName: string;
  benchmarkAutoClose: boolean;
  benchmarkReportPath: string | null;
}

export class BenchmarkRunner {
  private scene: Phaser.Scene;
  private transitionSystem: TransitionSystem | null;
  private saveSystem: SaveSystem;
  private player: any;
  private pickupZone: any;
  private pathfindingManager: any;
  private mapLoader: any;
  private config: BenchmarkConfig;

  private benchmarkStarted: boolean = false;

  private getBenchmarkStepLabel(key: string): string {
    return t_game(key as any);
  }

  // Scene-level getter/setter callbacks
  private getPickupZonePosition: () => { x: number; y: number } = () => ({
    x: 0,
    y: 0,
  });
  private getCurrentLevelCallback: () => string = () => "0";
  private getNearbyItemsCallback: (distance: number) => any[] = () => [];
  private pickupNearbyItemCallback: () => void = () => {};
  private clickFirstMatchingButtonCallback: (
    titles: string[],
  ) => string | null = () => null;

  constructor(
    scene: Phaser.Scene,
    config: BenchmarkConfig,
    dependencies: {
      player: any;
      pickupZone: any;
      pathfindingManager: any;
      mapLoader: any;
      transitionSystem: TransitionSystem | null;
      saveSystem: SaveSystem;
      getCurrentLevel: () => string;
      getNearbyItems: (distance: number) => any[];
      pickupNearbyItem: () => void;
      clickFirstMatchingButton: (titles: string[]) => string | null;
    },
  ) {
    this.scene = scene;
    this.config = config;
    this.player = dependencies.player;
    this.pickupZone = dependencies.pickupZone;
    this.pathfindingManager = dependencies.pathfindingManager;
    this.mapLoader = dependencies.mapLoader;
    this.transitionSystem = dependencies.transitionSystem;
    this.saveSystem = dependencies.saveSystem;
    this.getCurrentLevelCallback = dependencies.getCurrentLevel;
    this.getNearbyItemsCallback = dependencies.getNearbyItems;
    this.pickupNearbyItemCallback = dependencies.pickupNearbyItem;
    this.clickFirstMatchingButtonCallback =
      dependencies.clickFirstMatchingButton;
  }

  private benchmarkDelay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  private createBenchmarkErrorContext(options: {
    stepLabel: string;
    expectedBehavior: string;
    actualBehavior: string;
    error: Error;
    relevantState?: Record<string, any>;
  }): BenchmarkErrorContext {
    return {
      stepLabel: options.stepLabel,
      expectedBehavior: options.expectedBehavior,
      actualBehavior: options.actualBehavior,
      relevantState: options.relevantState,
      stackTrace: options.error.stack,
      timestamp: performance.now(),
    };
  }

  private clickButtonByTitle(title: string): boolean {
    const button = Array.from(document.querySelectorAll("button")).find(
      (element) => element.getAttribute("title") === title,
    ) as HTMLButtonElement | undefined;

    if (!button) return false;
    button.click();
    return true;
  }

  private clickButtonByText(text: string): boolean {
    const button = Array.from(document.querySelectorAll("button")).find(
      (element) => element.textContent?.includes(text),
    ) as HTMLButtonElement | undefined;

    if (!button) return false;
    button.click();
    return true;
  }

  private clickButtonByBenchmarkId(benchmarkId: string): boolean {
    const button = document.querySelector(
      `button[data-benchmark-id="${benchmarkId}"]`,
    ) as HTMLButtonElement | null;

    if (!button) return false;
    button.click();
    return true;
  }

  private clickElementByTitlePrefix(prefix: string): string | null {
    const element = Array.from(document.querySelectorAll("[title]")).find(
      (target) => target.getAttribute("title")?.startsWith(prefix),
    ) as HTMLElement | undefined;

    if (!element) return null;

    const title = element.getAttribute("title");
    element.click();
    return title;
  }

  private async waitForButtonByTitle(
    title: string,
    timeoutMs: number = 1500,
    intervalMs: number = 50,
  ): Promise<boolean> {
    const startedAt = performance.now();

    while (performance.now() - startedAt < timeoutMs) {
      if (
        Array.from(document.querySelectorAll("button")).some(
          (element) => element.getAttribute("title") === title,
        )
      ) {
        return true;
      }

      await this.benchmarkDelay(intervalMs);
    }

    return false;
  }

  private async runHudPauseWindowStep(options: {
    windowKey: string;
    openButtonTitle: string;
    openButtonTitles?: string[];
    openButtonBenchmarkId?: string;
    closeButtonTitle?: string;
    closeButtonText?: string;
    closeButtonTexts?: string[];
    closeButtonBenchmarkId?: string;
    missingOpenError: string;
    missingCloseError: string;
  }): Promise<boolean> {
    const before = (window as any).__uiWindows?.[options.windowKey] ?? false;
    const sceneWasPausedBefore = this.scene.scene.isPaused("GameScene");

    const openTitles = options.openButtonTitles ?? [options.openButtonTitle];
    const openClicked =
      (options.openButtonBenchmarkId
        ? this.clickButtonByBenchmarkId(options.openButtonBenchmarkId)
        : false) ||
      this.clickFirstMatchingButtonCallback(openTitles) !== null ||
      openTitles.some((title) => this.clickButtonByTitle(title));

    if (!openClicked) {
      throw new Error(options.missingOpenError);
    }

    await this.benchmarkDelay(200);
    const opened = (window as any).__uiWindows?.[options.windowKey] ?? false;
    const scenePausedAfterOpen = this.scene.scene.isPaused("GameScene");

    const closeTexts = options.closeButtonTexts ??
      (options.closeButtonText ? [options.closeButtonText] : []);
    const closeClicked =
      (options.closeButtonBenchmarkId
        ? this.clickButtonByBenchmarkId(options.closeButtonBenchmarkId)
        : false) ||
      (options.closeButtonTitle
        ? this.clickButtonByTitle(options.closeButtonTitle)
        : closeTexts.length > 0
          ? closeTexts.some((text) => this.clickButtonByText(text))
          : false);

    if (!closeClicked) {
      throw new Error(options.missingCloseError);
    }

    await this.benchmarkDelay(200);
    const closed = (window as any).__uiWindows?.[options.windowKey] ?? false;
    const sceneResumedAfterClose = !this.scene.scene.isPaused("GameScene");

    return (
      !before &&
      opened &&
      !closed &&
      !sceneWasPausedBefore &&
      scenePausedAfterOpen &&
      sceneResumedAfterClose
    );
  }

  private moveBenchmarkPlayer(x: number, y: number): void {
    if (!this.player || !this.player.sprite) return;
    this.player.sprite.setPosition(x, y);
    this.player.sprite.body?.updateFromGameObject();
    if (this.pickupZone) {
      this.pickupZone.setPosition(x, y);
    }
  }

  private showBenchmarkSummary(
    passed: boolean,
    steps: BenchmarkStepResult[],
    totalMs: number,
  ): void {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    const panelWidth = Math.min(760, width - 48);
    const lines: string[] = [
      `${this.config.benchmarkName} ${t_game(passed ? "benchmark_status_pass" : "benchmark_status_fail")}`,
      `${t_game("benchmark_summary_total")}: ${(totalMs / 1000).toFixed(2)}s`,
      "",
    ];

    steps.forEach((step, i) => {
      const status = t_game(
        step.ok ? "benchmark_status_pass" : "benchmark_status_fail",
      );
      const timing = `${(step.durationMs / 1000).toFixed(2)}s`;
      const extra = step.error ? ` (${step.error})` : "";
      lines.push(`${i + 1}. ${status} ${step.label} - ${timing}${extra}`);

      // Add structured error context if available
      if (!step.ok && step.errorContext) {
        lines.push(
          `   ${t_game("benchmark_summary_expected")}: ${step.errorContext.expectedBehavior}`,
        );
        lines.push(
          `   ${t_game("benchmark_summary_actual")}: ${step.errorContext.actualBehavior}`,
        );
        if (step.errorContext.relevantState) {
          const stateStr = JSON.stringify(
            step.errorContext.relevantState,
          ).substring(0, 100);
          lines.push(`   ${t_game("benchmark_summary_state")}: ${stateStr}...`);
        }
      }
    });

    const panelHeight = Math.min(height - 56, 132 + steps.length * 40);

    const panelBg = (this.scene.add as any)
      .rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x000000, 0.88)
      .setStrokeStyle(2, passed ? 0x22c55e : 0xef4444, 0.9)
      .setScrollFactor(0)
      .setDepth(500000);

    const panelText = (this.scene.add as any)
      .text(
        width / 2 - panelWidth / 2 + 18,
        height / 2 - panelHeight / 2 + 16,
        lines.join("\n"),
        {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#f8fafc",
          wordWrap: { width: panelWidth - 36, useAdvancedWrap: true },
          lineSpacing: 4,
        },
      )
      .setScrollFactor(0)
      .setDepth(500001);

    this.scene.time.delayedCall(3600, () => {
      panelText.destroy();
      panelBg.destroy();
      window.dispatchEvent(new Event("returnToTitle"));
    });
  }

  private async publishBenchmarkResult(payload: {
    passed: boolean;
    totalMs: number;
    steps: BenchmarkStepResult[];
  }): Promise<void> {
    const runtimeErrors = RuntimeErrorMonitor.getErrors();
    const report = {
      benchmarkName: this.config.benchmarkName,
      map: this.scene.registry.get("currentMap") || "unknown",
      level: this.getCurrentLevelCallback(),
      passed: payload.passed,
      totalMs: payload.totalMs,
      completedAtIso: new Date().toISOString(),
      steps: payload.steps,
      runtimeErrors,
    };

    const electronAPI = (window as any).electronAPI;

    if (electronAPI?.writeBenchmarkReport && this.config.benchmarkReportPath) {
      const result = await electronAPI.writeBenchmarkReport(
        this.config.benchmarkReportPath,
        report,
      );
      if (!result?.success) {
        console.error(
          `[Benchmark] Failed to write report: ${result?.error || "unknown"}`,
        );
      } else {
        console.log(`[Benchmark] Report written to ${result.path}`);
      }
    } else {
      (window as any).__LAST_BENCHMARK_RESULT__ = report;
    }

    if (this.config.benchmarkAutoClose && electronAPI?.exitBenchmarkRun) {
      await this.benchmarkDelay(200);
      await electronAPI.exitBenchmarkRun(payload.passed ? 0 : 1);
      return;
    }

    this.showBenchmarkSummary(payload.passed, payload.steps, payload.totalMs);
  }

  public async run(): Promise<void> {
    if (this.benchmarkStarted || !this.player || !this.transitionSystem) {
      return;
    }
    this.benchmarkStarted = true;
    RuntimeErrorMonitor.clear();

    const benchmarkSaveName = `${this.config.benchmarkName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")}_${Date.now()}`;
    const questManager = QuestManager.getInstance();
    questManager.loadSaveData({ active: [], completed: [] });

    const playerState = PlayerState.getInstance();
    const startedAt = performance.now();
    const stepTimeoutMs = 8000;
    const stepResults: BenchmarkStepResult[] = [];
    const fail = (message: string) => {
      console.error(`[Benchmark] FAIL ${message}`);
      playerState.emit("uiNotification", { type: "error", message });
    };

    const step = async (
      label: string,
      expectedBehavior: string,
      action: () => Promise<boolean> | boolean,
    ) => {
      console.log(`[Benchmark] STEP ${label}`);
      playerState.emit("uiNotification", {
        type: "info",
        message: t_game("benchmark_notify_step")
          .replace("{name}", this.config.benchmarkName)
          .replace("{step}", label),
      });
      const t0 = performance.now();
      await this.benchmarkDelay(250);
      let ok = false;
      let errorMsg: string | undefined;
      let errorContext: BenchmarkErrorContext | undefined;
      try {
        ok = await Promise.race([
          Promise.resolve().then(action),
          new Promise<boolean>((_, reject) => {
            window.setTimeout(() => {
              reject(new Error(`step timeout after ${stepTimeoutMs}ms`));
            }, stepTimeoutMs);
          }),
        ]);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errorMsg = err.message;
        errorContext = this.createBenchmarkErrorContext({
          stepLabel: label,
          expectedBehavior,
          actualBehavior: errorMsg,
          error: err,
        });
      }

      const durationMs = performance.now() - t0;
      stepResults.push({
        label,
        ok,
        durationMs,
        error: ok ? undefined : errorMsg,
        errorContext: ok ? undefined : errorContext,
      });

      if (!ok) {
        throw new Error(errorMsg ? `${label}: ${errorMsg}` : label);
      }
    };

    let passed = false;
    try {
      await step(
        this.getBenchmarkStepLabel("benchmark_step_spawn_ready"),
        t_game("benchmark_expected_spawn_ready"),
        async () => {
          this.moveBenchmarkPlayer(96, 96);
          await this.benchmarkDelay(100);
          return this.getCurrentLevelCallback() === "0";
        },
      );

      await step(
        this.getBenchmarkStepLabel("benchmark_step_pickup_loot"),
        t_game("benchmark_expected_pickup_loot"),
        async () => {
          this.moveBenchmarkPlayer(336, 112);
          const maxAttempts = 5;

          for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            this.pickupNearbyItemCallback();
            await this.benchmarkDelay(120);

            const hasTorch = playerState
              .getInventory()
              .some((item) => item.itemId === "light_torch");

            if (hasTorch) {
              return true;
            }
          }

          const nearby = this.getNearbyItemsCallback(160).map((item) => ({
            weaponId: item.weaponId,
            level: item.level,
            x: item.x,
            y: item.y,
            count: item.count,
          }));
          const inventoryIds = playerState
            .getInventory()
            .map((item) => item.itemId)
            .slice(0, 12);

          throw new Error(
            `missing light_torch after pickup attempts | nearby=${JSON.stringify(nearby)} | inventory=${JSON.stringify(inventoryIds)}`,
          );
        },
      );

      await step(
        this.getBenchmarkStepLabel("benchmark_step_transition_down"),
        t_game("benchmark_expected_transition_down"),
        async () => {
          this.moveBenchmarkPlayer(272, 272);
          await this.transitionSystem!.tryManualTransition(8, 8, 32);
          await this.benchmarkDelay(350);
          return this.getCurrentLevelCallback() === "-1";
        },
      );

      await step(
        this.getBenchmarkStepLabel("benchmark_step_transition_up"),
        t_game("benchmark_expected_transition_up"),
        async () => {
          this.moveBenchmarkPlayer(272, 272);
          await this.transitionSystem!.tryManualTransition(8, 8, 32);
          await this.benchmarkDelay(350);
          return this.getCurrentLevelCallback() === "0";
        },
      );

      await step(
        this.getBenchmarkStepLabel("benchmark_step_pathfinding_route"),
        t_game("benchmark_expected_pathfinding_route"),
        async () => {
          if (!this.player || !this.player.sprite) {
            throw new Error("pathfinding not ready");
          }

          const tileSize = this.mapLoader.getTileSize();
          const startGrid = {
            x: Math.floor(this.player.sprite.x / tileSize),
            y: Math.floor(this.player.sprite.y / tileSize),
            level: this.getCurrentLevelCallback(),
          };

          const candidateTargets = [
            { x: 10, y: 3 },
            { x: 9, y: 3 },
            { x: 7, y: 3 },
            { x: 4, y: 4 },
          ];

          for (const target of candidateTargets) {
            const path = await this.pathfindingManager.requestPath(
              startGrid.x,
              startGrid.y,
              target.x,
              target.y,
            );

            if (path && path.length > 1) {
              return true;
            }
          }

          throw new Error("pathfinding route not found");
        },
      );

      await step(
        this.getBenchmarkStepLabel("benchmark_step_quest_log_sync"),
        t_game("benchmark_expected_quest_log_sync"),
        async () => {
          const started = questManager.startQuest("rat_plague");
          await this.benchmarkDelay(120);

          const saveData = questManager.getSaveData();
          const activeQuestIds = saveData.active.map(([questId]) => questId);

          return started && activeQuestIds.includes("rat_plague");
        },
      );

      await step(
        this.getBenchmarkStepLabel("benchmark_step_quest_log_window"),
        t_game("benchmark_expected_quest_log_window"),
        async () => {
          const before = (window as any).__uiWindows?.questLog ?? false;
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "l", bubbles: true }),
          );
          await this.benchmarkDelay(150);
          const opened = (window as any).__uiWindows?.questLog ?? false;

          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "l", bubbles: true }),
          );
          await this.benchmarkDelay(150);
          const closed = (window as any).__uiWindows?.questLog ?? false;

          return !before && opened && !closed;
        },
      );

      await step(
        this.getBenchmarkStepLabel("benchmark_step_hero_menu_window"),
        t_game("benchmark_expected_hero_menu_window"),
        async () => {
          const before = (window as any).__uiWindows?.heroMenu ?? false;
          const sceneWasPausedBefore = this.scene.scene.isPaused("GameScene");
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "i", bubbles: true }),
          );
          await this.benchmarkDelay(150);
          const opened = (window as any).__uiWindows?.heroMenu ?? false;
          const scenePausedAfterOpen = this.scene.scene.isPaused("GameScene");

          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "i", bubbles: true }),
          );
          await this.benchmarkDelay(150);
          const closed = (window as any).__uiWindows?.heroMenu ?? false;
          const sceneResumedAfterClose =
            !this.scene.scene.isPaused("GameScene");

          return (
            !before &&
            opened &&
            !closed &&
            !sceneWasPausedBefore &&
            scenePausedAfterOpen &&
            sceneResumedAfterClose
          );
        },
      );

      await step(
        this.getBenchmarkStepLabel("benchmark_step_system_menu_mouse_pause"),
        t_game("benchmark_expected_system_menu_mouse_pause"),
        async () => {
          return this.runHudPauseWindowStep({
            windowKey: "systemMenu",
            openButtonTitle: t_game("hud_system"),
            openButtonTitles: [t_game("hud_system"), "System Menu"],
            openButtonBenchmarkId: "hud-system-menu",
            closeButtonText: t_game("sys_resume"),
            closeButtonTexts: [t_game("sys_resume"), "Resume Game"],
            closeButtonBenchmarkId: "system-menu-resume",
            missingOpenError: "system menu HUD button not found",
            missingCloseError: "system menu resume button not found",
          });
        },
      );

      await step(
        this.getBenchmarkStepLabel("benchmark_step_settings_mouse_pause"),
        t_game("benchmark_expected_settings_mouse_pause"),
        async () => {
          return this.runHudPauseWindowStep({
            windowKey: "settings",
            openButtonTitle: t_game("settings"),
            openButtonTitles: [t_game("settings"), "Settings"],
            openButtonBenchmarkId: "hud-settings",
            closeButtonTitle: "Close Window",
            missingOpenError: "settings HUD button not found",
            missingCloseError: "settings close button not found",
          });
        },
      );

      await step(
        this.getBenchmarkStepLabel("benchmark_step_equipment_roundtrip"),
        t_game("benchmark_expected_equipment_roundtrip"),
        async () => {
          const ps = PlayerState.getInstance();
          const targetItemId = "torch";

          if (!this.clickButtonByTitle("Hero Menu")) {
            throw new Error("hero menu HUD button not found");
          }

          await this.benchmarkDelay(200);
          const opened = (window as any).__uiWindows?.heroMenu ?? false;
          if (!opened) {
            throw new Error("hero menu did not open for inventory test");
          }

          const swordSlot = this.clickElementByTitlePrefix(
            `Inventory Item: ${targetItemId}`,
          );

          if (!swordSlot) {
            throw new Error("starting weapon inventory slot not found");
          }

          await this.benchmarkDelay(150);

          if (!(await this.waitForButtonByTitle("Equip Item", 2500))) {
            throw new Error("equip action button not found");
          }

          if (!this.clickButtonByTitle("Equip Item")) {
            throw new Error("equip action button not found");
          }

          await this.benchmarkDelay(250);

          if (ps.getEquipment().mainHand?.itemId !== targetItemId) {
            throw new Error("main hand slot did not equip starting weapon");
          }

          if (!this.clickElementByTitlePrefix("Equipment Slot: mainHand")) {
            throw new Error("main hand equipment slot not found");
          }

          await this.benchmarkDelay(150);

          if (!(await this.waitForButtonByTitle("Unequip Item", 2500))) {
            throw new Error("unequip action button not found");
          }

          if (!this.clickButtonByTitle("Unequip Item")) {
            throw new Error("unequip action button not found");
          }

          await this.benchmarkDelay(250);

          const equipmentAfterUnequip = ps.getEquipment();
          const inventoryAfterUnequip = ps.getInventory();
          const weaponReturned = inventoryAfterUnequip.some(
            (item) => item.itemId === targetItemId,
          );

          if (equipmentAfterUnequip.mainHand !== null) {
            throw new Error("main hand slot did not unequip");
          }

          if (!weaponReturned) {
            throw new Error("unequipped weapon did not return to inventory");
          }

          const returnedWeaponSlot = this.clickElementByTitlePrefix(
            `Inventory Item: ${targetItemId}`,
          );

          if (!returnedWeaponSlot) {
            throw new Error("returned weapon inventory slot not found");
          }

          await this.benchmarkDelay(150);

          if (!(await this.waitForButtonByTitle("Equip Item", 2500))) {
            throw new Error("equip action button not found");
          }

          if (!this.clickButtonByTitle("Equip Item")) {
            throw new Error("equip action button not found");
          }

          await this.benchmarkDelay(250);

          const equipmentAfterEquip = ps.getEquipment();
          if (equipmentAfterEquip.mainHand?.itemId !== targetItemId) {
            throw new Error("main hand slot did not re-equip");
          }

          if (!this.clickButtonByTitle("Close Hero Menu")) {
            throw new Error("hero menu close button not found");
          }

          await this.benchmarkDelay(200);

          return (
            !(window as any).__uiWindows?.heroMenu &&
            !this.scene.scene.isPaused("GameScene")
          );
        },
      );

      await step(
        this.getBenchmarkStepLabel("benchmark_step_item_drop_roundtrip"),
        t_game("benchmark_expected_item_drop_roundtrip"),
        async () => {
          const ps = PlayerState.getInstance();
          const inventoryBeforeDrop = ps.getInventory();
          const targetItem =
            inventoryBeforeDrop.find((item) => item.itemId === "light_torch") ||
            inventoryBeforeDrop.find((item) => item.itemId === "torch");

          if (!targetItem) {
            throw new Error("drop test item not found in inventory");
          }

          if (!this.clickButtonByTitle("Hero Menu")) {
            throw new Error("hero menu HUD button not found");
          }

          await this.benchmarkDelay(200);
          if (!(window as any).__uiWindows?.heroMenu) {
            throw new Error("hero menu did not open for drop test");
          }

          const selectedInventoryItem = this.clickElementByTitlePrefix(
            `Inventory Item: ${targetItem.itemId}`,
          );

          if (!selectedInventoryItem) {
            throw new Error("drop test inventory slot not found");
          }

          await this.benchmarkDelay(150);

          if (!(await this.waitForButtonByTitle("Drop Item", 2500))) {
            throw new Error("drop action button not found");
          }

          if (!this.clickButtonByTitle("Drop Item")) {
            throw new Error("drop action button not found");
          }

          await this.benchmarkDelay(250);

          const removedFromInventory = !ps
            .getInventory()
            .some((item) => item.uid === targetItem.uid);

          if (!removedFromInventory) {
            throw new Error("item was not removed from inventory after drop");
          }

          if (!this.clickButtonByTitle("Close Hero Menu")) {
            throw new Error("hero menu close button not found");
          }

          await this.benchmarkDelay(200);

          if (
            (window as any).__uiWindows?.heroMenu ||
            this.scene.scene.isPaused("GameScene")
          ) {
            throw new Error("hero menu did not close after drop test");
          }

          const droppedNearby = this.getNearbyItemsCallback(160).some(
            (item) => item.weaponId === targetItem.itemId,
          );

          if (!droppedNearby) {
            throw new Error("dropped item not found on ground");
          }

          const pickupAttempts = 3;
          for (let attempt = 0; attempt < pickupAttempts; attempt += 1) {
            this.pickupNearbyItemCallback();
            await this.benchmarkDelay(120);

            const recoveredInInventory = ps
              .getInventory()
              .some((item) => item.itemId === targetItem.itemId);

            if (recoveredInInventory) {
              return true;
            }
          }

          throw new Error(
            "dropped item did not return to inventory after pickup",
          );
        },
      );

      await step(
        this.getBenchmarkStepLabel("benchmark_step_torch_light_roundtrip"),
        t_game("benchmark_expected_torch_light_roundtrip"),
        async () => {
          const ps = PlayerState.getInstance();

          if (!this.clickButtonByTitle("Hero Menu")) {
            throw new Error("hero menu HUD button not found");
          }

          await this.benchmarkDelay(200);
          if (!(window as any).__uiWindows?.heroMenu) {
            throw new Error("hero menu did not open for torch test");
          }

          const torchTitle =
            this.clickElementByTitlePrefix("Inventory Item: light_torch") ||
            this.clickElementByTitlePrefix("Inventory Item: torch");

          if (!torchTitle) {
            throw new Error("light_torch inventory slot not found");
          }

          await this.benchmarkDelay(150);

          const firstAction = this.clickFirstMatchingButtonCallback([
            "Light Item",
            "Extinguish Item",
          ]);

          if (!firstAction) {
            throw new Error("torch action button not found");
          }

          await this.benchmarkDelay(150);

          const stateOk =
            firstAction === "Light Item" ? ps.isTorchLit() : !ps.isTorchLit();

          if (!this.clickButtonByTitle("Hero Menu")) {
            throw new Error("hero menu close button not found");
          }

          await this.benchmarkDelay(200);
          const closed = !(window as any).__uiWindows?.heroMenu;

          return stateOk && closed && !this.scene.scene.isPaused("GameScene");
        },
      );

      await step(
        this.getBenchmarkStepLabel("benchmark_step_save_load_roundtrip"),
        t_game("benchmark_expected_save_load_roundtrip"),
        async () => {
          const currentMap =
            this.scene.registry.get("currentMap")?.toString() ?? "newmap";
          const saved = await this.saveSystem.saveGame(benchmarkSaveName);
          if (!saved) {
            throw new Error("saveGame returned false");
          }

          const loaded = await this.saveSystem.loadCharacter(benchmarkSaveName);
          if (!loaded) {
            throw new Error("loadCharacter returned null");
          }

          const snapshot = playerState.exportSnapshot();
          const expectedInventory = snapshot.inventory?.some(
            (item) => item.itemId === "light_torch",
          );
          const loadedInventory = loaded.playerState.inventory?.some(
            (item) => item.itemId === "light_torch",
          );
          const loadedQuestIds = Array.isArray(
            loaded.playerState.quests?.active,
          )
            ? loaded.playerState.quests.active.map(
                ([questId]: [string, any]) => questId,
              )
            : [];

          const isMatch =
            loaded.map === currentMap &&
            loaded.currentLevel === this.getCurrentLevelCallback() &&
            loaded.playerState.characterName === snapshot.characterName &&
            expectedInventory === loadedInventory &&
            loadedQuestIds.includes("rat_plague");

          if (!isMatch) {
            throw new Error(
              `loaded save mismatch | map=${loaded.map} level=${loaded.currentLevel} name=${loaded.playerState.characterName} inventoryMatch=${expectedInventory === loadedInventory} questMatch=${loadedQuestIds.includes("rat_plague")}`,
            );
          }

          return true;
        },
      );

      passed = true;
      console.log(
        `[Benchmark] PASS ${stepResults.length}/${stepResults.length} steps`,
      );
      playerState.emit("uiNotification", {
        type: "success",
        message: t_game("benchmark_notify_success")
          .replace("{name}", this.config.benchmarkName)
          .replace("{steps}", stepResults.length.toString()),
      });
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    } finally {
      const runtimeErrors = RuntimeErrorMonitor.getErrors();
      if (passed && runtimeErrors.length > 0) {
        passed = false;
        stepResults.push({
          label: t_game("benchmark_step_runtime_error_check"),
          ok: false,
          durationMs: 0,
          error: t_game("benchmark_runtime_errors_captured").replace(
            "{count}",
            runtimeErrors.length.toString(),
          ),
        });
      }

      await this.publishBenchmarkResult({
        passed,
        steps: stepResults,
        totalMs: performance.now() - startedAt,
      });

      try {
        await this.saveSystem.deleteCharacter(benchmarkSaveName);
      } catch (error) {
        console.warn(
          `[Benchmark] Failed to clean up temporary save ${benchmarkSaveName}`,
          error,
        );
      }
    }
  }
}
