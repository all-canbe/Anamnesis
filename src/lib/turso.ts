import { type RecordMeta, type ContentRecord, type Visibility, type Attachment } from "./types";

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

export async function query(sql: string, args: any[] = []): Promise<any[]> {
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
  // Turso HTTP API 在 SQL 错误时仍返回 200，错误信息在响应体中
  const result = data?.[0];
  if (result?.error) {
    throw new Error(`Turso query error: ${result.error.message || JSON.stringify(result.error)}`);
  }
  return result?.results?.rows || [];
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
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'ai',
    color TEXT NOT NULL DEFAULT '#3b82f6',
    user_id TEXT NOT NULL DEFAULT '',
    is_public INTEGER NOT NULL DEFAULT 0,
    is_category INTEGER NOT NULL DEFAULT 0,
    label_en TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (key, user_id)
  )`;

  const createSettings = `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`;

  const createUsers = `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`;

  const createVerificationCodes = `CREATE TABLE IF NOT EXISTS verification_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  )`;

  const createRateLimits = `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    reset_at TEXT NOT NULL
  )`;

  await query(createRecords);
  await query(createTags);
  await query(createSettings);
  await query(createUsers);
  await query(createVerificationCodes);
  await query(createRateLimits);

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

  // 迁移：tags 增加 is_category 和 label_en 列（动态分类系统）
  try { await query("ALTER TABLE tags ADD COLUMN is_category INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { await query("ALTER TABLE tags ADD COLUMN label_en TEXT NOT NULL DEFAULT ''"); } catch {}

  // 迁移：将旧版单列主键 tags 表升级为复合主键 (key, user_id)，支持每个用户拥有同 key 的私有分类
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS tags_new (
        key TEXT NOT NULL,
        label TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'ai',
        color TEXT NOT NULL DEFAULT '#3b82f6',
        user_id TEXT NOT NULL DEFAULT '',
        is_public INTEGER NOT NULL DEFAULT 0,
        is_category INTEGER NOT NULL DEFAULT 0,
        label_en TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (key, user_id)
      )
    `);
    await query(`
      INSERT OR IGNORE INTO tags_new (key, label, icon, color, user_id, is_public, is_category, label_en)
      SELECT key, label, icon, color, user_id, is_public, is_category, label_en FROM tags
    `);
    await query("DROP TABLE tags");
    await query("ALTER TABLE tags_new RENAME TO tags");
  } catch {}

  // 迁移：users 表增加 username 列
  try { await query("ALTER TABLE users ADD COLUMN username TEXT NOT NULL DEFAULT ''"); } catch {}
  // 回填：将已有用户的 username 设为邮箱前缀
  await query(
    "UPDATE users SET username = substr(email, 1, instr(email, '@') - 1) WHERE username = '' AND instr(email, '@') > 0"
  );
  await query("UPDATE users SET username = email WHERE username = ''");

  // 种子数据：默认私有分类（每个用户可自行管理）
  const defaultPrivateCategories = [
    { key: "frontend", label: "前端" },
    { key: "backend", label: "后端" },
    { key: "ai", label: "AI/ML" },
    { key: "reading", label: "阅读" },
    { key: "devops", label: "DevOps" },
    { key: "design", label: "设计" },
  ];
  for (const cat of defaultPrivateCategories) {
    await query(
      "INSERT OR IGNORE INTO tags (key, label, icon, color, user_id, is_public, is_category, label_en) VALUES (?, ?, ?, ?, 'admin', 0, 1, '')",
      [cat.key, cat.label, cat.key, "#3b82f6"]
    );
  }

  // 种子数据：默认公开分类（管理员管理，支持中英文）
  const defaultPublicCategories = [
    { key: "news", label: "新闻", label_en: "News" },
    { key: "tech", label: "技术", label_en: "Tech" },
    { key: "design", label: "设计", label_en: "Design" },
    { key: "reading", label: "阅读", label_en: "Reading" },
    { key: "misc", label: "杂谈", label_en: "Misc" },
    { key: "other", label: "其他", label_en: "Other" },
  ];
  for (const cat of defaultPublicCategories) {
    await query(
      "INSERT OR IGNORE INTO tags (key, label, icon, color, user_id, is_public, is_category, label_en) VALUES (?, ?, ?, ?, 'admin', 1, 1, ?)",
      [cat.key, cat.label, cat.key, "#3b82f6", cat.label_en]
    );
  }
}

export async function tursoGetRecords(userId: string, visibility?: string): Promise<RecordMeta[]> {
  const sql = visibility
    ? "SELECT id, slug, title, date, category, summary, format, visibility, attachments FROM records WHERE user_id = ? AND visibility = ? ORDER BY date DESC, id DESC"
    : "SELECT id, slug, title, date, category, summary, format, visibility, attachments FROM records WHERE user_id = ? ORDER BY date DESC, id DESC";
  const params = visibility ? [userId, visibility] : [userId];
  const rows = await query(sql, params);
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
        "SELECT id, slug, title, date, category, summary, format, content, visibility, attachments FROM records WHERE id = ? AND visibility = 'public'",
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
  for (const row of rows) {
    tags[row[0]] = { label: row[1], icon: row[2] || row[0], color: row[3] || "#3b82f6", isPublic: !!row[4] };
  }
  return tags;
}

export async function tursoAddTag(key: string, label: string, icon: string, color = "#3b82f6", userId?: string): Promise<void> {
  // 检查 key 是否已被其他用户的公开标签占用
  const existing = await query("SELECT is_public, user_id FROM tags WHERE key = ? AND user_id != ? LIMIT 1", [key, userId || "admin"]);
  if (existing.length > 0 && existing[0][0] === 1) {
    throw new Error("无法修改公开标签");
  }
  await query(
    "INSERT INTO tags (key, label, icon, color, user_id, is_public) VALUES (?, ?, ?, ?, ?, 0) ON CONFLICT(key, user_id) DO UPDATE SET label = excluded.label, icon = excluded.icon, color = excluded.color",
    [key, label, icon, color, userId || "admin"]
  );
}

export async function tursoDeleteTag(key: string, userId?: string): Promise<void> {
  // 保护公开分类不被误删
  const rows = await query("SELECT is_public, is_category FROM tags WHERE key = ? AND user_id = ?", [key, userId || "admin"]);
  if (rows.length > 0 && rows[0][0] === 1 && rows[0][1] === 1) return;
  if (userId) {
    await query("DELETE FROM tags WHERE key = ? AND user_id = ? AND is_public = 0", [key, userId]);
  } else {
    await query("DELETE FROM tags WHERE key = ? AND user_id = ? AND is_public = 0", [key, userId || "admin"]);
  }
}

// ─── 分类管理（is_category=1 的标签） ───

export interface CategoryRow {
  key: string;
  label: string;
  label_en: string;
  icon: string;
  color: string;
  isPublic: boolean;
}

export async function tursoGetCategories(userId?: string): Promise<CategoryRow[]> {
  let rows = userId
    ? await query("SELECT key, label, label_en, icon, color, is_public FROM tags WHERE is_category = 1 AND user_id = ? ORDER BY key", [userId])
    : await query("SELECT key, label, label_en, icon, color, is_public FROM tags WHERE is_category = 1 AND is_public = 1 ORDER BY key");

  // 老用户或创建失败时，若私有分类为空则自动兜底创建「其他」
  if (userId && rows.length === 0) {
    try {
      await tursoAddCategory("other", "其他", "Other", "other", "#6b7280", false, userId);
      rows = await query("SELECT key, label, label_en, icon, color, is_public FROM tags WHERE is_category = 1 AND user_id = ? ORDER BY key", [userId]);
    } catch {}
  }

  const categories = rows.map((row: any) => ({
    key: row[0],
    label: row[1],
    label_en: row[2] || "",
    icon: row[3] || row[0],
    color: row[4] || "#3b82f6",
    isPublic: !!row[5],
  }));

  // 把「其他/other」固定排在最后
  categories.sort((a: CategoryRow, b: CategoryRow) => {
    if (a.key === "other") return 1;
    if (b.key === "other") return -1;
    return a.key.localeCompare(b.key);
  });

  return categories;
}

export async function tursoAddCategory(key: string, label: string, label_en: string, icon: string, color: string, isPublic: boolean, userId?: string): Promise<void> {
  // 检查 key 是否已被其他用户的公开分类占用
  const existing = await query("SELECT is_public, user_id FROM tags WHERE key = ? AND user_id != ? LIMIT 1", [key, userId || "admin"]);
  if (existing.length > 0 && existing[0][0] === 1) {
    throw new Error("无法修改公开分类");
  }
  await query(
    "INSERT INTO tags (key, label, label_en, icon, color, user_id, is_public, is_category) VALUES (?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT(key, user_id) DO UPDATE SET label = excluded.label, label_en = excluded.label_en, icon = excluded.icon, color = excluded.color",
    [key, label, label_en || "", icon || key, color || "#3b82f6", userId || "admin", isPublic ? 1 : 0]
  );
}

export async function tursoDeleteCategory(key: string, userId?: string): Promise<void> {
  // 保护公开分类不被删除
  const rows = await query("SELECT is_public FROM tags WHERE key = ? AND is_category = 1 AND user_id = ?", [key, userId || "admin"]);
  if (rows.length > 0 && rows[0][0] === 1) return;
  if (userId) {
    await query("DELETE FROM tags WHERE key = ? AND user_id = ? AND is_category = 1", [key, userId]);
  } else {
    await query("DELETE FROM tags WHERE key = ? AND is_category = 1", [key]);
  }
}

export async function tursoGetPublicRecords(category?: string): Promise<RecordMeta[]> {
  const sql = category && category !== "all"
    ? "SELECT r.id, r.slug, r.title, r.date, r.category, r.summary, r.format, r.visibility, r.attachments, COALESCE(NULLIF(u.username, ''), r.user_id) AS author FROM records r LEFT JOIN users u ON r.user_id = u.id WHERE r.visibility = 'public' AND r.category = ? ORDER BY r.date DESC, r.id DESC"
    : "SELECT r.id, r.slug, r.title, r.date, r.category, r.summary, r.format, r.visibility, r.attachments, COALESCE(NULLIF(u.username, ''), r.user_id) AS author FROM records r LEFT JOIN users u ON r.user_id = u.id WHERE r.visibility = 'public' ORDER BY r.date DESC, r.id DESC";
  const params = category && category !== "all" ? [category] : [];
  const rows = await query(sql, params);
  return rows.map((row: any) => ({
    id: row[0], slug: row[1], title: row[2],
    date: row[3], category: row[4], summary: row[5], format: row[6],
    visibility: (row[7] || "public") as Visibility,
    attachments: safeParseAttachments(row[8]),
    author: row[9],
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

// ─── 用户管理 ───

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  username: string;
  created_at: string;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await query(
    "SELECT id, email, password_hash, username, created_at FROM users WHERE email = ?",
    [email.toLowerCase()]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return { id: row[0], email: row[1], password_hash: row[2], username: row[3] || "", created_at: row[4] };
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const rows = await query(
    "SELECT id, email, password_hash, username, created_at FROM users WHERE id = ?",
    [id]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return { id: row[0], email: row[1], password_hash: row[2], username: row[3] || "", created_at: row[4] };
}

export async function createUser(id: string, email: string, passwordHash: string): Promise<void> {
  const username = email.split("@")[0] || email;
  await query(
    "INSERT INTO users (id, email, password_hash, username) VALUES (?, ?, ?, ?)",
    [id, email.toLowerCase(), passwordHash, username]
  );
}

export async function updateUsername(userId: string, username: string): Promise<void> {
  await query(
    "UPDATE users SET username = ? WHERE id = ?",
    [username, userId]
  );
}

// ─── 验证码管理 ───

export async function saveVerificationCode(email: string, code: string, expiresAt: string): Promise<void> {
  const id = `vc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await query(
    "INSERT INTO verification_codes (id, email, code, expires_at) VALUES (?, ?, ?, ?)",
    [id, email.toLowerCase(), code, expiresAt]
  );
}

export async function saveVerificationCodeWithInvalidate(email: string, code: string, expiresAt: string): Promise<void> {
  // 作废该邮箱所有未使用的旧验证码
  await query(
    "UPDATE verification_codes SET used = 1 WHERE email = ? AND used = 0",
    [email.toLowerCase()]
  );
  await saveVerificationCode(email, code, expiresAt);
}

export async function verifyCode(email: string, code: string): Promise<boolean> {
  // 原子更新：仅当 used=0 且未过期时才标记为已使用
  // 使用 RETURNING 避免依赖不同 HTTP API 的 rows_affected 字段命名
  const rows = await query(
    "UPDATE verification_codes SET used = 1 WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now') RETURNING id",
    [email.toLowerCase(), code]
  );
  return rows.length > 0;
}

/** 清理过期验证码（可定期调用） */
export async function cleanExpiredCodes(): Promise<void> {
  await query("DELETE FROM verification_codes WHERE expires_at < datetime('now')");
}
