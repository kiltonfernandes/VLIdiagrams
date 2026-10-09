import { validSession } from "../lib/auth.js";
import { readWorkspace, writeWorkspace } from "../lib/workspace.js";

export default { async fetch(request) {
  if (!validSession(request)) return Response.json({ error: "Faça login para acessar seus diagramas." }, { status: 401 });
  try {
    if (request.method === "GET") return Response.json(await readWorkspace());
    if (request.method === "PUT") {
      let state;
      try { state = await request.json(); } catch { return Response.json({ error: "O conteúdo enviado não é JSON válido." }, { status: 400 }); }
      return Response.json(await writeWorkspace(state));
    }
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, PUT" } });
  } catch (error) {
    console.error("VLI workspace API error:", error);
    return Response.json({ error: "Não foi possível acessar o banco de dados." }, { status: 500 });
  }
} };
