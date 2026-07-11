import { clamp, worldToSliceCoord, worldToGrid, gridToWorld } from "./SliceRuntimeUtils";

describe("SliceRuntimeUtils", () => {
  describe("clamp", () => {
    it("clamps below min", () => expect(clamp(-5, 0, 10)).toBe(0));
    it("clamps above max", () => expect(clamp(15, 0, 10)).toBe(10));
    it("keeps value in range", () => expect(clamp(5, 0, 10)).toBe(5));
  });

  describe("worldToSliceCoord", () => {
    it("divides by 32", () => expect(worldToSliceCoord(64)).toBe(2));
    it("handles zero", () => expect(worldToSliceCoord(0)).toBe(0));
  });

  describe("worldToGrid", () => {
    it("floors value", () => expect(worldToGrid(3.7, 0)).toBe(3));
    it("handles origin offset", () => expect(worldToGrid(5.2, 1)).toBe(6));
  });

  describe("gridToWorld", () => {
    it("converts tile to center position", () => expect(gridToWorld(3, 0)).toBe(3.5));
    it("handles origin offset", () => expect(gridToWorld(3, 2)).toBeCloseTo(1.5));
  });
});
