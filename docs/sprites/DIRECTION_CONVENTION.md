# Sprite Direction Convention (Canonical)

**Read this before generating NPCs/enemies, wiring 3D billboards, or debugging “sprite virado errado”.**

Related:

- Runtime inimigos 3D: `docs/three-d/ENEMY_SPRITE_RUNTIME.md`
- Geração PixelLab: `docs/sprites/MODULAR_SPRITE_AND_NPC_GENERATION_GUIDE.md`
- Contrato: `docs/contracts/SPRITE_PIPELINE_CONTRACT.md`
- Referência visual: `public/assets/sprites/generated/hero_base/character_rotations/`

---

## 1. Nomes de direção (não são bússola)

No projeto, `south` / `north` / `east` / `west` são **nomes de pasta PixelLab alinhados à tela do jogo**, não “sul geográfico do mapa mundi”.

| Direção BMS / PixelLab | Sufixo anim 2D (`Enemy.ts`) | O que o PNG deve mostrar | Movimento 2D (`velocity`) |
| :--- | :--- | :--- | :--- |
| `south` | `down` | **Frente** voltada para a câmera | `y > 0` |
| `north` | `up` | **Costas** (nuca) | `y < 0` |
| `east` | `right` | Perfil; corpo/nariz apontam para a **direita** do PNG | `x > 0` |
| `west` | `left` | Perfil; corpo/nariz apontam para a **esquerda** do PNG | `x < 0` |

**Referência de ouro:** `hero_base`. Todo personagem gerado deve bater com essas orientações em `character_rotations/{south,north,east,west}.png`.

---

## 2. Validação visual obrigatória (antes de integrar)

Abra lado a lado:

```
public/assets/sprites/generated/hero_base/character_rotations/east.png
public/assets/sprites/generated/{novo_entity}/character_rotations/east.png
```

Checklist rápido:

1. **`south`** — rosto visível (frente).
2. **`north`** — costas / nuca.
3. **`east`** — personagem “olha” para a **direita** da imagem (mesmo sentido que `hero_base` east).
4. **`west`** — personagem “olha” para a **esquerda** da imagem (mesmo sentido que `hero_base` west).
5. Repetir spot-check em `walk_east/frame_00.png` e `attack_east/frame_00.png` (pastas seguem a mesma convenção).

Se `east` do novo personagem parecer `west` do herói → **assets invertidos**. Corrija os arquivos; não assuma que o runtime vai adivinhar.

### Teste in-game (DEBUG SANDBOX)

1. `npm run generate:debug-sandbox`
2. Entrar numa **sala com um único inimigo** (layout `enemy_rooms`).
3. Ficar **ao sul** do inimigo (aumentar Z / descer na tela) → sprite **frente** (`south`).
4. Ficar **ao norte** (diminuir Z) → sprite **costas** (`north`).
5. Ficar **à direita** (+X) → perfil **east** (olhando para você).
6. Ficar **à esquerda** (−X) → perfil **west**.
7. Em melee: animação **attack** usa 3 frames na direção correta; não trava no frame 0.

---

## 3. Eixos mundo (3D slice)

```
Map tile X  →  world X
Map tile Y  →  world Z     (worldToSliceCoord: valor / 32)
```

Câmera top-down (`createDebugSliceScene.ts`):

- `ArcRotateCamera` com `alpha = π/2` (travado)
- **`+Z` na tela = para baixo = `south`** (igual minimap / Phaser `+y = down`)

Função canônica para inimigos — `resolveWorldBmsDirection(deltaX, deltaZ)` em `TwoDParitySpriteFactory.ts`:

```
+deltaX  →  east
−deltaX  →  west
+deltaZ  →  south    (NÃO north)
−deltaZ  →  north
```

Paridade 2D: `src/game/entities/Enemy.ts` (~197–200) usa `velocity.y > 0 → down` e `velocity.x > 0 → right`.

### Herói vs inimigo (não misturar)

| Actor | Função | Entrada |
| :--- | :--- | :--- |
| Herói 3D | `resolveHeroBmsDirection` | WASD **relativo à tela** (`moveForward`, `moveRight`) |
| Inimigo 3D | `resolveWorldBmsDirection` | Vetor **mundo** (para jogador ou delta de movimento) |

Nunca trocar north/south ou east/west no código “no feeling” — primeiro valide assets contra `hero_base`.

---

## 4. Erros comuns (post-mortem)

| Sintoma | Causa usual | Correção correta |
| :--- | :--- | :--- |
| Corre de **costas** ao perseguir (N/S) | `+deltaZ` mapeado para `north` | Usar `+deltaZ → south` em `resolveWorldBmsDirection` |
| **Esquerda/direita** invertidos | Pastas `east_*` / `west_*` **rotuladas ao contrário** no disco (vs `hero_base`) | Validar PNGs; renomear pastas ou regenerar PixelLab |
| Ataque não anima / fica no frame 0 | `_setAnimState("attack")` ignorado se já em attack | Passar `restart=true`; lock ≥ `getGeneratedAttackDurationMs` |
| Perfil errado em diagonal | Só path delta, não olhar para alvo | `faceEnemyToward(player)` ao perseguir/atacar |
| “Consertei invertendo no AI” | Gambiarra por asset errado | Corrigir asset; ver §5 |

---

## 5. Corrigir assets (preferido)

Ordem de preferência:

1. **Regenerar** com `npm run generate:pixellab-sprite -- --spec … --entity {id}` e revalidar contra `hero_base`.
2. **Renomear pastas** no disco se só east/west estiverem trocados (ex.: trocar conteúdo de `walk_east` ↔ `walk_west`).
3. **Runtime swap (último recurso)** — ver §6.

Após corrigir assets, remover o id de `GENERATED_SWAP_EAST_WEST_ASSET_DIRS` em `TwoDParitySpriteFactory.ts`.

---

## 6. Runtime swap east/west (exceção documentada)

Constante: `GENERATED_SWAP_EAST_WEST_ASSET_DIRS` em `src/three-d/runtime/TwoDParitySpriteFactory.ts`.

Quando usar:

- Assets já commitados com east/west invertidos **e** regeneração imediata não é possível.
- Validação visual confirmou divergência vs `hero_base`.

O que faz:

- Runtime pede direção lógica `east` → carrega pasta `*_west/*`.
- Runtime pede `west` → carrega pasta `*_east/*`.
- **Não altera** north/south.

Entidades atuais:

| Entity | Status | Ação futura |
| :--- | :--- | :--- |
| `goblin_lanceiro` (alias `goblin`) | `runtime_swap_east_west` | Regenerar; validar; remover do Set |

Registrar no spec JSON do personagem:

```json
"direction_validation": {
  "reference": "hero_base",
  "status": "runtime_swap_east_west",
  "note": "east/west folders inverted vs hero_base; see DIRECTION_CONVENTION.md §6"
}
```

Quando `status` for `"ok"`, o id **não** deve estar em `GENERATED_SWAP_EAST_WEST_ASSET_DIRS`.

---

## 7. Pontos de código (não duplicar lógica)

| Arquivo | Responsabilidade |
| :--- | :--- |
| `TwoDParitySpriteFactory.ts` | `resolveWorldBmsDirection`, `resolveGeneratedAssetDirection`, anim material |
| `createDebugSliceScene.ts` | `faceEnemyToward`, AI chase/attack, lock de anim |
| `ThreeDEnemyVisualRegistry.ts` | Billboard + `_setDirection` / `_setAnimState` |
| `Enemy.ts` (2D) | Paridade velocity → down/up/left/right |

---

## 8. Checklist de merge (copiar na PR / task)

```
[ ] Li docs/sprites/DIRECTION_CONVENTION.md
[ ] character_rotations/{4 dirs} comparados com hero_base
[ ] DEBUG SANDBOX: teste N/S/E/W na sala do inimigo
[ ] attack: todos os frames visíveis; lock de duração ok
[ ] Se swap runtime: documentado em spec.direction_validation + ENEMY_SPRITE_RUNTIME.md
[ ] GENERATED_SPRITE_ENTITIES / GENERATED_ANIM_DEFS atualizados
[ ] Nenhuma inversão ad-hoc no AI sem validação de asset
```

---

## 9. Para IAs — regra de ouro

1. **Sprite errado → validate assets first**, not `resolveWorldBmsDirection` hacks.
2. **N/S e E/W são independentes** — corrigir um não corrige o outro.
3. **`hero_base` is the compass** for all generated humanoids/monsters.
4. Documentar exceções (`GENERATED_SWAP_*`) no spec + este arquivo.
