export class ReflexXpTable {
  private static levels: { level: number; xpRequired: number }[] = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 1000 },
    { level: 3, xpRequired: 2400 },
    { level: 4, xpRequired: 4000 },
    { level: 5, xpRequired: 6000 },
    { level: 6, xpRequired: 8400 },
    { level: 7, xpRequired: 11200 },
    { level: 8, xpRequired: 14400 },
    { level: 9, xpRequired: 18000 },
    { level: 10, xpRequired: 22000 },
    { level: 11, xpRequired: 26400 },
    { level: 12, xpRequired: 31200 },
    { level: 13, xpRequired: 36400 },
    { level: 14, xpRequired: 42000 },
    { level: 15, xpRequired: 48000 },
    { level: 16, xpRequired: 54400 },
    { level: 17, xpRequired: 61200 },
    { level: 18, xpRequired: 68400 },
    { level: 19, xpRequired: 76000 },
    { level: 20, xpRequired: 84000 },
    { level: 21, xpRequired: 92400 },
    { level: 22, xpRequired: 101200 },
    { level: 23, xpRequired: 110400 },
    { level: 24, xpRequired: 120000 },
    { level: 25, xpRequired: 130000 },
    { level: 26, xpRequired: 140400 },
    { level: 27, xpRequired: 151200 },
    { level: 28, xpRequired: 162400 },
    { level: 29, xpRequired: 174000 },
    { level: 30, xpRequired: 186000 },
    { level: 31, xpRequired: 200000 },
    { level: 32, xpRequired: 216000 },
    { level: 33, xpRequired: 234000 },
    { level: 34, xpRequired: 254000 },
    { level: 35, xpRequired: 276000 },
    { level: 36, xpRequired: 300000 },
    { level: 37, xpRequired: 326000 },
    { level: 38, xpRequired: 354000 },
    { level: 39, xpRequired: 384000 },
    { level: 40, xpRequired: 416000 },
    { level: 41, xpRequired: 450000 },
    { level: 42, xpRequired: 486000 },
    { level: 43, xpRequired: 524000 },
    { level: 44, xpRequired: 564000 },
    { level: 45, xpRequired: 606000 },
    { level: 46, xpRequired: 650000 },
    { level: 47, xpRequired: 696000 },
    { level: 48, xpRequired: 744000 },
    { level: 49, xpRequired: 794000 },
    { level: 50, xpRequired: 846000 },
    { level: 51, xpRequired: 910000 },
    { level: 52, xpRequired: 980000 },
    { level: 53, xpRequired: 1060000 },
    { level: 54, xpRequired: 1150000 },
    { level: 55, xpRequired: 1250000 },
    { level: 56, xpRequired: 1360000 },
    { level: 57, xpRequired: 1480000 },
    { level: 58, xpRequired: 1610000 },
    { level: 59, xpRequired: 1750000 },
    { level: 60, xpRequired: 1900000 },
    { level: 61, xpRequired: 2060000 },
    { level: 62, xpRequired: 2230000 },
    { level: 63, xpRequired: 2410000 },
    { level: 64, xpRequired: 2600000 },
    { level: 65, xpRequired: 2800000 },
    { level: 66, xpRequired: 3020000 },
    { level: 67, xpRequired: 3260000 },
    { level: 68, xpRequired: 3520000 },
    { level: 69, xpRequired: 3800000 },
    { level: 70, xpRequired: 4100000 },
    { level: 71, xpRequired: 4420000 },
    { level: 72, xpRequired: 4770000 },
    { level: 73, xpRequired: 5140000 },
    { level: 74, xpRequired: 5540000 },
    { level: 75, xpRequired: 5970000 },
    { level: 76, xpRequired: 6430000 },
    { level: 77, xpRequired: 6920000 },
    { level: 78, xpRequired: 7440000 },
    { level: 79, xpRequired: 8000000 },
    { level: 80, xpRequired: 8600000 },
    { level: 81, xpRequired: 9240000 },
    { level: 82, xpRequired: 9920000 },
    { level: 83, xpRequired: 10640000 },
    { level: 84, xpRequired: 11400000 },
    { level: 85, xpRequired: 12200000 },
    { level: 86, xpRequired: 13040000 },
    { level: 87, xpRequired: 13920000 },
    { level: 88, xpRequired: 14840000 },
    { level: 89, xpRequired: 15800000 },
    { level: 90, xpRequired: 16800000 },
    { level: 91, xpRequired: 17840000 },
    { level: 92, xpRequired: 18920000 },
    { level: 93, xpRequired: 20040000 },
    { level: 94, xpRequired: 21200000 },
    { level: 95, xpRequired: 22400000 },
    { level: 96, xpRequired: 23700000 },
    { level: 97, xpRequired: 25100000 },
    { level: 98, xpRequired: 26600000 },
    { level: 99, xpRequired: 28200000 },
    { level: 100, xpRequired: 36000000 },
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
