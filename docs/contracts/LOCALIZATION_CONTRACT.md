# Localization Contract

## 1. Scope

This contract defines mandatory localization rules for all player-facing text.
Single-player scope does not exempt text from localization requirements.

## 2. Mandatory Localized Domains

All text in the domains below must use translation keys and support all project languages:

- Item names
- Item descriptions
- Quest titles and quest descriptions
- Quest objective text and progression text
- NPC dialogue text (including future systems)
- UI/HUD/window/status messages shown to players

## 3. Implementation Rules

- Do not hardcode player-facing strings in scene, system, or UI code.
- Use translation helpers (`t_game(...)` or approved equivalent).
- Store placeholders as tokens (for example `{count}`, `{item}`, `{name}`) and replace at runtime.
- Keep translation keys in `src/game/i18n/translations.ts` synchronized across all supported languages in the same task.
- Fallback literal strings are forbidden for player-facing text.

## 4. Data Content Rules

For structured game content (items, quests, dialogues):

- Prefer key-based references over raw localized strings in runtime logic.
- If content files are extended, include localization key mapping in the same task.
- Do not merge content changes that introduce language-specific text without translation coverage.

## 5. Definition of Done Additions

A task touching localized domains is complete only when:

1. New/changed player-facing text is represented by translation keys.
2. All supported languages were updated in `src/game/i18n/translations.ts`.
3. No new hardcoded player-facing string was introduced in changed lines.
4. Localization impact is documented in the task summary.
