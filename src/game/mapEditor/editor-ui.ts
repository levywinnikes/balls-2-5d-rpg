import { TileRegistry } from "../graphics/tiles/TileRegistry";
import { MapEditorScene } from "../scenes/MapEditorScene";
import { MultiLevelMapData, LevelData } from "../maps/MapTypes";

export type { MultiLevelMapData, LevelData }; // Re-export for compatibility if needed

export function setupEditorUI(
  scene: MapEditorScene,
  mapData: MultiLevelMapData
): void {
  const sidebar = document.getElementById("editor-sidebar");
  const levelSelect = document.getElementById(
    "level-select"
  ) as HTMLSelectElement;
  const tileList = document.getElementById("tile-list");
  const entityList = document.getElementById("entity-list");
  const saveButton = document.getElementById("save-button");
  const jsonUpload = document.getElementById("json-upload") as HTMLInputElement;

  if (
    !sidebar ||
    !levelSelect ||
    !tileList ||
    !entityList ||
    !saveButton ||
    !jsonUpload
  ) {
    console.error("Editor UI elements not found");
    return;
  }

  // Mostrar sidebar quando o editor estiver ativo
  sidebar.classList.add("active");

  // Preencher seleção de níveis
  levelSelect.innerHTML = "";
  Object.keys(mapData.levels).forEach((level) => {
    const option = document.createElement("option");
    option.value = level;
    option.textContent = `Level ${level}`;
    levelSelect.appendChild(option);
  });
  levelSelect.value = (scene as any).currentLevel;
  levelSelect.addEventListener("change", () => {
    scene.setLevel(levelSelect.value);
  });

  // Preencher lista de tiles
  tileList.innerHTML = "";
  TileRegistry.tiles.forEach((tile, key) => {
    const div = document.createElement("div");
    div.className = "tile-option";
    div.textContent = tile.id;
    div.addEventListener("click", () => {
      (scene as any).selectedTile = key;
      (scene as any).selectedEntity = null;
      document
        .querySelectorAll(".tile-option, .entity-option")
        .forEach((el) => el.classList.remove("selected"));
      div.classList.add("selected");
    });
    tileList.appendChild(div);
  });

  // Preencher lista de entidades
  entityList.innerHTML = "";
  if (mapData.entityTemplates) {
    Object.entries(mapData.entityTemplates).forEach(([key, entity]: [string, any]) => {
      const div = document.createElement("div");
      div.className = "entity-option";
      div.textContent = entity.id || entity.type; 
      div.addEventListener("click", () => {
        (scene as any).selectedEntity = key;
        (scene as any).selectedTile = null;
        document
          .querySelectorAll(".tile-option, .entity-option")
          .forEach((el) => el.classList.remove("selected"));
        div.classList.add("selected");
      });
      entityList.appendChild(div);
    });
  }

  // Carregar JSON
  jsonUpload.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const newMapData: MultiLevelMapData = JSON.parse(
            e.target?.result as string
          );
          const mapName =
            newMapData.mapName || scene.registry.get("currentMap") || "newmap";
          scene.cache.json.add(`${mapName}_data`, newMapData);
          await (scene as any).mapLoader.loadAllLevels(mapName);
          (scene as any).mapData = newMapData;
          scene.setLevel("0");
          levelSelect.innerHTML = "";
          Object.keys(newMapData.levels).forEach((level) => {
            const option = document.createElement("option");
            option.value = level;
            option.textContent = `Level ${level}`;
            levelSelect.appendChild(option);
          });
          levelSelect.value = "0";
          // Explicitly call renderMap as a method
          (scene as any).renderMap();
        } catch (error) {
          console.error("Error loading JSON:", error);
        }
      };
      reader.readAsText(file);
    }
  });

  // Salvar JSON
  saveButton.addEventListener("click", () => {
    const formatJson = (obj: any, indentLevel: number = 0): string => {
      const indent = "  ".repeat(indentLevel);
      if (Array.isArray(obj)) {
        if (obj.length > 0 && Array.isArray(obj[0])) {
          const rows = obj.map(
            (row: string[]) =>
              `${indent}  [${row.map((item) => `"${item}"`).join(", ")}]`
          );
          return `[\n${rows.join(",\n")}\n${indent}]`;
        }
        const items = obj.map((item: any) => formatJson(item, indentLevel + 1));
        return `[\n${items.join(",\n")}\n${indent}]`;
      } else if (obj !== null && typeof obj === "object") {
        const entries = Object.entries(obj).map(([key, value]) => {
          if (
            key === "map" &&
            Array.isArray(value) &&
            value.every((row: any) => Array.isArray(row))
          ) {
            return `${indent}  "${key}": ${formatJson(value, indentLevel)}`;
          }
          return `${indent}  "${key}": ${formatJson(value, indentLevel + 1)}`;
        });
        return `{\n${entries.join(",\n")}\n${indent}}`;
      } else if (typeof obj === "string") {
        return `"${obj}"`;
      } else {
        return JSON.stringify(obj);
      }
    };

    const jsonString = formatJson(scene.getMapData());
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scene.registry.get("currentMap") || "map"}_edited.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Esconder sidebar quando a cena for destruída
  scene.events.on("shutdown", () => {
    sidebar.classList.remove("active");
  });
}
