# WORLD MAP CONTRACT

_Lido obrigatoriamente antes de qualquer gerador de mapa, script de geração de estruturas ou mudança de tile em `createDebugSliceScene.ts`._

---

## 1. Regra Fundamental: O Mundo é uma Ilha

O mapa principal **sempre** deve ser rodeado por mar. O jogador nunca deve encontrar uma borda "vazia" ou um fim abrupto do mundo.

| Parâmetro            | Valor                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| Borda mínima de mar  | **20 tiles** em todos os lados                                          |
| Tile de mar profundo | `wat` (blocking=true, height≤0.12)                                      |
| Tile de costa/praia  | `snd` (sand, renderAs: floor) — faixa de ~4 tiles entre grs/terra e wat |
| Navegação no mar     | **Bloqueada** por enquanto — `wat` é colisão. Barco é feature futura    |

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

| Bioma    | Tile de chão principal | Tiles especiais                   | Inimigos                 |
| -------- | ---------------------- | --------------------------------- | ------------------------ |
| Cidade   | `cob`, `stn`, `pav`    | `wal`, `bwl`, `arc`, `pil`, `fnt` | goblins, orcs            |
| Campo    | `grs`                  | `tre`, `flw`                      | animais, bandidos        |
| Floresta | `grs` + `tre` denso    | `msh` (cogumelo), trilhas `pat`   | lobos, slimes            |
| Pântano  | `mud` (lama)           | `wat` raso, árvores mortas `dtr`  | sapos, vampiros          |
| Deserto  | `snd` (areia)          | `rok` (rocha), dunas, pirâmide    | mortos-vivos, escorpiões |
| Litoral  | `snd` → `wat`          | costão `rok`, barcos inertes      | crabs, piratas           |

**Transição entre biomas:** sempre gradual, ~6–8 tiles de tiles intermediários (ex: `grs` → `pat` → `mud` → pântano). Nunca bioma A ao lado direto de bioma B sem tile de transição.

---

## 3. Sistema de Layers — Modelo Tibia (CRÍTICO)

**Os layers não têm semântica global fixa.** O que está em `+1` depende do que foi construído no terreno. Isso é o mesmo modelo do Tibia.

### Regra Contextual por Estrutura

| Estrutura       | Level base          | +1                               | +2                               | -1                         | -2                        |
| --------------- | ------------------- | -------------------------------- | -------------------------------- | -------------------------- | ------------------------- |
| Casa 1 andar    | paredes+chão em `0` | cobertura/volume em tiles comuns | —                                | —                          | —                         |
| Casa 2 andares  | paredes+chão em `0` | 2º andar (paredes+chão)          | cobertura/volume em tiles comuns | —                          | —                         |
| Torre 3 andares | `0`                 | `+1`                             | `+2` (ou +3 para cobertura)      | —                          | —                         |
| Morro/colina    | grs em `0`          | topo do morro (grs)              | —                                | —                          | —                         |
| Caverna         | entrada em `0`      | —                                | —                                | galeria em `-1`            | fundo em `-2`             |
| Porão de casa   | casa em `0`         | —                                | —                                | porão em `-1`              | —                         |
| Dungeon         | entrada em `0`      | —                                | —                                | 1º andar em `-1`           | 2º andar em `-2`          |
| Esgoto          | manhole em `0`      | —                                | —                                | túneis em `-1`             | câmaras profundas em `-2` |
| Pirâmide        | base+entrada em `0` | câmara interna                   | câmara do topo                   | câmara subterrânea em `-1` | —                         |

### Default por Level

| Level         | Tile padrão (fill)                                                     |
| ------------- | ---------------------------------------------------------------------- |
| `0`           | `grs` (ou tile do bioma correspondente)                                |
| `+1` e acima  | `...` (void/sky) — **NUNCA** usar `grs` ou outro tile sólido como fill |
| `-1` e abaixo | tile de rocha/dungeon correspondente ao bioma acima                    |

---

## 4. Estruturas Naturais por Composição de Levels

### Princípio

**Nao existe categoria tecnica especial de telhado no runtime.**

Cobertura é apenas a composição natural da estrutura no level acima, usando os mesmos tiles e o mesmo pipeline de geometria/chunk usados para qualquer outro bloco.

### Regra correta

1. O que define "cobertura" é a forma da estrutura ao longo dos levels, não um tile ou branch especial.
2. Qualquer volume no level `N+1` deve encaixar naturalmente sobre o volume de `N`.
3. O runtime deve tratar todos os tiles estruturais pelo mesmo fluxo (sem mesh dedicada de telhado, sem detecção especial de roof).

### Verificação automática obrigatória (geradores)

Todo gerador deve verificar:

1. A cobertura está representada por tiles estruturais comuns em level superior (`N+1`, `N+2`, etc.).
2. Nao existe dependência de marcador técnico de telhado para renderizar a estrutura.
3. A silhueta final se mantém consistente entre levels (sem gaps visuais artificiais).

---

## 5. Anatomia Correta de Estruturas

### Casa 1 Andar (mínimo)

```
Level 0 (todos os tiles da casa são aqui):

  bwl bwl bwl bwl bwl
  bwl flr flr flr bwl
  bwl flr flr flr bwl   ← interior navegável
  bwl bwl [dr] bwl bwl  ← door = 1 tile bwl removido + substituído por cob/grs
  rof rof  rof  rof rof ← telhado cobre TODA a planta (paredes + interior)
```

- Porta: remova 1 tile `bwl` da parede e substitua por `cob`/`grs`
- **Sem escada** — casa 1 andar não tem `stu`
- Level 1 em cima: apenas `...` (void)

### Casa 2 Andares

```
Level 0 — Térreo:
  bwl bwl bwl bwl bwl
  bwl flr flr flr bwl
  bwl flr stu flr bwl   ← stu: jogador sobe pressionando W (norte)
  bwl flr flr flr bwl   ← 1 tile livre ao sul da escada (abordagem)
  bwl bwl [dr] bwl bwl  ← porta ao sul

Level 1 — Segundo andar:
  bwl bwl bwl bwl bwl
  bwl flr flr flr bwl
  bwl flr std flr bwl   ← std: MESMA posição X/Z do stu do level 0
  bwl flr flr flr bwl
  rof rof rof rof rof   ← telhado cobre este andar (mesma posição das paredes de level 1)

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

| Símbolo | ID              | Tipo  | Height | Block   | Notas                                                       |
| ------- | --------------- | ----- | ------ | ------- | ----------------------------------------------------------- |
| `...`   | void            | floor | 0.02   | não     | Default de levels superiores. Cair = void fall              |
| `grs`   | grass           | floor | 0.05   | não     | Default level 0 bioma campo/floresta                        |
| `cob`   | cobblestone     | floor | 0.06   | não     | Calçada da cidade                                           |
| `stn`   | stone-plaza     | floor | 0.07   | não     | Praças                                                      |
| `pav`   | pavement        | floor | 0.06   | não     | Avenidas largas                                             |
| `snd`   | sand            | floor | 0.05   | não     | Praia e deserto                                             |
| `mud`   | mud             | floor | 0.05   | não     | Pântano                                                     |
| `pat`   | path            | floor | 0.04   | não     | Trilha de terra                                             |
| `flr`   | wood-floor      | floor | 0.08   | não     | Interior de casas                                           |
| `sfl`   | sewer-floor     | floor | 0.06   | não     | Chão de esgoto                                              |
| `cfl`   | cave-floor      | floor | 0.07   | não     | Chão de caverna                                             |
| `bal`   | balcony         | floor | 0.08   | não     | Varanda/sacada                                              |
| `wat`   | water           | block | 0.12   | **sim** | Mar, rio. Bloqueia movimento                                |
| `wtr`   | water-shallow   | floor | 0.04   | não     | Água rasa (pântano, poça)                                   |
| `wal`   | city-wall       | block | 4.5    | **sim** | Muralha da cidade. Muito alto                               |
| `bwl`   | building-wall   | block | 2.8    | **sim** | Parede de casa/prédio                                       |
| `dwl`   | dungeon-wall    | block | 2.4    | **sim** | Parede de dungeon/masmorra                                  |
| `swl`   | sewer-wall      | block | 2.5    | **sim** | Parede de esgoto                                            |
| `cwl`   | cave-wall       | block | 2.6    | **sim** | Parede de caverna                                           |
| `sdw`   | stone-dark-wall | block | 5.2    | **sim** | Torre de vigia, muralha grossa                              |
| `rof`   | roof-tile       | floor | 2.8    | não     | Tile visual opcional; sem comportamento especial no runtime |
| `arc`   | archway         | block | 3.8    | **sim** | Arco/portal. Player passa embaixo                           |
| `pil`   | pillar          | block | 3.2    | **sim** | Coluna decorativa                                           |
| `fnt`   | fountain        | block | 0.9    | **sim** | Fonte. Bloqueia 1×1                                         |
| `tre`   | tree            | block | 3.4    | **sim** | Árvore. Bloqueia 1×1                                        |
| `rok`   | rock            | block | 1.2    | **sim** | Pedra/rochedo                                               |
| `stu`   | stairs-up       | floor | 0.12   | não     | transition: "up". Posição espelhada com std acima           |
| `std`   | stairs-down     | floor | 0.12   | não     | transition: "down". Posição espelhada com stu abaixo        |
| `hol`   | hole            | floor | 0.02   | não     | transition: "down". Queda automática                        |

---

## 7. Regras de Escadas (Stairs)

### Como funciona no runtime (3D)

A animação de escada é **walkthrough** — o personagem caminha diagonalmente (X/Z + Y simultâneo) durante 1,5 segundos. Não é um elevador. O personagem move na direção que o jogador estava se movendo ao ativar a escada.

- `stairAnimDuration = 1.5s`
- `STAIR_HORIZ_SPEED = 1.0` tile/s → ~1,5 tiles de avanço horizontal durante a subida
- O level switch ocorre no ponto médio da animação (progress = 0.5)
- Movimento do jogador fica bloqueado durante a animação

### Visual (buildStairMesh)

O tile `stu`/`std` gera automaticamente um mesh de 4 degraus físicos (não um piso plano):

- Degrau 0 = mais ao sul (+Z), mais baixo (baseY + riserH/4)
- Degrau 3 = mais ao norte (-Z), mais alto (baseY + LEVEL_HEIGHT_UNITS)
- Todos os degraus compartilham o mesmo material colorido (cor areia/madeira)

### Regras de layout no mapa

1. **Par obrigatório:** cada `stu` em level `N` deve ter `std` na **mesma posição X/Z** em level `N+1`.
2. **Corredor mínimo:** a escada deve ter pelo menos **2 tiles de chão livre** em frente (na direção que o jogador sobe) para o personagem completar o avanço horizontal sem colidir com a parede.
3. **Não empilhar:** nunca `stu` imediatamente adjacente a `std` no mesmo level (causa loop).
4. **Espaço de chegada:** os 4 tiles ao redor do `std` de chegada devem ser navegáveis.
5. **Orientação recomendada:** jogador sobe caminhando para **norte** (pressionando W). Posicione a escada com a porta/entrada ao sul.

### Anatomia de uma escada interna (casa 2 andares)

```
Level 0 — Planta baixa (N = norte, S = sul, E = leste, W = oeste):

    W───────────────E
    │  bwl bwl bwl  │  ← parede norte
    │  flr flr flr  │
    │  flr stu flr  │  ← stu: jogador pressiona W aqui para subir
    │  flr flr flr  │  ← 2 tiles de chão livre ao sul da escada (espaço de abordagem)
    │  bwl [dr] bwl │  ← porta ao sul
    S───────────────S

Level 1 — Segundo andar (mesma planta):

    W───────────────E
    │  bwl bwl bwl  │
    │  flr flr flr  │
    │  flr std flr  │  ← std na mesma posição X/Z do stu de level 0
    │  flr flr flr  │  ← personagem chega aqui após subir
    │  rof rof rof  │  ← telhado cobre a parede sul (mesma posição, level 1)
    S───────────────S

Level 2: apenas ... (void)
```

---

## 8. Anatomia de Entradas de Caverna

Uma caverna no mundo tem **duas partes**: a boca visível na superfície (level 0) e o interior subterrâneo (level -1 em diante).

### Boca de caverna (level 0)

```
Ao redor: bioma floresta ou montanha (grs + tre + rok)

    ...  rok  rok  rok  rok  ...
    ...  rok  cwl  cwl  rok  ...
    ...  cwl  hol  cwl  ...  ...   ← hol = queda automática para level -1
    ...  rok  cwl  cwl  rok  ...
    ...  rok  rok  rok  rok  ...
```

- `rok` = pedras/rochas em volta (blocking)
- `cwl` = paredes de caverna formando a "moldura" da entrada
- `hol` = buraco de queda automática (transition: "down") — o tile **não tem mesh de degraus**, é visualmente escuro
- Alternativa: `std` em vez de `hol` para entrada **voluntária** (jogador right-clica)

### Quando usar `hol` vs `std` na entrada

| Tipo                           | Tile  | Ativação            | Uso                                           |
| ------------------------------ | ----- | ------------------- | --------------------------------------------- |
| Buraco no chão                 | `hol` | Automático ao pisар | Poço, fenda, abismo, cova de dungeon          |
| Escada/Rampa para baixo        | `std` | Right-click         | Escada de pedra, rampa, descida controlada    |
| Descida de caverna com degraus | `std` | Right-click         | Entrada de gruta com rampa esculpida na rocha |

### Interior da caverna (level -1)

```
Fill padrão: cwl (paredes de caverna — não usar grs nem ...)

    cwl cwl cwl cwl cwl cwl cwl
    cwl cfl cfl cfl cfl cfl cwl   ← corredor mínimo 3 tiles largura
    cwl cfl stu cfl cfl cfl cwl   ← stu = escada de volta à superfície (mesmo X/Z do hol/std acima)
    cwl cfl cfl cfl cfl cfl cwl
    cwl cwl cwl cwl cwl cwl cwl
```

- Nunca usar `...` (void) como fill em cavernas — só em levels aéreos
- `wtr` em poças isoladas (máx. 20% do chão de uma caverna)
- Inimigos subterrâneos: morcegos, slimes, esqueletos

---

## 9. Anatomia de Entradas de Dungeon

Dungeons têm **aparência construída** (não natural), geralmente com portão de pedra ou arco.

### Entrada de dungeon (level 0)

```
Ao redor: bioma campo ou floresta

    ...  grs  grs  grs  grs  ...
    ...  grs  dwl  dwl  grs  ...
    ...  dwl  arc  dwl  ...  ...   ← arc = arco de entrada (blocking, alto = 3.8)
    ...  grs  std  grs  ...  ...   ← std DENTRO do arco — jogador desce voluntariamente
    ...  grs  grs  grs  grs  ...

Opcional: 2 pilares (pil) flanqueando o arco:
    ...  pil  arc  pil  ...
```

- O `std` fica DENTRO da silhueta do arco (mesma posição Z, 1 tile ao sul do `arc`)
- `dwl` forma as paredes curtas que sustentam o arco
- Sinalização visual: textura escura + possivelmente inimigos ao redor

### Interior da dungeon (level -1)

```
Fill padrão: dwl (paredes de dungeon — pedra escura)

    dwl dwl dwl dwl dwl dwl dwl
    dwl dfn dfn dfn dfn dfn dwl   ← dfn = piso de dungeon (pedra fria)
    dwl dfn stu dfn dfn dfn dwl   ← stu = volta à superfície
    dwl dfn dfn dfn dwl dfn dwl   ← can have interior walls/rooms
    dwl dwl dwl dwl dwl dwl dwl
```

- Mínimo 3 tiles de largura em corredores
- Salas: 5×5 a 8×8, conectadas por corredores de 3 de largura
- Armadilhas: `hol` em salas com buracos visuais (queda para level -2)
- Inimigos: esqueletos, orcs guardas, magos sombrios

---

## 8. Regras de Densidade por Bioma

| Bioma    | Árvores (`tre`)         | Inimigos (spawn)      | Estruturas                        |
| -------- | ----------------------- | --------------------- | --------------------------------- |
| Cidade   | raras (praças)          | médio (goblins, orcs) | casas densas, torres, fontanas    |
| Campo    | esparsas                | baixo (animais)       | fazendas simples, celeiros        |
| Floresta | **densa** (60% do chão) | médio (lobos)         | cabana isolada, portal de caverna |
| Pântano  | árvores mortas (`dtr`)  | médio-alto            | ruínas com porão, altar           |
| Deserto  | nenhuma                 | alto (mortos-vivos)   | pirâmide, oásis c/ `wtr`          |
| Litoral  | palmeiras (`pal`)       | baixo                 | cais, barcos, costão              |

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

_Criado: 2026-05-01 — Responsável: AI Agent (Copilot)_  
_Referência: `docs/contracts/MAP_SYSTEM_CONTRACT.md`, `docs/SYSTEM_BMS.md`, `src/three-d/runtime/createDebugSliceScene.ts` (buildRoofMesh, buildChunk)_
