import { calculateFallDamagePercent } from "./PlayerFallSystem";

describe("PlayerFallSystem", () => {
  describe("calculateFallDamagePercent", () => {
    it("normal jump = 0% damage", () => {
      expect(calculateFallDamagePercent(7.2)).toBe(0);
    });

    it("safe speed threshold = 0%", () => {
      expect(calculateFallDamagePercent(8.0)).toBe(0);
    });

    it("small fall (~12 m/s) = 22%", () => {
      expect(calculateFallDamagePercent(12)).toBeCloseTo(0.22, 1);
    });

    it("medium fall (~16 m/s) = 44%", () => {
      expect(calculateFallDamagePercent(16)).toBeCloseTo(0.44, 1);
    });

    it("large fall (~20 m/s) = 67%", () => {
      expect(calculateFallDamagePercent(20)).toBeCloseTo(0.67, 1);
    });

    it("fatal speed = 100%", () => {
      expect(calculateFallDamagePercent(26)).toBe(1.0);
      expect(calculateFallDamagePercent(50)).toBe(1.0);
    });

    it("just above safe = small damage", () => {
      expect(calculateFallDamagePercent(9)).toBeCloseTo(0.056, 1);
    });

    it("linear between safe and fatal", () => {
      // 17 m/s is exactly halfway between 8 and 26
      const mid = calculateFallDamagePercent(17);
      expect(mid).toBeCloseTo(0.5, 0);
    });
  });
});
