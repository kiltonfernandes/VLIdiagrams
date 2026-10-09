import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "vli_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

function secret() { return process.env.VLI_MCP_TOKEN || ""; }
function signature(expires) { return createHmac("sha256", secret()).update(expires).digest("hex"); }

export function validBearer(request) {
  const configured = secret();
  const provided = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  if (!configured || !provided) return false;
  const a = Buffer.from(configured);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function makeSessionCookie() {
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  return `${COOKIE_NAME}=${expires}.${signature(expires)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export function validSession(request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const [expires, supplied] = match[1].split(".");
  if (!expires || !supplied || Number(expires) <= Math.floor(Date.now() / 1000)) return false;
  const expected = signature(expires);
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
