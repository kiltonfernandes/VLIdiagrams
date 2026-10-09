# Exportação de diagramas

## Aplicativo

Abrir o diagrama e escolher **Exportar**. Formatos: PNG e SVG. Conteúdo: diagrama completo, fase/raia ou visão geral por fases quando há grupos. Fundo: branco ou transparente. PNG permite 1×/2×; SVG conserva os elementos vetoriais. A exportação inclui textos, formas e conexões, sem controles de edição, seleção, minimapa ou grade.

O recorte é calculado a partir dos itens e rotas, sem depender da posição ou do zoom da tela. Uma fase contém apenas suas etapas e conexões internas. SVG usa texto nativo, sem `foreignObject`. Cartões Mermaid são renderizados com rótulos de texto, IDs de SVG próprios e verificação de recursos externos.

PNG é limitado a 8.192 pixels por eixo e 16 milhões de pixels. Quando necessário, a resolução é reduzida e o diálogo informa isso. SVG é indicado para processos extensos.

## MCP

Após o cliente atualizar a lista de ferramentas, chamar:

```json
{
  "name": "export_diagram",
  "arguments": {
    "diagram_id": "d1173396-66b6-4284-a042-53484d01450b",
    "format": "png",
    "scope": "full",
    "transparent": false,
    "quality": 2
  }
}
```

`format`: `png` ou `svg`. `scope`: `full`, `overview` ou ID de raia/fase. `quality`: 1 ou 2; somente PNG usa esse parâmetro. `transparent`: booleano.

O retorno possui `structuredContent` e texto com os mesmos metadados: ID, formato, nome do arquivo, dimensões, quantidade de bytes, ajuste de resolução, URL do arquivo e URL do app. PNG de até 2 MB inclui um bloco MCP `image` com base64. SVG inclui um recurso com o texto do arquivo vetorial. A exibição/anexação desses blocos depende do suporte do cliente MCP; no Notion, isso deve ser verificado após a implantação.

O servidor também exporta fluxogramas e sequências ainda salvos como código Mermaid, sem exigir a abertura do app. A conversão acontece em uma cópia e não altera o diagrama no Turso. Outros tipos Mermaid exigem a exportação pelo navegador nesta versão.

## HTTP

```
GET /api/export?diagram=ID&format=png&scope=full&quality=2&transparent=false
```

Aceita a sessão autenticada do VLI no navegador ou o cabeçalho `Authorization: Bearer ...` com a credencial MCP. A URL não contém credenciais e o arquivo não fica público. O agente recebe a imagem ou o SVG diretamente no retorno MCP; para acessar a URL HTTP por outro cliente, precisa enviar a autenticação.

Respostas: `200` arquivo; `400` formato/resolução inválidos; `401` sem acesso; `404` diagrama inexistente; `422` conteúdo sem suporte/erro de renderização; `413` PNG acima de 3 MB. A resposta de arquivo inclui Content-Type, Content-Disposition e Cache-Control privado sem cache. A fonte Noto Sans e sua licença OFL estão incluídas para manter os textos no PNG mesmo em servidores sem fontes instaladas.

Não há JPEG nesta entrega. PNG atende diagramas e transparência; SVG mantém a resolução vetorial.
