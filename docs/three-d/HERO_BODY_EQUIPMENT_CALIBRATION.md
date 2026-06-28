# Calibração Visual de Equipamentos (Armas & Escudo)

Este documento registra os dados de calibração física, coordenadas de sockets de mão, pivots de itens e regras de renderização extraídos da silhueta do herói base (canvas 92x92) para servir de referência para futuras melhorias.

---

## 1. Convenção de Lateralidade (Mãos)
O herói é considerado **canhoto** (left-handed) para se alinhar à animação do sprite base:
*   **Arma (`MAIN_HAND`)**: Segurada na **Mão Esquerda** (Screen Right quando virado para o Sul).
*   **Escudo (`OFF_HAND`)**: Segurado na **Mão Direita** (Screen Left quando virado para o Sul).

---

## 2. Pivots dos Itens (Grid 32x32)
*   **Escudos**: Pivot centralizado em `(16, 16)`.
*   **Armas de 1 Mão (Espadas/Machados)**: Como os assets padrão (ex: `wooden_sword.png`) são desenhados apontando verticalmente para cima e centralizados horizontalmente, o pivot do punho fica em:
    *   `pivotX = 16`
    *   `pivotY = 24`
    *(Offset de desenho no canvas composto: `x - 16`, `y - 24`)*

---

## 3. Coordenadas de Sockets Calibradas (Mãos no Canvas 92x92)

As coordenadas abaixo foram mapeadas frame a frame com base em uma grade visual de pixels:

### 3.1 Arma — Mão Esquerda (MAIN_HAND)
*   **`idle`**:
    *   `south`: `[(58, 61), (58, 62), (58, 61), (58, 60)]`
    *   `north`: `[(40, 61), (40, 62), (40, 61), (40, 60)]`
    *   `east`: `[(44, 66), (44, 67), (44, 66), (44, 65)]`
    *   `west`: `[(49, 66), (49, 67), (49, 66), (49, 65)]`
*   **`walk`**:
    *   `south`: `[(58, 57), (57, 61), (58, 61), (58, 66)]`
    *   `north`: `[(40, 61), (41, 66), (40, 61), (40, 57)]`
    *   `east`: `[(44, 66), (40, 64), (44, 66), (58, 64)]`
    *   `west`: `[(49, 66), (58, 64), (49, 66), (40, 64)]`
*   **`attack`**:
    *   `south`: `[(64, 55), (53, 56), (64, 54)]`
    *   `north`: `[(37, 55), (42, 56), (37, 54)]`
    *   `east`: `[(44, 54), (51, 48), (49, 48)]`
    *   `west`: `[(51, 54), (41, 48), (43, 48)]`

### 3.2 Escudo — Mão Direita (OFF_HAND)
*   **`idle`**:
    *   `south`: `[(40, 61), (40, 62), (40, 61), (40, 60)]`
    *   `north`: `[(58, 61), (58, 62), (58, 61), (58, 60)]`
    *   `east`: `[(49, 66), (49, 67), (49, 66), (49, 65)]`
    *   `west`: `[(44, 66), (44, 67), (44, 66), (44, 65)]`
*   **`walk`**:
    *   `south`: `[(40, 61), (41, 66), (40, 61), (40, 57)]`
    *   `north`: `[(58, 57), (57, 61), (58, 61), (58, 66)]`
    *   `east`: `[(49, 66), (58, 64), (49, 66), (40, 64)]`
    *   `west`: `[(44, 66), (40, 64), (44, 66), (58, 64)]`
*   **`attack`**:
    *   `south`: `[(41, 54), (42, 49), (42, 49)]`
    *   `north`: `[(54, 54), (53, 49), (53, 49)]`
    *   `east`: `[(51, 54), (73, 44), (67, 44)]`
    *   `west`: `[(44, 54), (19, 44), (25, 44)]`

---

## 4. Algoritmo de Oclusão (Layering por Direção)
Dependendo da direção na qual o herói está olhando, a ordem de renderização é alterada para que as camadas se sobreponham fisicamente de forma correta:

```text
Se direção for "north" (De costas):
    Desenhar Escudo -> Desenhar Arma -> Desenhar Corpo -> Desenhar Cabelo

Se direção for "east" (Olhando para a direita):
    Desenhar Arma -> Desenhar Corpo -> Desenhar Cabelo -> Desenhar Escudo

Se direção for "west" (Olhando para a esquerda):
    Desenhar Escudo -> Desenhar Corpo -> Desenhar Cabelo -> Desenhar Arma

Qualquer outra direção ("south"):
    Desenhar Corpo -> Desenhar Cabelo -> Desenhar Escudo -> Desenhar Arma
```

---

## 5. Rotações Finais das Armas (MAIN_HAND)
Abaixo estão os ângulos de rotação (radianos) aplicados para alinhar e simular os golpes de ataque:
*   **North (`north`)**: Rotação base `-Math.PI / 2` (aponta para cima-esquerda). No ataque, **soma-se** `Math.PI / 4`, rotacionando a espada no sentido horário e fazendo-a apontar **reto para frente (norte)**, alcançando a visibilidade sobre a linha dos ombros do herói.
*   **South (`south`)**: Rotação base `0`. No ataque, soma-se `Math.PI / 4` (swing descendente/frontal).
*   **East (`east`)**: Rotação base `0`. No ataque, soma-se `Math.PI / 3` (slash descendente).
*   **West (`west`)**: Rotação base `-Math.PI / 2`. No ataque, subtrai-se `Math.PI / 3` (slash descendente).
