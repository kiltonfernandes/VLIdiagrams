# Verificação da proposta de visualização

Executada em 9 de outubro de 2026, com dados sintéticos e sem acesso ao banco do usuário.

## Testes automatizados do cálculo

Comando: `npm test`.

Resultado: 4 testes passaram.

- 50, 150 e 500 etapas distribuídas em quatro fases, com bifurcação e retorno entre fases.
- IDs e entrada original preservados.
- Coordenadas finitas e etapas sem sobreposição.
- Etapas dentro de suas fases, com cabeçalho protegido.
- Fases verticais alinhadas e com a mesma largura externa.
- Todas as conexões presentes, ortogonais e sem atravessar outras etapas nesses cenários.
- Autoconexões, conexões paralelas e etapas desconectadas.
- Direções direita, esquerda, cima e baixo.
- Alterar a geometria invalida as rotas calculadas anteriormente.

Esses resultados cobrem os exemplos testados. A aplicação de constraints a grafos arbitrários exige uma coleção maior de casos reais antes de prometer suporte geral.

## Teste de interface

Navegador: Chromium 134.0.6998.35, headless, Linux.

O teste usou um servidor HTTP local com respostas de workspace fictício. Mermaid e ELK foram carregados dos endereços CDN usados pelo aplicativo.

Resultado:

- 50 formas, 51 conexões e quatro fases convertidas pelo fluxo real de abertura do aplicativo.
- Visão geral com quatro cartões de resumo.
- Abertura de uma fase em 100% de zoom.
- Rolagem altera a posição da tela e mantém o zoom.
- Organização e desfazer acessíveis.
- Modal de configurações dentro de uma janela de 741 x 356, com ações acessíveis após rolagem.
- Editor sem overflow horizontal da página em janela de 390 x 700.
- Nenhum erro de console ou de JavaScript registrado.
- Capturas de visão geral e leitura inspecionadas visualmente.

## Conferência pendente nos navegadores comerciais

Chrome, Edge e Comet em Windows, nas versões efetivamente usadas pelo usuário:

1. Criar um fluxo novo com quatro fases, 50 etapas, decisões e retornos.
2. Confirmar a visão geral, o foco na fase e a escala de leitura.
3. Abrir a engrenagem em janelas grandes e pequenas, com painel lateral aberto e fechado.
4. Repetir com zoom do navegador em 100%, 125% e 150%.
5. Conferir rolagem, Ctrl + rolagem, arrastar, cancelar um arraste e edição de textos.
6. Criar 150 e 500 etapas e registrar tempos no mesmo hardware.
7. Conferir novos fluxos com grupos paralelos, grupos aninhados e muitos retornos.

Este teste em Chromium não substitui a conferência nessas versões comerciais.
