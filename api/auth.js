import { makeSessionCookie, validBearer, validSession, clearSessionCookie } from "../lib/auth.js";

export default { async fetch(request) {
  if (request.method === "GET") {
    return Response.json({ authenticated: validSession(request) });
  }
  if (request.method === "DELETE") {
    return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie() } });
  }
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Pedido inválido." }, { status: 400 }); }
  const authRequest = new Request(request.url, { headers: { authorization: `Bearer ${String(body?.token || "")}` } });
  if (!validBearer(authRequest)) return Response.json({ error: "Chave inválida." }, { status: 401 });
  return Response.json({ authenticated: true }, { headers: { "Set-Cookie": makeSessionCookie() } });
} };
