import { env } from 'cloudflare:workers';

const createProgressTable = `
  CREATE TABLE IF NOT EXISTS game_progress (
    client_id TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

function database() {
  return (env as unknown as { DB: D1Database }).DB;
}

function validClientId(value: string | null): value is string {
  return Boolean(value && /^[a-zA-Z0-9_-]{16,80}$/.test(value));
}

async function ensureSchema() {
  await database().prepare(createProgressTable).run();
}

export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get('clientId');
  if (!validClientId(clientId)) return Response.json({ error: 'Invalid client identifier.' }, { status: 400 });
  await ensureSchema();
  const row = await database().prepare('SELECT payload, updated_at FROM game_progress WHERE client_id = ?').bind(clientId).first<{ payload: string; updated_at: number }>();
  if (!row) return Response.json({ progress: null });
  try {
    return Response.json({ progress: JSON.parse(row.payload), updatedAt: row.updated_at });
  } catch {
    return Response.json({ progress: null });
  }
}

export async function PUT(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 100_000) return Response.json({ error: 'Progress payload is too large.' }, { status: 413 });
  const body = await request.json() as { clientId?: unknown; progress?: unknown };
  if (typeof body.clientId !== 'string' || !validClientId(body.clientId) || !body.progress || typeof body.progress !== 'object') {
    return Response.json({ error: 'Invalid progress payload.' }, { status: 400 });
  }
  const payload = JSON.stringify(body.progress);
  if (payload.length > 100_000) return Response.json({ error: 'Progress payload is too large.' }, { status: 413 });
  await ensureSchema();
  const now = Date.now();
  await database().prepare(`
    INSERT INTO game_progress (client_id, payload, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(client_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `).bind(body.clientId, payload, now, now).run();
  return Response.json({ saved: true, updatedAt: now });
}
