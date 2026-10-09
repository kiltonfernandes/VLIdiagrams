# VLI Diagrams

Editor pessoal de diagramas e quadros visuais, feito para publicação estática no Vercel.

## Recursos nesta primeira versão

- Pastas e diagramas com criar, renomear, mover e excluir.
- Quadro com notas adesivas e formas editáveis, arrastáveis e redimensionáveis.
- Conectores com setas entre itens do quadro.
- Blocos Mermaid com edição de código e renderização ao vivo.
- Edição de Mermaid com renderização ao vivo usando a linha 11 do Mermaid.
- Zoom, pan, salvamento automático no navegador e link de visualização compartilhável.
- Interface em português, sem conexão com o Notion nesta etapa.

## Rodar localmente

Abra `index.html` em um navegador moderno ou rode um servidor estático na pasta do projeto.

O Mermaid é carregado do jsDelivr. A publicação precisa permitir essa requisição externa.

## Persistência

Os rascunhos ficam no `localStorage` do navegador atual. O link publicado carrega um retrato somente para leitura do quadro dentro do endereço compartilhado.

## Próximos passos

1. Criar o repositório `vli-diagrams` no GitHub e enviar os arquivos.
2. Importar o repositório no Vercel e publicar.
3. Depois, adicionar conexão com o Notion em Configurações.
