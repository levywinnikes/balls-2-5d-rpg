# AGENTS.md — Regras para I.A

## REGRA FUNDAMENTAL: SEM SOLUÇÕES PALEATIVAS

Se você detectar um bug/problema, DEVE corrigir a causa raiz — nunca aplicar solução paliativa que mascare o problema real.

Exemplos do que NÃO fazer:
- Adicionar `if` especial pra um tile quando o bug está no `buildTileVolume`
- Aumentar constantes de tolerância pra esconder volume mal posicionado
- Criar callback `isDoorTile` quando a engine deveria tratar entidades naturalmente

Sempre pergunte: "a causa raiz está no core/engine?" Se sim, corrija o core/engine.

---

## ROTINA DE TRABALHO — EXECUTAR SEMPRE NESTA ORDEM

### 1. ENTENDER ANTES DE MEXER
- Leia o código afetado e TODAS as suas dependências
- Trace o fluxo completo (entrada → processamento → saída)
- Identifique TODOS os efeitos colaterais antes de alterar qualquer linha
- Se não entender completamente, **documente o que falta entender** — não mexa

### 2. DOCUMENTAR ANTES DE ALTERAR
- Se não há documentação do sistema afetado, crie-a PRIMEIRO
- Use `ARCHITECTURE.md` como template
- Descreva: o que faz, como faz, por que faz assim
- Só altere código DEPOIS de documentar

### 3. UMA MUDANÇA POR VEZ
- Cada commit = UMA alteração lógica
- Teste após cada commit (`npm test` + build)
- Nunca empilhar múltiplas alterações não relacionadas
- Se quebrou, **reverta imediatamente** e entenda por que

### 4. TESTAR ANTES DE COMMITAR
- `npx tsc --noEmit` — zero erros de tipo
- `npm test` — todos os testes passando
- Se possível, build e teste visual
- Se não puder testar visualmente, **não commite mudanças visuais**

### 5. PROIBIDO
- ❌ `as any` exceto quando estritamente necessário e documentado
- ❌ Mudar constante sem rastrear TODOS os usos
- ❌ Adicionar flag/parâmetro só pra um caso específico
- ❌ "Vou testar depois" — testa AGORA ou não commita
- ❌ Mais de 3 tentativas no mesmo bug sem pausa para reavaliar

---

## MÉTRICA DE SUCESSO

Não é "funcionou". É:
1. Código mais simples do que antes
2. Zero novos `as any`
3. Zero novas constantes mágicas
4. Zero novos acoplamentos entre sistemas
5. Testes passando
6. Documentação atualizada

---

## LIÇÕES APRENDIDAS (NUNCA ESQUECER)

1. **Porta levou 8 horas.** Causa: múltiplos sistemas (tile, chunk, collision) sem coordenação. Tentativas de "fix" com `isDoorTile`, `invalidateTile`, `renderingGroupId` — todas revertidas. A solução foi apenas adicionar `isTileBlockedForGameplay` no `blocked()` — 1 linha.

2. **Constantes fantasmas.** `LEVEL_HEIGHT = 4` em 3 lugares diferentes do canônico `2.0`. Causou dano de queda errado por meses. Resolver com import centralizado — mas só depois de entender cada uso.

3. **`FLOOR_THICKNESS` mudança quebrou tudo.** Aumentar de 0.32 → 0.5 mudou colisão, geometria, posição de objetos. Revertido. Constantes existem por um motivo — entenda antes de mudar.
