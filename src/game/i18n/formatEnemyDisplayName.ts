import { currentLanguage, translations } from "./translations";

function formatEnemyDisplayNameFallback(enemyType: string): string {
  return enemyType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getEnemyTranslationKey(enemyType: string): string {
  return `enemy_${enemyType}`;
}

/** Resolve enemy label using i18n table, with readable fallback. */
export function formatEnemyDisplayName(enemyType: string): string {
  const key = getEnemyTranslationKey(enemyType);
  const table = translations[currentLanguage] as Record<string, string | undefined>;
  return table[key] ?? formatEnemyDisplayNameFallback(enemyType);
}

/** React HUD: use LanguageContext `t` so keys stay typed. */
export function formatEnemyDisplayNameWithTranslator(
  enemyType: string,
  t: (key: keyof typeof translations.en) => string,
): string {
  const key = getEnemyTranslationKey(enemyType) as keyof typeof translations.en;
  const translated = t(key);
  if (translated !== key) {
    return translated;
  }
  return formatEnemyDisplayNameFallback(enemyType);
}
