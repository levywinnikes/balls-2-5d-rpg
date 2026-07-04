export class DexterityXpTable {
  private static levels: { level: number; xpRequired: number }[] = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 500 },
    { level: 3, xpRequired: 1200 },
    { level: 4, xpRequired: 2000 },
    { level: 5, xpRequired: 3000 },
    { level: 6, xpRequired: 4200 },
    { level: 7, xpRequired: 5600 },
    { level: 8, xpRequired: 7200 },
    { level: 9, xpRequired: 9000 },
    { level: 10, xpRequired: 11000 },
    { level: 11, xpRequired: 13200 },
    { level: 12, xpRequired: 15600 },
    { level: 13, xpRequired: 18200 },
    { level: 14, xpRequired: 21000 },
    { level: 15, xpRequired: 24000 },
    { level: 16, xpRequired: 27200 },
    { level: 17, xpRequired: 30600 },
    { level: 18, xpRequired: 34200 },
    { level: 19, xpRequired: 38000 },
    { level: 20, xpRequired: 42000 },
    { level: 21, xpRequired: 46200 },
    { level: 22, xpRequired: 50600 },
    { level: 23, xpRequired: 55200 },
    { level: 24, xpRequired: 60000 },
    { level: 25, xpRequired: 65000 },
    { level: 26, xpRequired: 70200 },
    { level: 27, xpRequired: 75600 },
    { level: 28, xpRequired: 81200 },
    { level: 29, xpRequired: 87000 },
    { level: 30, xpRequired: 93000 },
    { level: 31, xpRequired: 100000 },
    { level: 32, xpRequired: 108000 },
    { level: 33, xpRequired: 117000 },
    { level: 34, xpRequired: 127000 },
    { level: 35, xpRequired: 138000 },
    { level: 36, xpRequired: 150000 },
    { level: 37, xpRequired: 163000 },
    { level: 38, xpRequired: 177000 },
    { level: 39, xpRequired: 192000 },
    { level: 40, xpRequired: 208000 },
    { level: 41, xpRequired: 225000 },
    { level: 42, xpRequired: 243000 },
    { level: 43, xpRequired: 262000 },
    { level: 44, xpRequired: 282000 },
    { level: 45, xpRequired: 303000 },
    { level: 46, xpRequired: 325000 },
    { level: 47, xpRequired: 348000 },
    { level: 48, xpRequired: 372000 },
    { level: 49, xpRequired: 397000 },
    { level: 50, xpRequired: 423000 },
    { level: 51, xpRequired: 455000 },
    { level: 52, xpRequired: 490000 },
    { level: 53, xpRequired: 530000 },
    { level: 54, xpRequired: 575000 },
    { level: 55, xpRequired: 625000 },
    { level: 56, xpRequired: 680000 },
    { level: 57, xpRequired: 740000 },
    { level: 58, xpRequired: 805000 },
    { level: 59, xpRequired: 875000 },
    { level: 60, xpRequired: 950000 },
    { level: 61, xpRequired: 1030000 },
    { level: 62, xpRequired: 1115000 },
    { level: 63, xpRequired: 1205000 },
    { level: 64, xpRequired: 1300000 },
    { level: 65, xpRequired: 1400000 },
    { level: 66, xpRequired: 1510000 },
    { level: 67, xpRequired: 1630000 },
    { level: 68, xpRequired: 1760000 },
    { level: 69, xpRequired: 1900000 },
    { level: 70, xpRequired: 2050000 },
    { level: 71, xpRequired: 2210000 },
    { level: 72, xpRequired: 2385000 },
    { level: 73, xpRequired: 2570000 },
    { level: 74, xpRequired: 2770000 },
    { level: 75, xpRequired: 2985000 },
    { level: 76, xpRequired: 3215000 },
    { level: 77, xpRequired: 3460000 },
    { level: 78, xpRequired: 3720000 },
    { level: 79, xpRequired: 4000000 },
    { level: 80, xpRequired: 4300000 },
    { level: 81, xpRequired: 4620000 },
    { level: 82, xpRequired: 4960000 },
    { level: 83, xpRequired: 5320000 },
    { level: 84, xpRequired: 5700000 },
    { level: 85, xpRequired: 6100000 },
    { level: 86, xpRequired: 6520000 },
    { level: 87, xpRequired: 6960000 },
    { level: 88, xpRequired: 7420000 },
    { level: 89, xpRequired: 7900000 },
    { level: 90, xpRequired: 8400000 },
    { level: 91, xpRequired: 8920000 },
    { level: 92, xpRequired: 9460000 },
    { level: 93, xpRequired: 10020000 },
    { level: 94, xpRequired: 10600000 },
    { level: 95, xpRequired: 11200000 },
    { level: 96, xpRequired: 11850000 },
    { level: 97, xpRequired: 12550000 },
    { level: 98, xpRequired: 13300000 },
    { level: 99, xpRequired: 14100000 },
    { level: 100, xpRequired: 18000000 },
  ];

  public static getLevel(currentXP: number): number {
    for (let i = this.levels.length - 1; i >= 0; i--) {
      if (currentXP >= this.levels[i].xpRequired) {
        return this.levels[i].level;
      }
    }
    return 1;
  }

  public static getLevelInfo(currentXP: number): {
    level: number;
    currentLevelXP: number;
    nextLevelXP: number;
    progress: number;
  } {
    let level = this.getLevel(currentXP);
    let nextLevelXP: number = Infinity;

    for (let i = 0; i < this.levels.length - 1; i++) {
      if (this.levels[i].level === level) {
        nextLevelXP = this.levels[i + 1].xpRequired;
        break;
      }
    }

    if (currentXP >= this.levels[this.levels.length - 1].xpRequired) {
      level = this.levels[this.levels.length - 1].level;
      nextLevelXP = Infinity;
    }

    const currentLevelXP =
      this.levels.find((l) => l.level === level)?.xpRequired || 0;
    const progress =
      nextLevelXP === Infinity
        ? 1
        : (currentXP - currentLevelXP) / (nextLevelXP - currentLevelXP);

    return {
      level,
      currentLevelXP,
      nextLevelXP,
      progress: Math.min(Math.max(progress, 0), 1),
    };
  }

  public static getXPRequiredForLevel(level: number): number {
    const entry = this.levels.find((l) => l.level === level);
    return entry ? entry.xpRequired : 0;
  }
}
