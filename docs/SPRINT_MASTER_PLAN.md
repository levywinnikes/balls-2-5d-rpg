# Sprint Master Plan - Grande Versao Funcional

## Objetivo Macro

Entregar uma grande versao funcional de RPG mundo aberto continuo (leve), sem loadings de tela e sem teleporte perceptivel, com cidade suspensa inicial, esgoto subterraneo com ratos, biomas amplos, ilhas, dungeons, cavernas e torres.

## Regras de Execucao

1. Cada sprint deve fechar com build jogavel e estado atualizado em `docs/SPRINT_STATE.json`.
2. Cada tarefa concluida deve atualizar o campo `lastCompletedTask` e `progressNotes`.
3. O inicio de qualquer nova sessao deve ler primeiro `docs/SPRINT_STATE.json`.
4. Escopo por sprint e fixo; novas ideias vao para backlog futuro.
5. Ao fechar cada sprint, criar commit no Git automaticamente com mensagem padrao `sprint-<N>: <nome> closed`.

## Horizonte e Cadencia

- Duracao por sprint: 2 semanas
- Horizonte total: 22 sprints (44 semanas)
- Meta tecnica de performance: minimo estavel de 45 FPS

## Sprint Roadmap

1. Sprint 1 - Streaming continuo base (budget por tick, fila/prioridade de chunks, picos de frame)
2. Sprint 2 - Persistencia por setor (estado de inimigos, loot, interacoes)
3. Sprint 3 - Navegacao vertical continua (escadas fisicas sem salto seco)
4. Sprint 4 - Cidade suspensa inicial v1
5. Sprint 5 - Esgoto v1 com ratos tipo A/B e mini-boss
6. Sprint 6 - Paridade de combate 2D -> 3D (nucleo)
7. Sprint 7 - Feedback de combate completo (VFX/audio/floating text)
8. Sprint 8 - Runas simples v1
9. Sprint 9 - Runas simples v2 (8 runas)
10. Sprint 10 - Biomas 1 e 2 completos
11. Sprint 11 - Biomas 3 e 4 completos
12. Sprint 12 - Biomas 5 e 6 completos
13. Sprint 13 - Ilhas v1 (3 ilhas)
14. Sprint 14 - Dungeons terreo v1
15. Sprint 15 - Dungeons subterraneas v1 (14+ total)
16. Sprint 16 - Torres v1 (3)
17. Sprint 17 - Torres v2 (6 total)
18. Sprint 18 - Boss hunts de mundo
19. Sprint 19 - Economia parcial avancada (crafting + preco regional)
20. Sprint 20 - Campanha principal (narrativa media)
21. Sprint 21 - Otimizacao pesada (45 FPS estavel)
22. Sprint 22 - Polimento final e freeze de release

## Sprint 7 - Escopo Detalhado

Objetivo: feedback visual e auditivo completo no modo 3D first-person — o jogador sempre sabe o que acontece com ele e com os inimigos.

Backlog Sprint 7:

1. **FP-Crosshair**: Ponto branco (mira) centralizado no modo first-person (CSS/canvas overlay, sem impacto em 2D).
2. **FP-DamageHud**: Coração de dano animado proximo ao HUD de vida quando jogador recebe hit no modo FP.
3. **FP-FloatingDmgEnemy**: Posição do floating text de dano do inimigo projetada corretamente no modo first-person (raycasting/world-to-screen).
4. **FP-EnemyHighlight**: Substituir circulo de selecao de inimigo por efeito de piscar levemente em vermelho no mesh do inimigo selecionado.
5. **FP-CameraHeight**: Avaliar e ajustar altura da camera no modo first-person — testar posição mais baixa (altura de olhos reais, ~0.6 do corpo) para melhor perspectiva de profundidade, comparando com jogos de referencia (ex: Daggerfall, Morrowind).
6. Floating text de cura e XP tambem visiveis no modo FP.
7. Audio hits sincronizados com animacao de dano.

Criterios de aceite Sprint 7:

1. Mira aparece apenas em modo FP, desaparece ao sair.
2. Coração de dano anima perto do HUD de vida e nao obstrui gameplay.
3. Damage numbers aparecem em posicao plausivel no espaco 3D (projetados).
4. Inimigo selecionado pisca vermelho suavemente, sem artefato de circulo.
5. Camera em posicao avaliada e documentada com comentario no codigo.
6. tsc --noEmit sem erros.

## Definition of Done da Grande Versao

1. Cidade suspensa + esgoto jogavel fim-a-fim.
2. Seis biomas completos e tres ilhas conectadas.
3. Quatorze ou mais dungeons e seis torres.
4. Oito runas simples totalmente funcionais no 3D.
5. Economia parcial avancada funcionando.
6. Mundo continuo sem loading de tela e sem teleporte perceptivel.
7. Meta de 45 FPS estavel validada no cenario de carga.

## Sprint 1 - Escopo Detalhado

Objetivo: consolidar a base de streaming continuo no runtime 3D.

Backlog Sprint 1:

1. Introduzir budget maximo de construcao de chunks por tick.
2. Priorizar chunks mais proximos ao jogador.
3. Evitar burst de carga em update unico.
4. Expor metricas basicas de streaming (debug interno).
5. Validar estabilidade sem regressao visual.

Criterios de aceite Sprint 1:

1. Chunk update respeita limite de carga por tick.
2. Picos de frame reduzidos em deslocamento rapido.
3. Nenhuma regressao de renderizacao de mapa ou colisao.
4. Build compilando.

## Backlog Consolidado (Issues 2026-04-21)

Objetivo: garantir rastreabilidade de todas as issues reportadas pelo usuario durante os testes de paridade 2D->3D.

Sprint 9 (interacao e leitura de cena no 3D):

1. Escadas/buracos do esgoto: transicao somente por clique direito quando o heroi estiver proximo (remover loop automatico de sobe/desce).
2. Ocultar entidades de andares superiores quando o andar acima estiver oculto para o jogador atual.
3. Corrigir menus de acao rapida no modo 3D que estao sem resposta (itens destacados no screenshot).

Sprint 10 (paridade de combate/sobrevivencia):

1. Sistema de comida no 3D exatamente igual ao 2D.
2. Formula de defesa no 3D igual ao 2D: composicao de equipamento + reflexo conforme implementacao canonica.
3. Tocha equipavel em mao ou escudo; quando no escudo nao soma ataque.
4. Ataque desarmado ajustado para faixa 1..5 e alcance levemente menor que espada de madeira.

Sprint 11 (paridade de magia e feedback visual):

1. Grimorio no 3D com mesmo fluxo do 2D (menu proprio, selecao de runa e disparo no inimigo).
2. Altar de runas com mesmo fluxo de criacao do 2D.
3. Sistema de sangue e overdamage igual ao 2D.
4. Adaptacao temporaria de sprites 2D para heroi/inimigos no 3D via billboarding, ate substituicao artistica definitiva.
