import { resolvePoolFloorMaterial } from "./PoolFloorResolver";

describe("PoolFloorResolver", () => {
  const makeDeps = (grid: Record<string, string | null> = {}) => ({
    mapDataCache: {
      width: 10,
      height: 10,
      levels: { "0": {} },
      tileDefinitions: {
        stone: { id: "stone" },
        grass: { id: "grass" },
        void_tile: { id: "void_tile", renderAs: "block" },
      },
    },
    getMapTileAt: (level: string, x: number, z: number) => {
      const key = `${x},${z}`;
      return key in grid ? grid[key] : null;
    },
    tileMaterialSystem: {
      getTileMaterial: (symbol: string, _def: any, _fallback: string) => ({ name: `mat_${symbol || "fallback"}` }),
    },
  });

  it("returns fallback (stone material) when all neighbors are water", () => {
    const deps = { ...makeDeps(), getMapTileAt: () => "water" as string | null };
    const mat = resolvePoolFloorMaterial(deps, "0", 5, 5);
    expect(mat).toBeDefined();
    // Fallback is hardcoded to use "stone" material
    expect((mat as any).name).toBe("mat_stone");
  });

  it("finds nearest non-water neighbor", () => {
    const deps = makeDeps({ "6,5": "stone" });
    const mat = resolvePoolFloorMaterial(deps, "0", 5, 5);
    expect((mat as any).name).toBe("mat_stone");
  });

  it("skips water neighbors", () => {
    // water at radius 1, stone at radius 2
    const deps = makeDeps({
      "6,5": "water",
      "5,6": "water",
      "4,5": "water",
      "5,4": "water",
      "7,5": "stone",
    });
    const mat = resolvePoolFloorMaterial(deps, "0", 5, 5);
    expect((mat as any).name).toBe("mat_stone");
  });

  it("skips void neighbors", () => {
    const deps = makeDeps({
      "6,5": "...",
      "7,5": "stone",
    });
    const mat = resolvePoolFloorMaterial(deps, "0", 5, 5);
    expect((mat as any).name).toBe("mat_stone");
  });
});
