# AGENTS.md — Regras para I.A

## REGRA FUNDAMENTAL: SEM SOLUÇÕES PALEATIVAS EM ERROS DE CORE/ENGINE

Se você detectar que um bug ou problema é causado por um erro no core da engine (CollisionWorld, sistema de volumes, query de piso/teto, física da cápsula, transição de níveis, chunk streaming, etc.), você DEVE corrigir a causa raiz no core — nunca aplicar uma solução paliativa (workaround, patch superficial, flag de escape, tratamento especial para um caso específico) que mascare o problema real.

Exemplos do que NÃO fazer:
- Adicionar uma checagem extra em `isWorldPositionBlocked` para um tile específico quando o bug está no `buildTileVolume` que não gerou o volume correto
- Colocar um `if` especial para um tipo de tile no movimento do jogador quando a física de colisão deveria resolver
- Aumentar constantes de clearance/tolerância para esconder um volume mal posicionado

Sempre pergunte: "a causa raiz está no core/engine?" Se sim, corrija o core/engine.
