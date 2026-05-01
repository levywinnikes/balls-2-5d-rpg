# WORLD MAP CONTRACT
*Lido obrigatoriamente antes de qualquer gerador de mapa, script de geração de estruturas ou mudança de tile em `createDebugSliceScene.ts`.*

---

## 1. Regra Fundamental: O Mundo é uma Ilha

O mapa principal **sempre** deve ser rodeado por mar. O jogador nunca deve encontrar uma borda "vazia" ou um fim abrupto do mundo.

| Parâmetro | Valor |
|-----------|-------|
| Borda mínima de mar | **20 tiles** em todos os lados |
| Tile de mar profundo | `wat` (blocking=true, height≤0.12) |
| Tile de costa/praia | `snd` (sand, renderAs: floor) — faixa de ~4 tiles entre grs/terra e wat |
| Navegação no mar | **Bloqueada** por enquanto — `wat` é colisão. Barco é feature futura |

**Válido:**
```
[wat][wat][wat][wat][wat]
[wat][snd][grs][grs][wat]   ← ilha com borda de areia
[wat][grs][CIDADE][grs][wat]
[wat][snd][grs][grs][wat]
[wat][wat][wat][wat][wat]
```

**Inválido:**
```
[wal][wal][wal]    ← bordas sólidas bloqueando a visão de mundo aberto
[grs][grs][grs]   ← mapa termina sem mar
```

---

## 2. Layout do Mundo Principal (`city_3d_multi`)

**Dimensões:** 256×256 tiles (8192×8192 px)  
**Spawn inicial:** x=128, y=128 (centro da cidade)  
**Levels presentes:** `-2`, `-1`, `0`, `+1`, `+2`

### Distribuição de Biomas (level 0)
```
┌──────────────────────────────────────────────────────┐
│  ~ ~ ~ ~ ~ ~ ~ ~ ~ MAR ABERTO ~ ~ ~ ~ ~ ~ ~ ~ ~ ~   │
│  ~ ~ ┌────────────────────────────────────────┐ ~ ~ │
│  ~ ~ │  FLORESTA DENSA  │  PÂNTANO            │ ~ ~ │
│  ~ ~ │  [árvores, trilha│  [lama, ruínas]     │ ~ ~ │
│  ~ ~ │  caverna em -1]  │                     │ ~ ~ │
│  ~ ~ ├──────┬───────────┴────────┬────────────┤ ~ ~ │
│  ~ ~ │CAMPO │   CIDADE (centro)  │  CAMPO     │ ~ ~ │
│  ~ ~ │(grs) │   spawn=128,128    │  (grs)     │ ~ ~ │
│  ~ ~ ├──────┴───────────┬────────┴────────────┤ ~ ~ │
│  ~ ~ │   DESERTO        │   LITORAL           │ ~ ~ │
│  ~ ~ │   [areia, dunas  │   [praia, costa]    │ ~ ~ │
│  ~ ~ │   pirâmide -1]   │   ~ ~ mar próximo   │ ~ ~ │
│  ~ ~ └────────────────────────────────────────┘ ~ ~ │
│  ~ ~ ~ ~ ~ ~ ~ ~ ~ MAR ABERTO ~ ~ ~ ~ ~ ~ ~ ~ ~ ~   │
└──────────────────────────────────────────────────────┘
```

### Biomas — Tiles e Fronteiras
| Bioma | Tile de chão principal | Tiles especiais | Inimigos |
|-------|------------------------|-----------------|----------|
| Cidade | `cob`, `stn`, `pav` | `wal`, `bwl`, `arc`, `pil`, `fnt` | goblins, orcs |
| Campo | `grs` | `tre`, `flw` | animais, bandidos |
| Floresta | `grs` + `tre` denso | `msh` (cogumelo), trilhas `pat` | lobos, slimes |
| Pântano | `mud` (lama) | `wat` raso, árvores mortas `dtr` | sapos, vampiros |
| Deserto | `snd` (areia) | `rok` (rocha), dunas, pirâmide | mortos-vivos, escorpiões |
| Litoral | `snd` → `wat` | costão `rok`, barcos inertes | crabs, piratas |

**Transição entre biomas:** sempre gradual, ~6–8 tiles de tiles intermediários (ex: `grs` → `pat` → `mud` → pântano). Nunca bioma A ao lado direto de bioma B sem tile de transição.

---

## 3. Sistema de Layers — Modelo Tibia (CRÍTICO)

**Os layers não têm semântica global fixa.** O que está em `+1` depende do que foi construído no terreno. Isso é o mesmo modelo do Tibia.

### Regra Contextual por Estrutura

| Estrutura | Level base | +1 | +2 | -1 | -2 |
|-----------|-----------|-----|-----|-----|-----|
| Casa 1 andar | paredes+chão em `0` | telhado em `0` | — | — | — |
| Casa 2 andares | paredes+chão em `0` | 2º andar (paredes+chão) | telhado em `+1` | — | — |
| Torre 3 andares | `0` | `+1` | `+2` | — | — |
| Morro/colina | grs em `0` | topo do morro (grs) | — | — | — |
| Caverna | entrada em `0` | — | — | galeria em `-1` | fundo em `-2` |
| Porão de casa | casa em `0` | — | — | porão em `-1` | — |
| Dungeon | entrada em `0` | — | — | 1º andar em `-1` | 2º andar em `-2` |
| Esgoto | manhole em `0` | — | — | túneis em `-1` | câmaras profundas em `-2` |
| Pirâmide | base+entrada em `0` | câmara interna | câmara do topo | câmara subterrânea em `-1` | — |

### Default por Level
| Level | Tile padrão (fill) |
|-------|-------------------|
| `0` | `grs` (ou tile do bioma correspondente) |
| `+1` e acima | `...` (void/sky) — **NUNCA** usar `grs` ou outro tile sólido como fill |
| `-1` e abaixo | tile de rocha/dungeon correspondente ao bioma acima |

---

## 4. Regras de Telhado (CORRIGE BUG HISTÓRICO)

> **Problema documentado:** telhados aparecem "flutuando" quando o tile `rof` é colocado em level `+1` ou `+2`.

### Causa técnica
`buildRoofMesh()` em `createDebugSliceScene.ts` posiciona a base do telhado em:
```
baseY = levelOffsetY + tileDef.height
```
Se `rof` está em level `+1` → `levelOffsetY = 2.0`, `tileDef.height = 2.8` → base em Y=4.8.  
Mas as paredes de level `0` terminam em Y=2.8. **Gap de 2 unidades → telhado flutua.**

### Regra correta
**O tile `rof` deve sempre estar no mesmo level que as paredes que ele cobre.**

```
ERRADO:
  Level 0: [bwl][flr][flr][bwl]
  Level 1: [...][rof][rof][...]   ← rof em level acima → flutua

CORRETO:
  Level 0: [bwl][flr][flr][bwl]
           [rof][rof][rof][rof]   ← rof NO MESMO level das paredes
  Level 1: [...][...][...][...]   ← vazio acima (apenas se for casa 1 andar)
```

Para **casa de 2 andares** com telhado no 2º andar:
```
Level 0: [bwl][flr][flr][bwl]  ← paredes do térreo
Level 1: [bwl][flr][flr][bwl]  ← paredes do 2º andar
         [rof][rof][rof][rof]   ← telhado ainda em level 1, covering level-1 walls
Level 2: [...][...][...][...]   ← void acima
```

### Verificação automática obrigatória (geradores)
Todo gerador que emite tiles `rof` deve verificar:
1. Existe tile `wal` ou `bwl` **na mesma posição** no mesmo level com `height >= 2.0`?  
   ✅ OK — a pirâmide de telhado ficará no topo correto dessas paredes.
2. O tile `rof` está em level `N+1` relativo às paredes em `N`?  
   ❌ PROIBIDO — mova `rof` para level `N`.

---

## 5. Anatomia Correta de Estruturas

### Casa 1 Andar (mínimo)
```
Level 0 (todos os tiles da casa são aqui):
  bwl bwl bwl bwl bwl
  bwl flr flr flr bwl
  bwl flr flr flr bwl
  bwl flr flr flr bwl
  bwl bwl [door] bwl bwl   ← door = tile de chão (cob/grs), não muro
  rof rof  rof  rof rof    ← mesmo level, mesma posição X/Z da casa
```
- Porta: remova 1 tile `bwl` da parede sul e substitua por `cob`/`grs`
- Telhado cobre TODA a planta (incluindo paredes externas)
- Escada **dentro** da casa → `stu` em level 0 → entra em level 1

### Casa 2 Andares
```
Level 0: bwl bwl bwl → interior flr → door em sul
         [stu] em algum tile interno

Level 1 (2º andar):
         bwl bwl bwl (mesmas posições X/Z das paredes do térreo)
         flr flr flr (interior)
         [std] na posição do stu de level 0
         rof rof rof (mesmas posições X/Z que as paredes de level 1)

Level 2: apenas ... (void)
```

### Torre (3+ andares)
- Footprint menor que casas: 4×4 a 6×6 tiles
- Cada andar = mesmo padrão (bwl perimeter + flr interior)
- Telhado apenas no andar mais alto
- Permite `bal` (balcony) em qualquer andar sem paredes externas (abertura)

### Caverna/Dungeon
```
Level 0: entrada marcada com tile de transição (std ou hol)
         Sem "buraco visível" no chão — use std invisível em entrada de gruta

Level -1: cwl como default (não grs, não ...)
          cfl no interior navegável
          std para descer, stu para subir
          Água (wtr) em poças isoladas

Level -2: mesma lógica, mais escuro (dwl ao invés de cwl)
```

### Esgoto
```
Level 0: manhole tile (hol) em calçada — transição automática
Level -1: swl como paredes, sfl como chão, wtr em canais
          Largura mínima de corredor navegável: 3 tiles
```

---

## 6. Tile Atlas Canônico

Todo mapa do mundo principal deve ter esses tiles no `tileAtlas`. Símbolo → regras.

| Símbolo | ID | Tipo | Height | Block | Notas |
|---------|----|------|--------|-------|-------|
| `...` | void | floor | 0.02 | não | Default de levels superiores. Cair = void fall |
| `grs` | grass | floor | 0.05 | não | Default level 0 bioma campo/floresta |
| `cob` | cobblestone | floor | 0.06 | não | Calçada da cidade |
| `stn` | stone-plaza | floor | 0.07 | não | Praças |
| `pav` | pavement | floor | 0.06 | não | Avenidas largas |
| `snd` | sand | floor | 0.05 | não | Praia e deserto |
| `mud` | mud | floor | 0.05 | não | Pântano |
| `pat` | path | floor | 0.04 | não | Trilha de terra |
| `flr` | wood-floor | floor | 0.08 | não | Interior de casas |
| `sfl` | sewer-floor | floor | 0.06 | não | Chão de esgoto |
| `cfl` | cave-floor | floor | 0.07 | não | Chão de caverna |
| `bal` | balcony | floor | 0.08 | não | Varanda/sacada |
| `wat` | water | block | 0.12 | **sim** | Mar, rio. Bloqueia movimento |
| `wtr` | water-shallow | floor | 0.04 | não | Água rasa (pântano, poça) |
| `wal` | city-wall | block | 4.5 | **sim** | Muralha da cidade. Muito alto |
| `bwl` | building-wall | block | 2.8 | **sim** | Parede de casa/prédio |
| `dwl` | dungeon-wall | block | 2.4 | **sim** | Parede de dungeon/masmorra |
| `swl` | sewer-wall | block | 2.5 | **sim** | Parede de esgoto |
| `cwl` | cave-wall | block | 2.6 | **sim** | Parede de caverna |
| `sdw` | stone-dark-wall | block | 5.2 | **sim** | Torre de vigia, muralha grossa |
| `rof` | roof-tile | floor | 2.8 | não | **Ver Seção 4. Mesmo level das paredes** |
| `arc` | archway | block | 3.8 | **sim** | Arco/portal. Player passa embaixo |
| `pil` | pillar | block | 3.2 | **sim** | Coluna decorativa |
| `fnt` | fountain | block | 0.9 | **sim** | Fonte. Bloqueia 1×1 |
| `tre` | tree | block | 3.4 | **sim** | Árvore. Bloqueia 1×1 |
| `rok` | rock | block | 1.2 | **sim** | Pedra/rochedo |
| `stu` | stairs-up | floor | 0.12 | não | transition: "up". Posição espelhada com std acima |
| `std` | stairs-down | floor | 0.12 | não | transition: "down". Posição espelhada com stu abaixo |
| `hol` | hole | floor | 0.02 | não | transition: "down". Queda automática |

---

## 7. Regras de Escadas (Stairs)

1. **Par obrigatório:** cada `stu` em level `N` deve ter `std` na **mesma posição X/Z** em level `N+1`.
2. **Não empilhar:** nunca `stu` imediatamente adjacente a `std` no mesmo level (causa loop de transição).
3. **Espaço de chegada:** os 4 tiles ao redor do `std` de chegada devem ser navegáveis (não `wal`/`bwl`).
4. **Posição dentro do contexto:** escadas sempre dentro ou imediatamente adjacentes à estrutura que conectam.

---

## 8. Regras de Densidade por Bioma

| Bioma | Árvores (`tre`) | Inimigos (spawn) | Estruturas |
|-------|-----------------|------------------|------------|
| Cidade | raras (praças) | médio (goblins, orcs) | casas densas, torres, fontanas |
| Campo | esparsas | baixo (animais) | fazendas simples, celeiros |
| Floresta | **densa** (60% do chão) | médio (lobos) | cabana isolada, portal de caverna |
| Pântano | árvores mortas (`dtr`) | médio-alto | ruínas com porão, altar |
| Deserto | nenhuma | alto (mortos-vivos) | pirâmide, oásis c/ `wtr` |
| Litoral | palmeiras (`pal`) | baixo | cais, barcos, costão |

---

## 9. Regras de Geração Procedural (para geradores de mapa)

1. **Nunca acessar `mapData.levels[z].map` diretamente.** Usar `MapLoader.getTileAt(x, y, level)`.
2. **Todos os levels devem ter o mesmo width×height.** Levels superiores preenchidos com `...`, underground com tile de rocha.
3. **Normalização de tamanho:** `level_data.width` e `level_data.height` sempre iguais ao `map.width` e `map.height` do header.
4. **tileSize:** sempre 32. Nunca 128, nunca outro valor.
5. **Após gerar:** rodar `npm run check:bms` para validar integridade do arquivo binário.
6. **Spawn de inimigos:** entidades no JSON header, não no binário. Usar `entityTemplates` definidos.
7. **Mar nas bordas:** as primeiras e últimas 20 linhas/colunas de level 0 são sempre `wat`.

---

## 10. Validações Obrigatórias Antes de Commitar Mapa

```bash
npm run check:bms                    # integridade do BMS
npx tsc --noEmit --skipLibCheck      # TypeScript
npm run benchmark:e2e                # 14/14 steps
```

Inspecionar visualmente (checklist manual):
- [ ] Bordas do mapa têm ≥20 tiles de `wat`?
- [ ] Nenhum tile `rof` está em level diferente das paredes que cobre?
- [ ] Todos os `stu` têm `std` correspondente no level acima (mesma posição)?
- [ ] Levels `+1` e acima têm `...` como tile padrão (não `grs`)?
- [ ] Largura mínima de corredor em dungeons/esgotos ≥ 3 tiles?
- [ ] Biomas têm tile de transição (não se tocam diretamente)?

---

*Criado: 2026-05-01 — Responsável: AI Agent (Copilot)*  
*Referência: `docs/contracts/MAP_SYSTEM_CONTRACT.md`, `docs/SYSTEM_BMS.md`, `src/three-d/runtime/createDebugSliceScene.ts` (buildRoofMesh, buildChunk)*
