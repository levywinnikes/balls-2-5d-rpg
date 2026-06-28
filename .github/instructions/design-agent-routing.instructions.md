---
applyTo: "**"
description: "Roteamento automatico para agentes especialistas de design quando o usuario mencionar casas, dungeon, cidade, mundo, mapa, bioma, layout, lore, armadilha ou geracao de mapa."
---

# Roteamento de Especialistas de Design

Quando o pedido do usuario envolver temas de design espacial/arquitetonico, acione automaticamente os agentes especialistas abaixo antes de implementar.

## Regras de acionamento

- Pedido amplo de design, reorganizacao de projeto, criacao de mapa do zero, ou duvida sobre qual especialista usar:
  - Invocar Design Orchestrator primeiro.
- Mapa mundi global, macro layout mundial, distribuicao continental/regional:
  - Invocar Global Map Design Lead primeiro.
- Casas, telhado, fachada, interior, planta, sobrado, residencia:
  - Invocar House Tech Lead.
- Cidade, bairro, distrito, praca, avenida, urbanismo:
  - Invocar City Design Lead.
- Dungeon, calabouco, labirinto, sala de boss, segredo, lore, armadilha:
  - Invocar Dungeon Design Lead.
- Mundo, bioma, ilha, caverna natural, litoral, distribuicao regional:
  - Invocar World Design Lead.
- Geracao de mapa, novo recurso para mapa, mudanca estrutural em gerador:
  - Invocar Map Generation Gatekeeper para Go/No-Go antes da execucao.

## Politica de qualidade

- Nao seguir direto para implementacao quando houver duvidas de design.
- Exigir pelo menos 2 variantes criativas quando o usuario pedir algo novo.
- Identificar explicitamente recursos faltantes e propor backlog tecnico.
- Priorizar resultado nao repetitivo e coerente com os contratos do projeto.
- Barrar propostas simples, artificiais, "quadradas" ou sem profundidade de worldbuilding.

## Fluxo obrigatorio (ordem fixa)

Quando o pedido envolver geracao de mapa novo, mudanca estrutural ampla, ou novos recursos para o pipeline, seguir esta ordem:

1. Global Map Design Lead (quando for mapa mundi/global)
2. World Design Lead
3. City Design Lead (quando houver area urbana)
4. House Tech Lead (quando houver residencias)
5. Dungeon Design Lead (quando houver dungeon)
6. Map Generation Gatekeeper (Go/No-Go final)

## Regra de bloqueio

- Se qualquer especialista devolver bloqueio tecnico ou criativo critico, nao executar geracao.
- Consolidar os bloqueios em backlog de requisitos.
- So retomar execucao apos Gatekeeper devolver Go.
