# VLI Diagrams

Editor pessoal de diagramas e quadros visuais, publicado no Vercel com persistência no Turso.

## Recursos

- Biblioteca pessoal com pastas e diagramas: criar, renomear, mover e excluir.
- Editor visual com notas adesivas, formas de processo editáveis e redimensionáveis, conectores com setas e raias horizontais.
- Raias com nome editável, altura ajustável e organização de etapas por área, equipe ou responsável.
- Formas para passo, decisão, início/fim, entrada/saída, documento, armazenamento de dados e subprocesso.
- Botões de adição nas quatro laterais das formas para criar uma etapa conectada automaticamente.
- Blocos Mermaid com prévia ao vivo e renderização via Mermaid 11+.
- Importação de Mermaid `flowchart`, `graph` e `swimlane` como formas, raias e conectores editáveis.
- Zoom, pan, salvamento automático no Turso e link de visualização compartilhável.
- Interface em português com diálogos próprios para ações de biblioteca e do quadro.

## Executar

Instale as dependências com `npm install`. Configure `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` e `VLI_MCP_TOKEN` no Vercel e publique a aplicação. O Mermaid 11 é carregado do jsDelivr, então o navegador precisa acessar essa CDN.

## Persistência e publicação

Pastas e diagramas ficam em uma linha JSON no Turso. A primeira abertura copia os dados locais deste navegador para o banco quando ele ainda estiver vazio. O editor usa uma sessão privada com cookie HttpOnly após você entrar com `VLI_MCP_TOKEN`. Um link publicado contém um retrato do quadro em modo de leitura dentro do próprio endereço. Qualquer pessoa com o link pode visualizar o conteúdo incluído nele.

## Servidor MCP para o Notion\n\nO endpoint HTTP está em `/api/mcp` e exige `Authorization: Bearer <VLI_MCP_TOKEN>`. As ferramentas permitem listar, criar, renomear, mover e excluir pastas e diagramas, além de criar ou atualizar um diagrama com código Mermaid. O primeiro acesso ao banco cria automaticamente a tabela `vli_workspace`.\n

