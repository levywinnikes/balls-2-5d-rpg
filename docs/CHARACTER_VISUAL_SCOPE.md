# Character Visual Scope (Alpha + AI Pipeline)

Escopo canônico: **o mínimo agradável com o mínimo de gambiarra para IA.**

Relacionado: `docs/sprites/items/ITEM_VISUAL_PIPELINE.md`, `src/three-d/runtime/CharacterVisualProfile.ts`

---

## 1. Regra de ouro

| Camada | O jogador vê | Como |
|--------|----------------|------|
| **Stats / slots** | Equipamento real | `PlayerState`, `WeaponRegistry` |
| **Ícones** | Cada item | `public/assets/items/{registry_id}.png` |
| **Corpo no mundo** | **Perfil visual fixo (alpha)** | `hero_default` = `hero_base` + cabelo |

Equipar qualquer peça **muda números e ícones** — **não** muda o sprite do corpo no alpha.

---

## 2. O que NÃO fazer (IA)

- Pixel diff em elmo/armadura  
- 4 gerações pixflux independentes por direção  
- Overlay modular infinito (cabelo + elmo + armadura + arma)  
- `generate:hair-layer` / diff para equipamento de corpo  

**Pixel diff:** só **cabelo** em `hero_default`.

---

## 3. Perfil visual (`CharacterVisualProfile`)

Um perfil = **pasta animada completa** (mesma árvore que `hero_base`):

```text
public/assets/sprites/generated/{bodyEntityId}/
  idle_south/frame_00.png …
  walk_south/…
  attack_south/…
  death_south/…
```

| Campo | Alpha (`hero_default`) |
|-------|-------------------------|
| `bodyEntityId` | `hero_base` |
| `hairOverlayEntityId` | `hair_classic` (ou `equippedHairId`) |

Runtime: `resolveCharacterVisualProfile(PlayerState)` → perfil → `TwoDParitySpriteFactory`.

---

## 4. Fase 2 (quando playtest pedir) — ordem de ROI

1. **Ícones** para todos os itens visíveis (`npm run generate:item-icon`)  
2. **Socket 1 mão** — colar ícone 32×32 na mão sobre `hero_default` (sem anim nova)  
3. **Perfis de pose** — um job IA cada (state + animate), **nunca** diff:

| Perfil | Quando | Geração |
|--------|--------|---------|
| `hero_one_hand` | arma melee 1H, sem escudo | `create-character-state` + templates |
| `hero_one_hand_shield` | 1H + escudo | idem |
| `hero_two_hand` | arma duas mãos | idem |
| `hero_bow` | arco | idem |

Cada perfil novo = script clone de `generate-pixellab-sprite` / hero + entrada em `CharacterVisualProfile.ts`.

---

## 5. Checklist qualidade mínima (aceitável)

Antes de ativar um perfil ou ícone:

- [ ] 4 direções **coerentes** (mesmo personagem, não 4 desenhos diferentes)  
- [ ] Pés em `HERO_FEET_Y` / anchor ok  
- [ ] Idle + walk sem jitter grave  
- [ ] Ícone 32×32 legível no slot 48×48  
- [ ] `registry_id` === `WeaponRegistry.id`  

---

## 6. Alpha — in scope / out of scope

**In scope**

- `hero_default` no billboard 3D  
- Cabelo overlay (diff)  
- Ícones de item (Fase A)  
- Drops/chão com ícone  

**Out of scope (alpha)**

- Qualquer equipamento visível no corpo (elmo, armadura, armas)
- Perfis `hero_two_hand` / `hero_bow` até assets existirem

---

## 7. Comandos (só estes no alpha)

```bash
# 1. Ícone por item (único pipeline de equipamento no alpha)
npm run generate:item-icon -- --spec docs/sprites/items/{item-id}.spec.json

# 2. Cabelo alternativo (opcional, cosmético)
npm run generate:hair-layer -- --spec docs/sprites/hero/hair-classic.spec.json
```

**Removido:** `generate:head-overlay` e assets `equipment/leather_helmet/`, `generated/leather_helmet/`.

---

## 8. Próximo passo recomendado (fácil, alto ROI)

Ícones do registry: catálogo em `docs/sprites/items/catalog.json`.

```bash
npm run audit:item-icons                              # ver OK vs oversized
npm run generate:item-icons -- --group starter        # kit inicial
npm run generate:item-icons -- --group weapons        # armas
npm run generate:item-icons -- --group armor_mid       # armaduras médias
npm run generate:item-icons -- --group dragon         # set dragon
npm run generate:item-icons -- --group misc             # runa, comida
npm run generate:item-icons -- --ids leather_helmet   # item avulso
npm run generate:item-icons -- --write-specs-only       # só escrever specs
```

Grupos pulam PNGs já pequenos (<50KB). Use `--force` para regerar.

---

## 9. Implementação

| Arquivo | Papel |
|---------|--------|
| `src/three-d/runtime/CharacterVisualProfile.ts` | Resolve perfil a partir de `PlayerState` |
| `src/three-d/runtime/TwoDParitySpriteFactory.ts` | Compositor body + hair overlay |
| `src/three-d/runtime/createDebugSliceScene.ts` | Billboard + ícones no chão |
| `docs/sprites/profiles/hero-default.profile.json` | Spec do perfil alpha |
