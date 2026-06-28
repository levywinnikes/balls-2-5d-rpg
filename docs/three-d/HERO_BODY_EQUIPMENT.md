# Equipamentos no Corpo — Runtime 3D (Herói Modular)

> **Alpha (hoje):** leia **`docs/CHARACTER_VISUAL_SCOPE.md`**. Corpo fixo; equipamento não altera sprite.  
> **Este documento** descreve o **alvo de fase 2** (perfis de pose, sockets) — não o que está ligado no runtime agora.

Documento de referência para **elmo, armadura, calça, botas, escudo, arma de uma mão, arma de duas mãos e arco** no billboard 3D do jogador.

Relacionado:

- `docs/sprites/MODULAR_SPRITE_AND_NPC_GENERATION_GUIDE.md` — geração PixelLab, cabelo, princípios de perspectiva
- `docs/sprites/MODULAR_SPRITE_AND_NPC_GENERATION_GUIDE.md` §4.2 — runtime 3D atual (body + cabelo)
- `docs/contracts/SPRITE_PIPELINE_CONTRACT.md` §9.1 — paridade 2D/3D
- `src/config/ItemConstants.ts` — slots e tipos de item
- `src/game/entities/Player/PlayerState.ts` — equipamento persistido e eventos

---

## 1. Princípio (sempre nesta ordem)

Ver **`docs/CHARACTER_VISUAL_SCOPE.md`** (alpha) e **`docs/sprites/items/ITEM_VISUAL_PIPELINE.md`** (ícones):

1. **Fase A:** ícone 32×32 (`public/assets/items/{registry_id}.png`) — menu, chão, containers.
2. **Alpha corpo:** perfil fixo `hero_default` — equipar não muda sprite (stats + ícone only).
3. **Fase 2:** perfis de pose (`hero_two_hand`, …) ou sockets 1H — ver §4 deste doc (alvo).

O `registry_id` deve ser o **`id` existente** em `WeaponRegistry` (ex.: `leather_helmet`). Nunca criar item de gameplay só por causa da arte.

---

## 2. Mapa de slots (gameplay ↔ visual)

| Peça (PT) | `EquipmentSlot` | Chave legada `PlayerState` | `ItemType`(s) | Visual 3D (alvo) |
| :--- | :--- | :--- | :--- | :--- |
| Elmo | `HEAD` | `helmet` | `HELMET` | Camada cabeça (overlay + head tracking) |
| Armadura | `BODY` | `armor` | `BODY_ARMOR` | Camada tronco animada |
| Calça | `LEGS` | `legs` | `LEGS` | Camada pernas animada |
| Botas | `BOOTS` | `boots` | `BOOTS` | Camada pés animada |
| Escudo | `OFF_HAND` | `shield` | `SHIELD` | Sprite 32×32 em socket mão esquerda |
| Arma 1 mão | `MAIN_HAND` | `weapon` | `SWORD`, `AXE`, `CLUB`, `WAND`, `ROD` | Sprite 32×32 em socket mão direita |
| Arma 2 mãos | `MAIN_HAND` | `weapon` | `SWORD` / `AXE` / `CLUB` com flag `twoHanded` | Sprite grande ou pose 2H; ocupa ambas mãos |
| Arco | `MAIN_HAND` + `AMMO` | `weapon` + `ammo` | `DISTANCE` + `AMMUNITION` | Pose 2H com arco; munição só stats (v1) |

**Fonte de verdade:** `PlayerState.getEquippedItemInSlot(...)` e eventos `weaponEquipped` / `inventoryUpdated`.

**Persistência:** snapshot inclui `equippedHelmetItem`, `equippedArmorItem`, `equippedLegsItem`, `equippedBootsItem`, `equippedShieldItem`, `equippedWeaponItem`, `equippedAmmoItem`, `equippedHairId`.

---

## 3. Ordem de composição (billboard 3D)

Cada frame final do herói é um **canvas 92×92** composto nesta ordem (de trás para frente):

```text
1. hero_base          — pele/corpo nu (animado, 4 dirs × idle/walk/attack/death)
2. legs_layer         — calça (animada, diff ou sheet por frame)
3. boots_layer        — botas (animada)
4. body_armor_layer   — armadura tronco (animada)
5. hair_layer         — cabelo (estático 4 dirs + head tracking) — omitido se elmo fechado
6. helmet_layer       — elmo (estático 4 dirs + head tracking)
7. shield_sprite      — escudo (32×32, socket OFF_HAND, por frame)
8. weapon_sprite      — arma (32×32 ou 2H, socket MAIN_HAND, por frame)
```

Regras de visibilidade:

| Condição | Efeito visual |
| :--- | :--- |
| Elmo equipado (tipo `full_helmet`) | Oculta `hair_layer` |
| Elmo equipado (tipo `open_helmet`) | Mantém hair parcialmente visível (spec do item) |
| Arma `twoHanded: true` | Oculta escudo; desabilita equipar em `OFF_HAND` |
| Arco (`ItemType.DISTANCE`) | Trata como **pose duas mãos**; escudo oculto |
| Tocha / item luz em `MAIN_HAND` | Mesmo socket 1 mão; rotação específica no spec |

---

## 4. Por categoria de equipamento

### 4.1 Elmo (fase 2 — não implementado no alpha)

**Alpha:** elmo = stats + ícone 32×32. Corpo permanece `hero_base` + cabelo.

Tentativas **rejeitadas** (não repetir): pixel diff, `head-overlay-pixflux`, overlay modular por direção.

**Caminho viável (fase 2):** perfil visual dedicado ou personagem inteiro animado por set — ver `CHARACTER_VISUAL_SCOPE.md` §4.

---

### 4.2 Armadura (tronco)

**Pipeline:** camada **animada** — uma textura por frame de cada estado/direção do `hero_base`.

| Campo | Valor |
| :--- | :--- |
| Máscara de diff | Região tronco (~35%–75% da altura do bbox do personagem) |
| Assets | `{state}_{dir}/frame_XX.png` espelhando estrutura do `hero_base` |
| Geração | PixelLab template no mesmo `character_id`; ou diff frame-a-frame vs body |

**Não** usar PNG estático único — idle/walk desalinham em poucos frames.

**Spec sugerido:** `docs/sprites/hero/equipment/armor-leather.spec.json` (template abaixo §8).

---

### 4.3 Calça

**Pipeline:** igual armadura, máscara na região **quadril/pernas** (~45%–90% do bbox, excluindo pés se botas separadas).

- Walk cycle move pernas — diff por frame obrigatório.
- Sobreposição: calça **abaixo** de armadura, **acima** de `hero_base`.

---

### 4.4 Botas

**Pipeline:** camada animada na região **pés** (~75%–100% do bbox).

- Deve respeitar `HERO_FEET_Y = 77` — botas não alteram anchor do billboard.
- Passos (footstep sync) continuam ligados ao body walk, não ao sprite da bota.

---

### 4.5 Escudo

**Pipeline:** item **socket** — não cobre o corpo inteiro.

| Campo | Valor |
| :--- | :--- |
| Canvas item | 32×32 px (`ItemGraphic` / atlas de item) |
| Socket | mão esquerda (`OFF_HAND`) |
| Orientação base | face frontal leve top-down (ver guia modular §2.2) |
| Por frame | tabela `SHIELD_SOCKETS[state][direction][frameIndex]` → `{ x, y, rotation? }` |

Coordenadas em **espaço do canvas 92×92** do herói composto (não no canvas 32×32 do item).

**Composição:** desenhar escudo **antes** da arma na pilha (arma na frente da mão que segura).

---

### 4.6 Arma de uma mão

**Pipeline:** socket na mão direita (`MAIN_HAND`).

| Campo | Valor |
| :--- | :--- |
| Canvas item | 32×32 px |
| Orientação base | 45° apontando top-right; punho canto inferior esquerdo (guia §2.1) |
| Por frame | `WEAPON_SOCKETS_1H[state][direction][frameIndex]` |
| Attack | rotação extra opcional no estado `attack` (spec por família: espada, machado, clava) |

Famílias atuais no registry: `wooden_sword`, `iron_axe`, `torch`, `wand`, etc.

---

### 4.7 Arma de duas mãos

**Gameplay (alvo — a implementar em `ItemConstants` / equip):**

```typescript
// Alvo em WeaponDefinition / item metadata
twoHanded?: boolean;  // true → bloqueia OFF_HAND, força animação 2H se existir
```

**Visual:**

| Modo | Descrição |
| :--- | :--- |
| **A — Sprite 2H no canvas 92×92** | Arma grande desenhada no próprio sheet do personagem (PixelLab gera personagem segurando a arma). Melhor silhueta; pior modularidade. |
| **B — Socket duplo (recomendado v1)** | Mesmo item 32×32 (ou 48×48) ancorado entre duas mãos via dois pontos ou offset central; escudo oculto. |
| **C — Attack sheet dedicado** | Walk/idle com socket B; attack usa frames onde a pose 2H já está no body (template attack). |

**Regra:** se `twoHanded`, `PlayerState.equipItem` rejeita escudo e desequipa `OFF_HAND` automaticamente.

Itens candidatos: `dragon_axe`, espadas grandes (definir ids no registry).

---

### 4.8 Arco

**Tipo:** `ItemType.DISTANCE` (`short_bow`, etc.).

**Visual alvo:**

- Tratado como **duas mãos** para escudo (sem escudo visível).
- Socket tipo `BOW_SOCKETS` — arco curvado visível em perfil (east/west) e arco + corda em south.
- **Munição (`AMMO`):** slot de stats e combate à distância; **não** renderiza flecha no corpo na v1 (flecha só em projétil de combate futuro).
- Attack: frame de `pull` / `release` no estado `attack` (3 frames atuais do hero_base podem ser reutilizados com overlay de arco esticado).

**Prompt item 32×32 (inventário/chão):**

```text
pixel art short bow, icon, transparent background, low top-down, wood and string, 32x32
```

**Prompt pose no personagem (create-character-state):**

```text
holding short bow, both hands on bow, same body proportions, low top-down, transparent background
```

---

## 5. Estado de implementação

| Camada | Gameplay (stats/UI) | Asset gerado | Runtime 3D |
| :--- | :---: | :---: | :---: |
| `hero_base` | — | ✅ | ✅ |
| Cabelo | ✅ `equippedHairId` | ✅ `hair_classic` | ✅ head tracking |
| Elmo | ✅ slot HEAD | ⏭️ | ⏭️ |
| Armadura | ✅ slot BODY | ⏭️ | ⏭️ |
| Calça | ✅ slot LEGS | ⏭️ | ⏭️ |
| Botas | ✅ slot BOOTS | ⏭️ | ⏭️ |
| Escudo | ✅ slot OFF_HAND | ✅ ícones 32×32 | ⏭️ sockets |
| Arma 1 mão | ✅ slot MAIN_HAND | ✅ ícones 32×32 | ⏭️ sockets |
| Arma 2 mãos | ⏭️ flag metadata | ⏭️ | ⏭️ |
| Arco | ✅ DISTANCE + AMMO | ✅ `short_bow` ícone | ⏭️ pose 2H |

**Arquivos runtime atuais:**

- `src/three-d/runtime/TwoDParitySpriteFactory.ts` — compositor body + hair
- `src/three-d/runtime/createDebugSliceScene.ts` — billboard + animação
- `src/game/graphics/ItemGraphic.ts` — sprites 32×32 de itens (inventário/chão, não no corpo 3D ainda)

---

## 6. Integração runtime 3D (plano)

### 6.1 API alvo do compositor

Estender `createHeroModularSpriteMaterial`:

```typescript
createHeroModularSpriteMaterial(scene, keyPrefix, {
  hairEntityId: playerState.equippedHairId,
  equipmentLayers: {
    helmetId: string | null,   // ex. "helmet_iron"
    armorId: string | null,
    legsId: string | null,
    bootsId: string | null,
  },
  heldItems: {
    mainHandItemId: string | null,
    offHandItemId: string | null,
    mainHandProfile: "one_hand" | "two_hand" | "bow",
  },
});
```

### 6.2 Reatividade

Assinar em `createDebugSliceScene.ts`:

- `playerState.on("weaponEquipped", rebuildOrInvalidateHeroMaterial)`
- `playerState.on("inventoryUpdated", ...)` quando slot de equipamento mudar
- Futuro: `equipmentVisualChanged` dedicado

### 6.3 Cache de texturas

- Pré-compor frames sob demanda por combinação `(bodyState, dir, frame, equipmentHash)`.
- Invalidar cache quando qualquer id de camada mudar.
- Limite de combinações: gerar só equipamento **visível** (equipped), não todo o loot table.

### 6.4 Sockets (coordenadas)

Arquivo alvo: `src/three-d/runtime/HeroEquipmentSockets.ts`

```typescript
export const WEAPON_SOCKETS_1H: SocketTable = { /* walk, idle, attack × 4 dirs × N frames */ };
export const SHIELD_SOCKETS: SocketTable = { /* ... */ };
export const BOW_SOCKETS: SocketTable = { /* ... */ };
```

Valores iniciais podem ser calibrados a partir do guia §4.1 legacy (`WEAPON_SOCKETS` em canvas 64×64) escalados para 92×92:

```text
x_92 = round(x_64 * 92 / 64)
y_92 = round(y_64 * 92 / 64)
```

---

## 7. Pipeline de produção (scripts)

| Tipo | Script alvo | Saída |
| :--- | :--- | :--- |
| Elmo / cabelo-like | `npm run generate:hair-layer` → generalizar | `public/assets/sprites/generated/{id}/character_rotations/` |
| Armadura / calça / botas | `npm run generate:equipment-layer` (novo) | `{id}/{state}_{dir}/frame_XX.png` |
| Arma / escudo (ícone) | existente `ItemGraphic` / atlas | 32×32 em `public/assets/sprites/` |
| Arco pose no corpo | `create-character-state` + diff ou template walk | overlay animado ou socket |

**Spec por peça:** `docs/sprites/hero/equipment/{id}.spec.json`

Campos mínimos:

```json
{
  "id": "helmet_iron",
  "layer_kind": "head_overlay",
  "equipment_slot": "HEAD",
  "source_entity": "hero_base",
  "character_id": "<hero_base uuid>",
  "production_prompts": {
    "edit_description": "..."
  },
  "visibility_rules": {
    "hides_hair": true
  }
}
```

`layer_kind` enum: `head_overlay` | `body_animated` | `legs_animated` | `boots_animated` | `held_socket_1h` | `held_socket_2h` | `held_bow`.

---

## 8. Template de spec (equipamento corporal)

```json
{
  "id": "armor_leather",
  "layer_kind": "body_animated",
  "equipment_slot": "BODY",
  "item_type": "body_armor",
  "source_entity": "hero_base",
  "character_id": "d8bfd55a-a30b-4821-b2d9-36d8b234063f",
  "production_prompts": {
    "edit_description": "brown leather chest armor on same body, unchanged proportions, low top-down, clean dark outline"
  },
  "diff_mask": {
    "bbox_height_fraction": [0.35, 0.75]
  },
  "animation_profile": {
    "states": ["idle", "walk", "attack"],
    "directions": ["south", "north", "east", "west"],
    "frame_counts": { "idle": 4, "walk": 4, "attack": 3 }
  }
}
```

---

## 9. Validação (checklist de aceite)

Para cada nova peça corporal 3D:

1. **Idle/walk:** sem jitter entre body e camada (head tracking para elmo; diff por frame para roupa).
2. **4 direções:** south/north/east/west legíveis em top-down.
3. **Pés:** botas não flutuam; `HERO_BILLBOARD_LAYOUT.anchorY` inalterado.
4. **Conflitos:** 2H/arco sem escudo; elmo full sem cabelo atravessando.
5. **Equip/unequip:** troca em runtime invalida material em ≤ 1 frame sem leak de textura Babylon.
6. **Save/load:** peça equipada reaparece após reload.
7. **Paridade:** cores/silhueta reconhecíveis vs ícone 32×32 do inventário.

---

## 10. Ordem de implementação recomendada

1. **Sockets 1H + escudo** — menor risco; reutiliza `ItemGraphic` 32×32.
2. **Elmo** — reutiliza pipeline hair + `hides_hair`.
3. **Armadura tronco** — primeiro body layer animado.
4. **Calça + botas** — completar silhueta.
5. **Arco (pose 2H)** — combate à distância visível.
6. **Arma 2 mãos + metadata `twoHanded`** — regras de equip + anim attack.

---

## 11. Referências rápidas

| Conceito | Onde |
| :--- | :--- |
| Slots UI | `src/ui/dashboard/components/HeroEquipmentPanel.tsx` |
| Compatibilidade slot/tipo | `src/config/ItemConstants.ts` |
| Definições de armas/escudos | `src/game/entities/weapons/WeaponRegistry.ts` |
| Compositor 3D atual | `src/three-d/runtime/TwoDParitySpriteFactory.ts` |
| Canvas / pés | `HERO_BILLBOARD_LAYOUT`, `HERO_FEET_Y = 77` |
