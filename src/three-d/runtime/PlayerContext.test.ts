import { levelToWorldY, inferLevelFromFootY, createPlayerContext, HERO_BODY_HEIGHT, JUMP_IMPULSE, GRAVITY, PLAYER_RADIUS } from "./PlayerContext";

describe("PlayerContext", () => {
  describe("levelToWorldY", () => {
    it("converts level 0 to 0", () => {
      expect(levelToWorldY("0")).toBe(0);
      expect(levelToWorldY(0)).toBe(0);
    });

    it("converts level 1 to LEVEL_HEIGHT", () => {
      expect(levelToWorldY("1")).toBe(2.0);
    });

    it("converts level -1 to -2.0", () => {
      expect(levelToWorldY("-1")).toBe(-2.0);
    });
  });

  describe("inferLevelFromFootY", () => {
    const allLevels = ["-2", "-1", "0", "1", "2"];

    it("foot at 1.0 is level 0", () => {
      expect(inferLevelFromFootY(1.0, allLevels)).toBe("0");
    });

    it("foot at -1.0 is level -1", () => {
      expect(inferLevelFromFootY(-1.0, allLevels)).toBe("-1");
    });

    it("foot at 3.5 is level 1", () => {
      expect(inferLevelFromFootY(3.5, allLevels)).toBe("1");
    });

    it("fallback to first level if none match", () => {
      expect(inferLevelFromFootY(-10, ["5"])).toBe("5");
    });
  });

  describe("createPlayerContext", () => {
    it("initializes with correct defaults", () => {
      const ctx = createPlayerContext(5, 2, 3);
      expect(ctx.position.x).toBe(5);
      expect(ctx.position.y).toBe(2);
      expect(ctx.position.z).toBe(3);
      expect(ctx.verticalVelocity).toBe(0);
      expect(ctx.isGrounded).toBe(true);
      expect(ctx.holeFallLandingLevel).toBeNull();
      expect(ctx.isFallSafetyEnabled).toBe(true);
      expect(ctx.levelTransitionCooldown).toBe(0);
    });
  });

  describe("constants", () => {
    it("HERO_BODY_HEIGHT is positive", () => expect(HERO_BODY_HEIGHT).toBeGreaterThan(0));
    it("GRAVITY is negative", () => expect(GRAVITY).toBeLessThan(0));
    it("JUMP_IMPULSE is positive", () => expect(JUMP_IMPULSE).toBeGreaterThan(0));
    it("PLAYER_RADIUS is reasonable", () => expect(PLAYER_RADIUS).toBeGreaterThan(0.2));
  });
});
