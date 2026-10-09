# Visualização escalável do VLI Diagram

## Objetivo

Criar, ler e editar processos com conforto, preservando a estrutura das etapas quando o volume cresce. A criação pelo Notion/MCP precisa entregar um diagrama legível e editável logo na primeira abertura.

Esta análise usa a captura enviada pelo usuário e o código de main em b5621f2. O preview do exemplo exige autenticação da Vercel neste ambiente. Os testes usam dados sintéticos; não houve leitura nem alteração do banco do usuário.

## Diagnóstico confirmado no código

1. O cálculo antigo usa ordenação topológica e deixa os ciclos sem tratamento. Um retorno pode manter várias etapas no nível zero e produzir uma linha enorme.
2. Etapas agrupadas usam níveis horizontais mesmo quando o Mermaid pede direção vertical. Etapas soltas seguem outra distribuição.
3. A largura das raias deriva do maior nível do fluxo inteiro, produzindo espaços desnecessários.
4. O roteador antigo avalia poucos trajetos para cada seta isoladamente. Ele pode escolher um trajeto com obstáculos quando todas as alternativas locais são ruins.
5. O botão de ajustar a tela apenas restaurava zoom e posição. O ajuste utilizado na importação tinha limite de 45%, insuficiente para mostrar diagramas extensos.
6. A roda do mouse sempre mudava o zoom, dificultando percorrer um fluxo longo em uma escala legível.

Quantidade de etapas, quantidade de conexões e tipos de relações precisam ser medidos juntos. Um fluxo de 50 etapas com retornos e cruzamentos pode exigir mais espaço e atenção que uma árvore de 150 etapas.

## Contrato das raias

Separar os significados antes de definir a apresentação:

| Estrutura | O que representa | Regra proposta |
| --- | --- | --- |
| Fase | Momento do processo, como Build ou Release | Ordem explícita, blocos sequenciais e foco por fase |
| Raia de responsabilidade | Equipe, pessoa ou sistema | Faixas paralelas, ordem estável e direção de processo compartilhada |
| Subprocesso | Um fluxo que pode ser aberto separadamente | Resumo, entrada, saída e acesso aos detalhes |

O MVP desta alteração trata os grupos Mermaid como containers de fluxo. Não identifica automaticamente se um grupo é fase ou responsável. O formato estruturado do MCP deve ganhar um campo explícito para essa distinção em uma etapa posterior.

Regras visuais:

- Cabeçalho com 176 px e conteúdo com margem inicial de 204 px, protegendo o título das etapas.
- Fases verticais separadas com a mesma borda esquerda e a mesma largura externa.
- Altura de cada fase calculada a partir do conteúdo, com espaço acima e abaixo.
- Relação explícita `laneId` para cada etapa, atualizada ao mover uma etapa entre raias.
- Conexões calculadas junto com o posicionamento das etapas, considerando grupos e retornos.
- A ordem dos grupos informada pela fonte participa do cálculo. Preservar prioridade explícita de grupos é requisito para o próximo formato MCP.
- Para raízes paralelas ou hierarquias aninhadas, não esticar backgrounds que causariam sobreposição. Esses casos precisam de política visual própria.

## Modos de visualização

Manter dois modos explícitos lado a lado: **Fluxo completo**, que apresenta todas as etapas e conexões no quadro, e **Visão por fases**, que apresenta resumos e acesso aos trechos. A alternância muda somente a apresentação. Ambos usam os mesmos dados e relações.

## Três níveis de leitura

| Nível | A pessoa precisa entender | Recursos |
| --- | --- | --- |
| Visão geral | Onde começa, quais fases existem e como se relacionam | Ajustar à tela, minimapa, resumo de fases |
| Trecho | O que acontece dentro de uma fase e suas transições | Foco na fase, recolher outras fases, destacar caminho |
| Etapa | Ação, condição, responsável e detalhes | Texto legível, painel de detalhes e acesso pelo teclado |

Mostrar todos os textos de um diagrama grande ao mesmo tempo pode exigir uma tela muito maior. A interface precisa alternar entre esses níveis sem perder dados ou a localização da pessoa.

## Primeira implementação preparada

- Substituição das coordenadas simples por ELK Layered 0.11.0, com rotas ortogonais, tratamento de ciclos, grupos e espaço para os textos das setas.
- Normalização das bordas e larguras de fases verticais quando suas faixas não se sobrepõem.
- Persistência das coordenadas e das rotas calculadas, com invalidação quando a geometria muda.
- Botão de ajuste calculado a partir dos limites do conteúdo, incluindo rotas; extensão dinâmica da área SVG.
- Controle 1:1 para ler a etapa selecionada ou o início da fase em foco.
- Foco por fase e minimapa clicável, mantendo os controles fora da escala do desenho.
- Visão por fases com cartões de resumo, contagens e ligações de saída; abrir etapas em escala de leitura com um clique. Abertura inicial nesse modo para fluxos agrupados com mais de 25 etapas.
- Rolagem para mover a tela; Ctrl/Cmd com rolagem para alterar zoom.
- Diálogo flexível, com altura limitada pela janela e rolagem interna, para a situação mostrada no Comet.
- Organização manual e desfazer, úteis durante os testes do produto. Não existe migração automática dos diagramas já convertidos.

## Próximas entregas, em ordem

1. **Recolher e expandir fases dentro do próprio desenho.** Complementar os cartões de resumo com containers recolhidos no canvas, incluindo grupos aninhados e rotas recalculadas para os blocos resumidos.
2. **Modelo explícito do processo no MCP.** Tipos de container, relação com a raia, ordem, entradas, saídas, decisões e retornos. Validar referências e oferecer uma prévia antes de aplicar alterações.
3. **Leitura assistida.** Busca de etapas, destaque de predecessores e sucessores, caminho principal e atalhos para ir à origem ou ao destino de uma conexão.
4. **Edição previsível.** Reorganizar apenas a fase afetada, fixar etapas que a pessoa posicionou e incluir undo/redo geral. Adicionar uma etapa deve preservar os locais que a pessoa já conhece.
5. **Desempenho.** Executar o cálculo em Worker, reduzir redesenhos, atualizar somente setas afetadas por uma mudança e ocultar elementos fora da área visível quando necessário. Medir antes de trocar a tecnologia de desenho.
6. **Compartilhamento profissional.** Leitor publicado com os mesmos recursos de foco, exportação SVG/PDF e compartilhamento por etapa ou fase.

## Critérios de aceitação

| Área | Critério |
| --- | --- |
| Integridade | Toda etapa e toda conexão da entrada continuam presentes após conversão |
| Geometria | Sem sobreposição de etapas, coordenadas finitas e etapas dentro dos containers |
| Raias | Mesma borda e largura para fases verticais sequenciais, com cabeçalho protegido |
| Conexões | Rotas ortogonais que não atravessam etapas nos cenários de teste; rótulos próximos da conexão correspondente |
| Retornos | Ciclos preservados, com percurso identificável |
| Leitura | Chegar a uma etapa em escala legível a partir da visão geral em até duas ações |
| Interface | Diálogo acessível em janela de 741 x 356; editor sem overflow da página em 390 x 700 |
| Escala | Casos de 50, 150 e 500 etapas, variando bifurcações, convergências, ciclos e conexões entre grupos |
| Desempenho | Registrar tempos de abertura, cálculo e interação em hardware definido; propor orçamento após essa medição |
| Navegadores | Teste no Chrome, Edge e Comet reais, incluindo zoom do navegador, janela pequena e painel lateral |

O teste em Chromium permite verificar uma base técnica compartilhada, mas não comprova o comportamento das versões comerciais nem das extensões e painéis de cada navegador.

## Referências e decisão técnica

- [ELK Layered](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html): layout por camadas, redução de cruzamentos, rotas ortogonais, grupos e conexões entre níveis.
- [ELK JavaScript](https://github.com/kieler/elkjs): integração do cálculo com JavaScript e suporte a Worker.
- [draw.io: containers](https://www.drawio.com/docs/manual/shapes/container-shapes/): recolher/expandir containers e relações entre elementos de containers diferentes.
- [yFiles: layout incremental](https://docs.yworks.com/yfiles-html/dguide/layout-incremental_layout/): preservar a localização dos elementos ao editar o grafo.
- [React Flow: desempenho](https://reactflow.dev/learn/advanced-use/performance): evitar renderizações desnecessárias, limitar a árvore visível e simplificar estilos de grafos grandes.

ELK foi escolhido para a primeira etapa porque pode ser integrado ao editor atual e calcula posições e rotas conjuntamente. O carregamento inicial ainda depende de CDN, e a edição manual utiliza o roteador anterior até uma nova organização. Esses pontos precisam ser tratados antes de afirmar que o produto suporta qualquer processo de grande porte.

## Posição de produto sugerida

Concentrar a primeira proposta comercial em transformar processos mantidos no Notion, por agentes ou Mermaid, em diagramas editáveis com boa leitura. A vantagem precisa ser demonstrada por quanto trabalho manual é evitado e pela facilidade de compreender e atualizar um fluxo.

A lista de funcionalidades deve crescer depois de consolidar essa experiência. Qualidade do layout, confiança nas alterações e conforto de leitura são os primeiros critérios para competir.
