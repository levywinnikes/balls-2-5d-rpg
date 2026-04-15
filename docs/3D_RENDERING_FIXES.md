# Documentação Técnica: Sistema 3D Cardboard City

Esta documentação detalha a refatoração completa do sistema de renderização 2.5D para o modo 3D "Cardboard City", realizada para eliminar distorções de perspectiva, artefatos visuais internos e problemas de alinhamento vertical.

## 1. Visão Geral do Sistema

O objetivo foi transformar tiles 2D planos em volumes "3D" (cubos), mantendo a compatibilidade com o sistema de coordenadas atual do jogo e permitindo um modo 2D/3D opcional.

### Principais Mudanças de Conceito (v2)
- **Z-Shift Zero:** Diferente da versão anterior, os tiles de todos os níveis permanecem na mesma posição X, Y do grid. Não há deslocamento vertical dos containers para "subir" andares.
- **Faces Descendentes:** O volume 3D é criado por faces laterais que se estendem **para baixo** a partir da borda inferior do tile original.
- **Profundidade (Depth) Invertida:** O tile original é renderizado com um depth superior ao das faces laterais, garantindo que a "tampa" do cubo sempre fique na frente das laterais.

## 2. Detalhes Técnicos da Implementação

### 2.1. Controle de Modo (2D/3D)
**Arquivo:** `src/game/entities/Player/PlayerState.ts`
Foi adicionado o flag `enable3D` aos `diagnosticSettings`. Isto permite alternar o modo de renderização em tempo real através do Painel de Diagnóstico (**Shift + D**).

### 2.2. Empilhamento Vertical Estático
**Arquivo:** `src/game/maps/LevelRenderer.ts` -> `updateAllTileTints()`
- Removida a lógica de `setScale` e translação por parallax que causava "jitter" visual.
- `container.y` é mantido em 0 para todos os níveis, eliminando o efeito "escada" (onde andares superiores pareciam deslocados para trás/cima).

### 2.3. Geração Procedural de Faces
**Arquivo:** `src/game/maps/LevelRenderer.ts` -> `renderSideFaces()`

#### Lógica de Filtragem
Para evitar "borrões" e poluição visual, o sistema utiliza:
- **`isStructuralTile()`**: Apenas tiles como paredes (`wall`), montanhas, rochas e árvores geram faces.
- **`shouldSkipSideFace()`**: Impede explicitamente a geração de faces em telhados, escadas, camas e outros objetos decorativos.
- **`isNeighborStructural()`**: Se uma parede estiver ao lado de outra, a face entre elas não é gerada (evita faces dentro de paredes sólidas).

#### Lógica de Altura Multi-Andar
O sistema detecta automaticamente prédios de vários andares:
- Ele percorre os níveis acima do atual na mesma coordenada (X, Y).
- Se houver mais paredes empilhadas, a face gerada no nível atual será mais alta (`sideFaceHeight * número_de_andares`).
- Isso cria uma parede 3D contínua, mesmo que o prédio tenha 3 ou 4 andares.

### 2.4. Gráficos das Faces
**Arquivo:** `src/game/graphics/tiles/SideFaceGraphic.ts`
- Corrigido o erro onde faces leste/oeste tinham altura fixa de 32px. Agora todas as faces respeitam o parâmetro de altura dinâmica, permitindo os muros altos de prédios multi-andar.
- **Faces Norte:** Removidas para evitar conflito com a visão 2.5D top-down, onde o jogador tipicamente não vê o "fundo" das estruturas.

## 3. Guia de Depuração

| Comando | Função |
|--- |--- |
| **Shift + D** | Abre o painel de diagnósticos |
| **Página Up / Down** | Salto de eixo Z (se teclas debug ativas) |
| **Checkbox "3D"** | Alterna entre visual 2D clássico e 3D Cardboard |

## 4. Resultados Alcançados
- ✅ Eliminação total da distorção ao mover o jogador.
- ✅ Alinhamento perfeito entre andares de prédios.
- ✅ Interiores de casas limpos e sem "faixas" flutuantes.
- ✅ Efeito de volume sólido e consistente em estruturas.
