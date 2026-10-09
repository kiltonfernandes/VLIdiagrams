import { createClient } from "@libsql/client";

const initialState = { folders: [], diagrams: [], activeDiagramId: null };
let dbClient;
let setupPromise;

export function getDb() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN precisam estar configuradas.");
  }
  dbClient ||= createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  return dbClient;
}

function normalizeState(value) {
  if (!value || typeof value !== "object") return structuredClone(initialState);
  return {
    folders: Array.isArray(value.folders) ? value.folders : [],
    diagrams: Array.isArray(value.diagrams) ? value.diagrams : [],
    activeDiagramId: typeof value.activeDiagramId === "string" ? value.activeDiagramId : null
  };
}

async function ensureTable() {
  if (!setupPromise) setupPromise = getDb().execute(`CREATE TABLE IF NOT EXISTS vli_workspace (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await setupPromise;
}

export async function readWorkspace() {
  await ensureTable();
  const result = await getDb().execute({ sql: "SELECT state_json FROM vli_workspace WHERE id = 1", args: [] });
  if (!result.rows.length) return structuredClone(initialState);
  try { return normalizeState(JSON.parse(String(result.rows[0].state_json))); }
  catch { return structuredClone(initialState); }
}

export async function writeWorkspace(value) {
  await ensureTable();
  const state = normalizeState(value);
  await getDb().execute({
    sql: `INSERT INTO vli_workspace (id, state_json, updated_at) VALUES (1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
    args: [JSON.stringify(state), new Date().toISOString()]
  });
  return state;
}

export function hasWorkspaceData(state) {
  return Boolean(state?.folders?.length || state?.diagrams?.length);
}
