import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { validBearer } from "../lib/auth.js";
import { readWorkspace, writeWorkspace } from "../lib/workspace.js";

function makeHandler(appOrigin) {
  const diagramUrl = (diagramId) => new URL(`/?diagram=${encodeURIComponent(diagramId)}`, appOrigin).toString();
  return createMcpHandler(() => {
  const server = new McpServer({ name: "vli-diagrams", version: "1.0.0" });
  const text = (value) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
  const makeId = () => crypto.randomUUID();

  server.registerTool("list_folders", { description: "Lista as pastas do espaço de trabalho VLI.", inputSchema: z.object({}) }, async () => text((await readWorkspace()).folders));
  server.registerTool("create_folder", {
    description: "Cria uma pasta no espaço VLI.", inputSchema: z.object({ name: z.string().min(1).max(100) })
  }, async ({ name }) => {
    const state = await readWorkspace(); const folder = { id: makeId(), name: name.trim() };
    state.folders.push(folder); await writeWorkspace(state); return text(folder);
  });
  server.registerTool("rename_folder", {
    description: "Renomeia uma pasta pelo ID.", inputSchema: z.object({ folder_id: z.string(), name: z.string().min(1).max(100) })
  }, async ({ folder_id, name }) => {
    const state = await readWorkspace(); const folder = state.folders.find(item => item.id === folder_id);
    if (!folder) return text("Pasta não encontrada."); folder.name = name.trim(); await writeWorkspace(state); return text(folder);
  });
  server.registerTool("delete_folder", {
    description: "Exclui uma pasta. Os diagramas dela ficam sem pasta.", inputSchema: z.object({ folder_id: z.string() })
  }, async ({ folder_id }) => {
    const state = await readWorkspace(); state.folders = state.folders.filter(item => item.id !== folder_id);
    state.diagrams.forEach(diagram => { if (diagram.folderId === folder_id) diagram.folderId = null; });
    await writeWorkspace(state); return text("Pasta excluída; diagramas preservados.");
  });
  server.registerTool("list_diagrams", {
    description: "Lista os diagramas, com IDs, pasta e data de atualização.", inputSchema: z.object({ folder_id: z.string().optional() })
  }, async ({ folder_id }) => {
    const state = await readWorkspace();
    return text(state.diagrams.filter(item => !folder_id || item.folderId === folder_id).map(({ id, title, folderId, updatedAt, createdAt }) => ({ id, title, folderId, updatedAt, createdAt, url: diagramUrl(id) })));
  });
  server.registerTool("get_diagram", {
    description: "Lê um diagrama completo pelo ID, incluindo suas formas, conectores e código Mermaid.", inputSchema: z.object({ diagram_id: z.string() })
  }, async ({ diagram_id }) => {
    const diagram = (await readWorkspace()).diagrams.find(item => item.id === diagram_id);
    return text(diagram ? { ...diagram, url: diagramUrl(diagram.id) } : "Diagrama não encontrado.");
  });
  server.registerTool("create_diagram", {
    description: "Cria um diagrama vazio em uma pasta opcional.", inputSchema: z.object({ title: z.string().min(1).max(160), folder_id: z.string().optional() })
  }, async ({ title, folder_id }) => {
    const state = await readWorkspace();
    if (folder_id && !state.folders.some(item => item.id === folder_id)) return text("Pasta não encontrada.");
    const now = Date.now(); const diagram = { id: makeId(), title: title.trim(), folderId: folder_id || null, elements: [], theme: "default", createdAt: now, updatedAt: now };
    state.diagrams.unshift(diagram); await writeWorkspace(state); return text({ ...diagram, url: diagramUrl(diagram.id) });
  });
  server.registerTool("create_diagram_from_mermaid", {
    description: "Cria um diagrama VLI a partir do código Mermaid. Fluxogramas são convertidos automaticamente em formas, raias e conectores editáveis na próxima abertura do VLI; outros tipos permanecem renderizados como Mermaid.",
    inputSchema: z.object({ title: z.string().min(1).max(160), mermaid: z.string().min(1).max(50000), folder_id: z.string().optional() })
  }, async ({ title, mermaid, folder_id }) => {
    const state = await readWorkspace();
    if (folder_id && !state.folders.some(item => item.id === folder_id)) return text("Pasta não encontrada.");
    const now = Date.now(); const id = makeId();
    const diagram = { id, title: title.trim(), folderId: folder_id || null, elements: [{ id: makeId(), type: "mermaid", title: title.trim(), code: mermaid, convertOnLoad: true, x: 120, y: 120, width: 720, height: 460 }], sourceMermaid: mermaid, createdAt: now, updatedAt: now };
    state.diagrams.unshift(diagram); await writeWorkspace(state); return text({ id, title: diagram.title, folderId: diagram.folderId, url: diagramUrl(id), message: "Diagrama salvo no VLI." });
  });
  server.registerTool("update_diagram_from_mermaid", {
    description: "Atualiza o código Mermaid de um diagrama VLI e o deixa renderizado como conteúdo principal do quadro.",
    inputSchema: z.object({ diagram_id: z.string(), mermaid: z.string().min(1).max(50000), title: z.string().max(160).optional() })
  }, async ({ diagram_id, mermaid, title }) => {
    const state = await readWorkspace(); const diagram = state.diagrams.find(item => item.id === diagram_id);
    if (!diagram) return text("Diagrama não encontrado.");
    diagram.title = title?.trim() || diagram.title; diagram.elements = [{ id: makeId(), type: "mermaid", title: diagram.title, code: mermaid, convertOnLoad: true, x: 120, y: 120, width: 720, height: 460 }]; diagram.sourceMermaid = mermaid; diagram.updatedAt = Date.now();
    await writeWorkspace(state); return text({ id: diagram.id, title: diagram.title, url: diagramUrl(diagram.id), message: "Código Mermaid atualizado." });
  });
  server.registerTool("rename_diagram", {
    description: "Renomeia um diagrama pelo ID.", inputSchema: z.object({ diagram_id: z.string(), title: z.string().min(1).max(160) })
  }, async ({ diagram_id, title }) => {
    const state = await readWorkspace(); const diagram = state.diagrams.find(item => item.id === diagram_id);
    if (!diagram) return text("Diagrama não encontrado."); diagram.title = title.trim(); diagram.updatedAt = Date.now(); await writeWorkspace(state); return text({ ...diagram, url: diagramUrl(diagram.id) });
  });
  server.registerTool("move_diagram", {
    description: "Move um diagrama para uma pasta, ou para Sem pasta se folder_id for nulo.", inputSchema: z.object({ diagram_id: z.string(), folder_id: z.string().nullable() })
  }, async ({ diagram_id, folder_id }) => {
    const state = await readWorkspace(); const diagram = state.diagrams.find(item => item.id === diagram_id);
    if (!diagram) return text("Diagrama não encontrado.");
    if (folder_id && !state.folders.some(item => item.id === folder_id)) return text("Pasta não encontrada.");
    diagram.folderId = folder_id; diagram.updatedAt = Date.now(); await writeWorkspace(state); return text({ ...diagram, url: diagramUrl(diagram.id) });
  });
  server.registerTool("delete_diagram", {
    description: "Exclui um diagrama pelo ID.", inputSchema: z.object({ diagram_id: z.string() })
  }, async ({ diagram_id }) => {
    const state = await readWorkspace(); const before = state.diagrams.length; state.diagrams = state.diagrams.filter(item => item.id !== diagram_id);
    if (state.diagrams.length === before) return text("Diagrama não encontrado."); await writeWorkspace(state); return text("Diagrama excluído.");
  });
  return server;
  }, { responseMode: "json" });
}

export default { async fetch(request) {
  if (!validBearer(request)) return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  return makeHandler(new URL(request.url).origin).fetch(request, { authInfo: { token: "vli-mcp-token", clientId: "notion-agent", scopes: [] } });
} };
