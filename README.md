# VLI Diagrams

Editor pessoal de diagramas e quadros visuais, publicado como aplicação estática no Vercel.

## Recursos

- Biblioteca pessoal com pastas e diagramas: criar, renomear, mover e excluir.
- Editor visual com notas adesivas, formas de processo editáveis e redimensionáveis, conectores com setas e raias horizontais.
- Raias com nome editável, altura ajustável e organização de etapas por área, equipe ou responsável.
- Formas para passo, decisão, início/fim, entrada/saída, documento, armazenamento de dados e subprocesso.
- Botões de adição nas quatro laterais das formas para criar uma etapa conectada automaticamente.
- Blocos Mermaid com prévia ao vivo e renderização via Mermaid 11+.
- Importação de Mermaid `flowchart`, `graph` e `swimlane` como formas, raias e conectores editáveis.
- Zoom, pan, salvamento automático no navegador e link de visualização compartilhável.
- Interface em português com diálogos próprios para ações de biblioteca e do quadro.

## Executar

Abra `index.html` em um navegador moderno ou inicie um servidor estático na pasta. O Mermaid 11 é carregado do jsDelivr, então o navegador precisa acessar essa CDN.

## Persistência e publicação

Os rascunhos ficam no `localStorage` do navegador atual. Um link publicado contém um retrato do quadro em modo de leitura dentro do próprio endereço. Qualquer pessoa com o link pode visualizar o conteúdo incluído nele.

A integração com o Notion ainda não está implementada. Ela será planejada como uma etapa posterior, em Configurações.
