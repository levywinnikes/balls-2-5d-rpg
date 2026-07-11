import { isStaticTileBlocking, isBlockingTile, type TileBlockingDeps } from "./TileBlocking";

function makeDeps(overrides: Partial<TileBlockingDeps> = {}): TileBlockingDeps {
  return {
    doorSystem: { getDoorAtTile: () => null, isDoorOpenAtTile: () => false },
    propSystem: { isCollidableTile: () => false },
    ...overrides,
  };
}

describe("TileBlocking", () => {
  describe("isStaticTileBlocking", () => {
    it("void symbol is never blocking", () => {
      expect(isStaticTileBlocking(null)).toBe(false);
      expect(isStaticTileBlocking("...")).toBe(false);
    });

    it("water tiles are not blocking", () => {
      expect(isStaticTileBlocking("water", { id: "water", renderAs: "floor" } as any)).toBe(false);
    });

    it("floor tiles are not blocking", () => {
      expect(isStaticTileBlocking("stone", { id: "stone", renderAs: "floor" } as any)).toBe(false);
    });

    it("block tiles are blocking", () => {
      expect(isStaticTileBlocking("wall", { id: "wall", renderAs: "block" } as any)).toBe(true);
    });

    it("tiles with block:true but renderAs:floor are NOT blocking (floor takes precedence)", () => {
      expect(isStaticTileBlocking("fence", { id: "fence", renderAs: "floor", block: true } as any)).toBe(false);
    });

    it("regular tiles are not blocking by default", () => {
      expect(isStaticTileBlocking("grass")).toBe(false);
      expect(isStaticTileBlocking("grass", { id: "grass" } as any)).toBe(false);
    });
  });

  describe("isBlockingTile", () => {
    it("closed door blocks movement", () => {
      const deps = makeDeps({
        doorSystem: {
          getDoorAtTile: () => ({ uid: "door1" }),
          isDoorOpenAtTile: () => false,
        },
      });
      expect(isBlockingTile(deps, "door", undefined, { level: "0", tileX: 5, tileY: 3 })).toBe(true);
    });

    it("open door does not block", () => {
      const deps = makeDeps({
        doorSystem: {
          getDoorAtTile: () => ({ uid: "door1" }),
          isDoorOpenAtTile: () => true,
        },
      });
      expect(isBlockingTile(deps, "door", undefined, { level: "0", tileX: 5, tileY: 3 })).toBe(false);
    });

    it("collidable prop blocks", () => {
      const deps = makeDeps({
        propSystem: { isCollidableTile: () => true },
      });
      expect(isBlockingTile(deps, "tree", undefined, { level: "0", tileX: 2, tileY: 4 })).toBe(true);
    });

    it("stateless call delegates to isStaticTileBlocking", () => {
      expect(isBlockingTile(makeDeps(), "wall", { id: "wall", renderAs: "block" } as any)).toBe(true);
      expect(isBlockingTile(makeDeps(), "...")).toBe(false);
    });
  });
});
