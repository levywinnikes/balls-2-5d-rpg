import React from "react";
import { HeroMenuContent } from "../../windows/HeroMenu";
import { SettingsContent } from "../../windows/SettingsUI";
import { ExpandedMapContent } from "../../windows/ExpandedMapWindow";
import { ContainerContent } from "../../windows/ContainerWindow";
import { AltarContent } from "../../windows/AltarWindow";
import { QuestLogContent } from "../../windows/QuestLogWindow";
import { CheatsContent } from "../../windows/CheatsWindow";

// Registry Type
export type WindowContentComponent = React.FC<any>;

interface RegistryEntry {
    component: WindowContentComponent;
    defaultTitle: string;
    defaultWidth: number;
    defaultHeight: number;
}

// Singleton Registry
class WindowRegistry {
    private static registry: Record<string, RegistryEntry> = {};

    public static register(id: string, component: WindowContentComponent, defaultTitle: string, defaultWidth: number, defaultHeight: number) {
        this.registry[id] = { component, defaultTitle, defaultWidth, defaultHeight };
    }

    public static get(id: string): RegistryEntry | undefined {
        return this.registry[id];
    }
}

// Pre-Register Windows (Ideally this would be done in a bootstrap, but we can do it here side-effect style or in App)
// For now, let's keep it simple and register via a helper or import 


WindowRegistry.register("hero_menu", HeroMenuContent, "Hero", 800, 600);
WindowRegistry.register("settings", SettingsContent, "Settings", 300, 550);
WindowRegistry.register("expandedMap", ExpandedMapContent, "World Map", 900, 650);
WindowRegistry.register("questLog", QuestLogContent, "Quest Log", 700, 500);
WindowRegistry.register("container", ContainerContent, "Container", 300, 200);
WindowRegistry.register("altar", AltarContent, "Altar", 440, 420);
WindowRegistry.register("cheats", CheatsContent, "Cheats", 380, 580);

export { WindowRegistry };
