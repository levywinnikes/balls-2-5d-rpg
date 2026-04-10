export class XPTable {
  private static levels: { level: number; xpRequired: number }[] = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 300 },
    { level: 3, xpRequired: 700 },
    { level: 4, xpRequired: 1200 },
    { level: 5, xpRequired: 1800 },
    { level: 6, xpRequired: 2500 },
    { level: 7, xpRequired: 3300 },
    { level: 8, xpRequired: 4200 },
    { level: 9, xpRequired: 5200 },
    { level: 10, xpRequired: 6300 },
    { level: 11, xpRequired: 7600 },
    { level: 12, xpRequired: 9000 },
    { level: 13, xpRequired: 10500 },
    { level: 14, xpRequired: 12200 },
    { level: 15, xpRequired: 14000 },
    { level: 16, xpRequired: 16000 },
    { level: 17, xpRequired: 18000 },
    { level: 18, xpRequired: 20200 },
    { level: 19, xpRequired: 22500 },
    { level: 20, xpRequired: 25000 },
    { level: 21, xpRequired: 27500 },
    { level: 22, xpRequired: 30200 },
    { level: 23, xpRequired: 33000 },
    { level: 24, xpRequired: 36000 },
    { level: 25, xpRequired: 39000 },
    { level: 26, xpRequired: 42200 },
    { level: 27, xpRequired: 45500 },
    { level: 28, xpRequired: 49000 },
    { level: 29, xpRequired: 52500 },
    { level: 30, xpRequired: 56000 },
    { level: 31, xpRequired: 60000 },
    { level: 32, xpRequired: 65000 },
    { level: 33, xpRequired: 70000 },
    { level: 34, xpRequired: 76000 },
    { level: 35, xpRequired: 82000 },
    { level: 36, xpRequired: 90000 },
    { level: 37, xpRequired: 98000 },
    { level: 38, xpRequired: 107000 },
    { level: 39, xpRequired: 116000 },
    { level: 40, xpRequired: 126000 },
    { level: 41, xpRequired: 136000 },
    { level: 42, xpRequired: 147000 },
    { level: 43, xpRequired: 158000 },
    { level: 44, xpRequired: 170000 },
    { level: 45, xpRequired: 182000 },
    { level: 46, xpRequired: 195000 },
    { level: 47, xpRequired: 208000 },
    { level: 48, xpRequired: 222000 },
    { level: 49, xpRequired: 237000 },
    { level: 50, xpRequired: 253000 },
    { level: 51, xpRequired: 270000 },
    { level: 52, xpRequired: 290000 },
    { level: 53, xpRequired: 310000 },
    { level: 54, xpRequired: 335000 },
    { level: 55, xpRequired: 360000 },
    { level: 56, xpRequired: 390000 },
    { level: 57, xpRequired: 420000 },
    { level: 58, xpRequired: 455000 },
    { level: 59, xpRequired: 490000 },
    { level: 60, xpRequired: 530000 },
    { level: 61, xpRequired: 575000 },
    { level: 62, xpRequired: 625000 },
    { level: 63, xpRequired: 680000 },
    { level: 64, xpRequired: 740000 },
    { level: 65, xpRequired: 800000 },
    { level: 66, xpRequired: 870000 },
    { level: 67, xpRequired: 940000 },
    { level: 68, xpRequired: 1015000 },
    { level: 69, xpRequired: 1095000 },
    { level: 70, xpRequired: 1180000 },
    { level: 71, xpRequired: 1270000 },
    { level: 72, xpRequired: 1370000 },
    { level: 73, xpRequired: 1475000 },
    { level: 74, xpRequired: 1585000 },
    { level: 75, xpRequired: 1700000 },
    { level: 76, xpRequired: 1825000 },
    { level: 77, xpRequired: 1960000 },
    { level: 78, xpRequired: 2105000 },
    { level: 79, xpRequired: 2260000 },
    { level: 80, xpRequired: 2425000 },
    { level: 81, xpRequired: 2605000 },
    { level: 82, xpRequired: 2800000 },
    { level: 83, xpRequired: 3005000 },
    { level: 84, xpRequired: 3225000 },
    { level: 85, xpRequired: 3460000 },
    { level: 86, xpRequired: 3705000 },
    { level: 87, xpRequired: 3965000 },
    { level: 88, xpRequired: 4240000 },
    { level: 89, xpRequired: 4530000 },
    { level: 90, xpRequired: 4835000 },
    { level: 91, xpRequired: 5155000 },
    { level: 92, xpRequired: 5490000 },
    { level: 93, xpRequired: 5835000 },
    { level: 94, xpRequired: 6195000 },
    { level: 95, xpRequired: 6570000 },
    { level: 96, xpRequired: 6955000 },
    { level: 97, xpRequired: 7350000 },
    { level: 98, xpRequired: 7755000 },
    { level: 99, xpRequired: 7900000 },
    { level: 100, xpRequired: 10000000 },
  ];

  static getLevelInfo(currentXP: number): {
    level: number;
    currentLevelXP: number;
    nextLevelXP: number;
    progress: number;
  } {
    let level = 1;
    let nextLevelXP = 0;

    for (let i = 0; i < this.levels.length - 1; i++) {
      if (
        currentXP >= this.levels[i].xpRequired &&
        currentXP < this.levels[i + 1].xpRequired
      ) {
        level = this.levels[i].level;
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
      progress: Phaser.Math.Clamp(progress, 0, 1),
    };
  }

  public static getXPRequiredForLevel(level: number): number {
    const l = this.levels.find((l) => l.level === level);
    return l ? l.xpRequired : 0;
  }
}
