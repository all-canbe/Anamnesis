import { type RecordMeta, type ContentRecord, CATEGORIES } from "./types";

export interface TursoConfig {
  url: string;
  token: string;
}

function getConfig(): TursoConfig | null {
  const url = process.env.TURSO_DB_URL || "";
  const token = process.env.TURSO_DB_TOKEN || "";
  if (url && token) return { url, token };
  return null;
}

async function query(sql: string, args: any[] = []): Promise<any[]> {
  const config = getConfig();
  if (!config) throw new Error("Turso not configured");

  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ statements: [{ q: sql, params: { ...args } }] }),
  });

  if (!res.ok) {
    throw new Error(`Turso query failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data?.results?.[0]?.response?.result?.rows || [];
}

export async function initTursoSchema(): Promise<void> {
  const createRecords = `CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'reading',
    summary TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT 'md',
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`;

  const createTags = `CREATE TABLE IF NOT EXISTS tags (
    key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'ai'
  )`;

  await query(createRecords);
  await query(createTags);
}

export async function tursoGetRecords(): Promise<RecordMeta[]> {
  const rows = await query(
    "SELECT id, slug, title, date, category, summary, format FROM records ORDER BY date DESC, id DESC"
  );
  return rows.map((row: any) => ({
    id: row[0],
    slug: row[1],
    title: row[2],
    date: row[3],
    category: row[4],
    summary: row[5],
    format: row[6],
  }));
}

export async function tursoGetRecord(id: string): Promise<ContentRecord | null> {
  const rows = await query(
    "SELECT id, slug, title, date, category, summary, format, content FROM records WHERE id = ?",
    [id]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    meta: {
      id: row[0], slug: row[1], title: row[2],
      date: row[3], category: row[4], summary: row[5], format: row[6],
    },
    content: row[7],
  };
}

export async function tursoWriteRecord(meta: RecordMeta, content: string): Promise<void> {
  await query(
    `INSERT INTO records (id, slug, title, date, category, summary, format, content)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       slug = excluded.slug,
       title = excluded.title,
       date = excluded.date,
       category = excluded.category,
       summary = excluded.summary,
       format = excluded.format,
       content = excluded.content,
       updated_at = datetime('now')`,
    [meta.id, meta.slug, meta.title, meta.date, meta.category, meta.summary, meta.format, content]
  );
}

export async function tursoDeleteRecord(id: string): Promise<void> {
  await query("DELETE FROM records WHERE id = ?", [id]);
}

export async function tursoGetTags(): Promise<Record<string, { label: string; icon: string }>> {
  const rows = await query("SELECT key, label, icon FROM tags");
  const tags: Record<string, { label: string; icon: string }> = {};
  for (const key of Object.keys(CATEGORIES)) {
    tags[key] = { label: CATEGORIES[key as keyof typeof CATEGORIES].label, icon: key };
  }
  for (const row of rows) {
    tags[row[0]] = { label: row[1], icon: row[2] || row[0] };
  }
  return tags;
}

export async function tursoAddTag(key: string, label: string, icon: string): Promise<void> {
  await query(
    "INSERT INTO tags (key, label, icon) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET label = excluded.label, icon = excluded.icon",
    [key, label, icon]
  );
}

export async function tursoDeleteTag(key: string): Promise<void> {
  if (key in CATEGORIES) return;
  await query("DELETE FROM tags WHERE key = ?", [key]);
}

export function isTursoConfigured(): boolean {
  return !!(process.env.TURSO_DB_URL && process.env.TURSO_DB_TOKEN);
}
