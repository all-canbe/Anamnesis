import { type RecordMeta, type ContentRecord, type Visibility, type Attachment, CATEGORIES } from "./types";

export interface TursoConfig {
  url: string;
  token: string;
}

function safeParseAttachments(raw: any): Attachment[] {
  if (!raw || raw === "[]") return [];
  try { return JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)); } catch { return []; }
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

  // Convert libsql:// to https:// for HTTP API
  const httpUrl = config.url.replace(/^libsql:\/\//, "https://");

  const res = await fetch(httpUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ statements: [{ q: sql, params: args }] }),
  });

  if (!res.ok) {
    throw new Error(`Turso query failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data?.[0]?.results?.rows || [];
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
    user_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`;

  const createTags = `CREATE TABLE IF NOT EXISTS tags (
    key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'ai',
    color TEXT NOT NULL DEFAULT '#3b82f6'
  )`;

  const createSettings = `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`;

  await query(createRecords);
  await query(createTags);
  await query(createSettings);

  // 迁移：为旧表添加可能缺失的列（CREATE TABLE IF NOT EXISTS 不会修改已存在的表）
  try { await query("ALTER TABLE records ADD COLUMN user_id TEXT NOT NULL DEFAULT ''"); } catch {}
  try { await query("ALTER TABLE records ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))"); } catch {}
  try { await query("ALTER TABLE records ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))"); } catch {}

  // 迁移：将 user_id 为空的记录归属到 admin
  await query("UPDATE records SET user_id = 'admin' WHERE user_id = ''");

  // 迁移：增加 visibility 和 attachments 列
  let visibilityAdded = false;
  try {
    await query("ALTER TABLE records ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'");
    visibilityAdded = true;
  } catch {}
  try { await query("ALTER TABLE records ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]'"); } catch {}

  // 迁移：visibility 列首次创建时，将已有 admin 记录设为 public
  if (visibilityAdded) {
    await query("UPDATE records SET visibility = 'public' WHERE user_id = 'admin'");
  }

  // 迁移：tags 增加 user_id 和 is_public 列
  try { await query("ALTER TABLE tags ADD COLUMN user_id TEXT NOT NULL DEFAULT ''"); } catch {}
  try { await query("ALTER TABLE tags ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0"); } catch {}
  await query("UPDATE tags SET user_id = 'admin', is_public = 1 WHERE user_id = ''");
}

export async function tursoGetRecords(userId: string): Promise<RecordMeta[]> {
  const rows = await query(
    "SELECT id, slug, title, date, category, summary, format, visibility, attachments FROM records WHERE user_id = ? ORDER BY date DESC, id DESC",
    [userId]
  );
  return rows.map((row: any) => ({
    id: row[0], slug: row[1], title: row[2],
    date: row[3], category: row[4], summary: row[5], format: row[6],
    visibility: (row[7] || "private") as Visibility,
    attachments: safeParseAttachments(row[8]),
  }));
}

export async function tursoGetRecord(id: string, userId?: string): Promise<ContentRecord | null> {
  const rows = userId
    ? await query(
        "SELECT id, slug, title, date, category, summary, format, content, visibility, attachments FROM records WHERE id = ? AND user_id = ?",
        [id, userId]
      )
    : await query(
        "SELECT id, slug, title, date, category, summary, format, content, visibility, attachments FROM records WHERE id = ?",
        [id]
      );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    meta: {
      id: row[0], slug: row[1], title: row[2],
      date: row[3], category: row[4], summary: row[5], format: row[6],
      visibility: (row[8] || "private") as Visibility,
      attachments: safeParseAttachments(row[9]),
    },
    content: row[7],
  };
}

export async function tursoWriteRecord(meta: RecordMeta, content: string, userId: string): Promise<void> {
  const attachmentsJson = meta.attachments?.length ? JSON.stringify(meta.attachments) : "[]";
  await query(
    `INSERT INTO records (id, slug, title, date, category, summary, format, content, visibility, attachments, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       slug = excluded.slug,
       title = excluded.title,
       date = excluded.date,
       category = excluded.category,
       summary = excluded.summary,
       format = excluded.format,
       content = excluded.content,
       visibility = excluded.visibility,
       attachments = excluded.attachments,
       user_id = excluded.user_id,
       updated_at = datetime('now')`,
    [meta.id, meta.slug, meta.title, meta.date, meta.category, meta.summary, meta.format, content, meta.visibility || "private", attachmentsJson, userId]
  );
}

export async function tursoDeleteRecord(id: string, userId?: string): Promise<void> {
  if (userId) {
    await query("DELETE FROM records WHERE id = ? AND user_id = ?", [id, userId]);
  } else {
    await query("DELETE FROM records WHERE id = ?", [id]);
  }
}

export async function tursoGetTags(userId?: string): Promise<Record<string, { label: string; icon: string; color: string; isPublic?: boolean }>> {
  const rows = userId
    ? await query("SELECT key, label, icon, color, is_public FROM tags WHERE is_public = 1 OR user_id = ?", [userId])
    : await query("SELECT key, label, icon, color, is_public FROM tags WHERE is_public = 1");
  const tags: Record<string, { label: string; icon: string; color: string; isPublic?: boolean }> = {};
  for (const key of Object.keys(CATEGORIES)) {
    tags[key] = { label: CATEGORIES[key as keyof typeof CATEGORIES].label, icon: key, color: "#3b82f6", isPublic: true };
  }
  for (const row of rows) {
    tags[row[0]] = { label: row[1], icon: row[2] || row[0], color: row[3] || "#3b82f6", isPublic: !!row[4] };
  }
  return tags;
}

export async function tursoAddTag(key: string, label: string, icon: string, color = "#3b82f6", userId?: string): Promise<void> {
  await query(
    "INSERT INTO tags (key, label, icon, color, user_id, is_public) VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT(key) DO UPDATE SET label = excluded.label, icon = excluded.icon, color = excluded.color",
    [key, label, icon, color, userId || "admin"]
  );
}

export async function tursoDeleteTag(key: string, userId?: string): Promise<void> {
  if (key in CATEGORIES) return;
  if (userId) {
    await query("DELETE FROM tags WHERE key = ? AND user_id = ? AND is_public = 0", [key, userId]);
  } else {
    await query("DELETE FROM tags WHERE key = ?", [key]);
  }
}

export async function tursoGetPublicRecords(category?: string): Promise<RecordMeta[]> {
  const sql = category && category !== "all"
    ? "SELECT id, slug, title, date, category, summary, format, visibility, attachments FROM records WHERE visibility = 'public' AND category = ? ORDER BY date DESC, id DESC"
    : "SELECT id, slug, title, date, category, summary, format, visibility, attachments FROM records WHERE visibility = 'public' ORDER BY date DESC, id DESC";
  const params = category && category !== "all" ? [category] : [];
  const rows = await query(sql, params);
  return rows.map((row: any) => ({
    id: row[0], slug: row[1], title: row[2],
    date: row[3], category: row[4], summary: row[5], format: row[6],
    visibility: (row[7] || "public") as Visibility,
    attachments: safeParseAttachments(row[8]),
  }));
}

export function isTursoConfigured(): boolean {
  return !!(process.env.TURSO_DB_URL && process.env.TURSO_DB_TOKEN);
}

export async function getSetting(key: string, userId?: string): Promise<string | null> {
  const k = userId ? `${userId}:${key}` : key;
  const rows = await query("SELECT value FROM settings WHERE key = ?", [k]);
  if (rows.length === 0) return null;
  return rows[0][0] as string;
}

export async function setSetting(key: string, value: string, userId?: string): Promise<void> {
  const k = userId ? `${userId}:${key}` : key;
  await query(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [k, value]
  );
}
