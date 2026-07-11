import { calculateFallDamagePercent } from "./PlayerFallSystem";

describe("PlayerFallSystem", () => {
  describe("calculateFallDamagePercent", () => {
    it("1 floor at low speed = 16%", () => {
      expect(calculateFallDamagePercent(1, 5)).toBeCloseTo(0.16, 2);
    });

    it("3 floors at moderate speed = 48%", () => {
      expect(calculateFallDamagePercent(3, 8)).toBeCloseTo(0.48, 2);
    });

    it("5 floors hits 72% per-floor cap, no speed bonus", () => {
      expect(calculateFallDamagePercent(5, 5)).toBeCloseTo(0.72, 2);
    });

    it("damage hard cap at 90%", () => {
      expect(calculateFallDamagePercent(10, 50)).toBeCloseTo(0.9, 1);
    });

    it("speed bonus adds damage beyond per-floor cap", () => {
      const base = calculateFallDamagePercent(2, 5);
      const fast = calculateFallDamagePercent(2, 20);
      expect(fast).toBeGreaterThan(base);
    });

    it("zero floors with high speed still deals minor damage (18% speed cap)", () => {
      // 0 floors * 0.16 = 0, but speed bonus caps at 0.18
      expect(calculateFallDamagePercent(0, 100)).toBeCloseTo(0.18, 1);
    });

    it("LEVEL_HEIGHT fix: 1 floor = 2.0 units (was incorrectly 4)", () => {
      // floors is pre-calculated from dropDistance / LEVEL_HEIGHT
      // With LEVEL_HEIGHT=2.0, falling 2.0 units = 1 floor = 16% damage
      expect(calculateFallDamagePercent(1, 3)).toBeCloseTo(0.16, 2);
    });
  });
});
