import { commitFile, deleteFile as githubDeleteFile, isGithubMode, triggerRedeploy } from "./github-api";
import { type RecordMeta, type ContentRecord } from "./types";
import {
  isTursoConfigured,
  tursoGetRecords,
  tursoGetRecord,
  tursoWriteRecord,
  tursoDeleteRecord,
  tursoGetTags,
  tursoAddTag,
  tursoDeleteTag,
  tursoGetPublicRecords,
  tursoGetCategories,
  tursoAddCategory,
  tursoDeleteCategory,
  initTursoSchema,
} from "./turso";
import fs from "fs";
import path from "path";

const CONTENT_DIR = path.join(process.cwd(), "content");
const INDEX_PATH = path.join(CONTENT_DIR, "index.json");
const TAGS_PATH = path.join(CONTENT_DIR, "tags.json");

let tursoInitialized = false;

async function ensureTurso(): Promise<void> {
  if (!tursoInitialized && isTursoConfigured()) {
    try {
      await initTursoSchema();
      tursoInitialized = true;
    } catch {}
  }
}

function canWriteLocal(): boolean {
  if (isGithubMode()) return false;
  try {
    fs.accessSync(CONTENT_DIR, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function relPath(absPath: string): string {
  return path.relative(process.cwd(), absPath).replace(/\\/g, "/");
}

export async function getRecords(userId?: string, visibility?: string): Promise<RecordMeta[]> {
  await ensureTurso();
  if (isTursoConfigured() && userId) {
    try {
      return await tursoGetRecords(userId, visibility);
    } catch {}
  }
  // 未登录用户只能看公开记录
  if (isTursoConfigured() && !userId) {
    try {
      const records = await tursoGetPublicRecords(visibility === "public" ? undefined : undefined);
      if (records.length > 0) return records;
    } catch {}
  }
  // 回退到本地文件
  const raw = fs.readFileSync(INDEX_PATH, "utf-8");
  const records = JSON.parse(raw) as RecordMeta[];
  if (visibility) {
    return records.filter((r) => r.visibility === visibility);
  }
  return records;
}

export async function getRecord(id: string, userId?: string): Promise<ContentRecord | null> {
  await ensureTurso();
  if (isTursoConfigured()) {
    try {
      const record = await tursoGetRecord(id, userId);
      if (record) return record;
    } catch {}
  }

  const records = await getRecords(userId);
  const meta = records.find((r) => r.id === id);
  if (!meta) return null;

  const filePath = path.join(CONTENT_DIR, `${meta.id}-${meta.slug}.md`);
  const raw = fs.readFileSync(filePath, "utf-8");

  const firstSep = raw.indexOf("---");
  const secondSep = raw.indexOf("---", firstSep + 1);
  const contentStart = secondSep + 3;
  const content = raw.slice(contentStart).trim();

  return { meta, content };
}

export async function getCategories(userId?: string): Promise<import("./turso").CategoryRow[]> {
  await ensureTurso();
  if (isTursoConfigured()) {
    try {
      return await tursoGetCategories(userId);
    } catch {}
  }
  return [];
}

export async function getPublicCategories(): Promise<import("./turso").CategoryRow[]> {
  await ensureTurso();
  if (isTursoConfigured()) {
    try {
      return await tursoGetCategories();
    } catch {}
  }
  return [];
}

export async function addCategory(key: string, label: string, label_en: string, icon: string, color: string, isPublic: boolean, userId?: string): Promise<void> {
  await ensureTurso();
  if (isTursoConfigured()) {
    try {
      await tursoAddCategory(key, label, label_en, icon, color, isPublic, userId);
      return;
    } catch {}
  }
  throw new Error("Category management requires Turso database.");
}

export async function deleteCategory(key: string, userId?: string): Promise<void> {
  await ensureTurso();
  if (isTursoConfigured()) {
    try {
      await tursoDeleteCategory(key, userId);
      return;
    } catch {}
  }
  throw new Error("Category management requires Turso database.");
}

export async function getFilteredRecords(category?: string, userId?: string, visibility?: string): Promise<RecordMeta[]> {
  const records = await getRecords(userId, visibility);
  if (!category || category === "all") return records;
  return records.filter((r) => r.category === category);
}

export async function generateId(userId?: string): Promise<string> {
  try {
    const records = await getRecords(userId);
    const prefix = userId ? userId.slice(0, 8) : "anon";
    const maxId = records.reduce((max, r) => {
      const num = parseInt((r.id || `${prefix}0`).replace(`${prefix}-`, "").replace("k", ""), 10);
      return num > max ? num : max;
    }, 0);
    return `${prefix}-${maxId + 1}`;
  } catch {
    return `r-${Date.now().toString(36)}`;
  }
}

function buildFrontmatter(meta: RecordMeta, content: string): string {
  return `---
${Object.entries(meta)
  .map(([k, v]) => `${k}: "${v}"`)
  .join("\n")}
---
\n${content}`;
}

function buildIndex(): RecordMeta[] {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  const index: RecordMeta[] = [];
  const seen = new Set<string>();
  files.forEach((f) => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, f), "utf-8");
    const match = raw.match(/^---\n([\s\S]+?)\n---/);
    if (!match) return;
    const attrs: { [key: string]: string } = {};
    match[1].split("\n").forEach((line) => {
      const sep = line.indexOf(":");
      if (sep > 0) attrs[line.slice(0, sep).trim()] = line.slice(sep + 1).trim().replace(/^"|"$/g, "");
    });
    const record = attrs as unknown as RecordMeta;
    if (!record.id || seen.has(record.id)) return;
    seen.add(record.id);
    index.push(record);
  });

  index.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return index;
}

export async function writeRecord(meta: RecordMeta, content: string, userId?: string): Promise<void> {
  await ensureTurso();

  // Primary: Turso
  if (isTursoConfigured()) {
    try {
      await tursoWriteRecord(meta, content, userId || "admin");
      return;
    } catch {}
  }

  // Fallback: local fs
  const filePath = path.join(CONTENT_DIR, `${meta.id}-${meta.slug}.md`);
  const fullContent = buildFrontmatter(meta, content);

  if (canWriteLocal()) {
    fs.writeFileSync(filePath, fullContent);
    const index = buildIndex();
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
    return;
  }

  // Fallback: GitHub API
  if (isGithubMode()) {
    await commitFile(relPath(filePath), fullContent, `Add record: ${meta.title}`);
    const newIndex = buildIndex();
    const newIndexWithMeta = [...newIndex.filter((r) => r.id !== meta.id), meta];
    newIndexWithMeta.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(b.id));
    await commitFile(relPath(INDEX_PATH), JSON.stringify(newIndexWithMeta, null, 2), "Update index.json");
    await triggerRedeploy();
  } else {
    throw new Error("No writable storage available. Configure Turso, local fs, or GITHUB_TOKEN.");
  }
}

export async function deleteRecord(id: string, userId?: string): Promise<void> {
  await ensureTurso();

  // Primary: Turso
  if (isTursoConfigured()) {
    try {
      await tursoDeleteRecord(id, userId);
      return;
    } catch {}
  }

  const records = await getRecords();
  const meta = records.find((r) => r.id === id);
  if (!meta) return;
  const filePath = path.join(CONTENT_DIR, `${meta.id}-${meta.slug}.md`);

  if (canWriteLocal()) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const index = buildIndex();
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
    return;
  }

  if (isGithubMode()) {
    await githubDeleteFile(relPath(filePath), `Delete record: ${meta.title}`);
    const newIndex = buildIndex().filter((r) => r.id !== id);
    await commitFile(relPath(INDEX_PATH), JSON.stringify(newIndex, null, 2), "Update index.json");
    await triggerRedeploy();
  } else {
    throw new Error("No writable storage available.");
  }
}

export async function getTags(userId?: string): Promise<Record<string, { label: string; icon: string; color: string; isPublic?: boolean }>> {
  await ensureTurso();
  if (isTursoConfigured()) {
    try {
      return await tursoGetTags(userId);
    } catch {}
  }

  if (!fs.existsSync(TAGS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8"));
  } catch {
    return {};
  }
}

export async function addTag(key: string, label: string, icon: string, color = "#3b82f6", userId?: string): Promise<void> {
  await ensureTurso();

  if (isTursoConfigured()) {
    try {
      await tursoAddTag(key, label, icon, color, userId);
      return;
    } catch {}
  }

  if (canWriteLocal()) {
    let tagFile: Record<string, { label: string; icon: string; color: string }> = {};
    if (fs.existsSync(TAGS_PATH)) {
      try { tagFile = JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8")); } catch {}
    }
    Object.assign(tagFile, { [key]: { label, icon, color } });
    fs.writeFileSync(TAGS_PATH, JSON.stringify(tagFile, null, 2));
    return;
  }

  if (isGithubMode()) {
    const current = await getTags();
    const merged = { ...current, [key]: { label, icon, color } };
    await commitFile(relPath(TAGS_PATH), JSON.stringify(merged, null, 2), `Add tag: ${key}`);
  } else {
    throw new Error("No writable storage available.");
  }
}

export async function deleteTag(key: string, userId?: string): Promise<void> {
  await ensureTurso();

  if (isTursoConfigured()) {
    try {
      await tursoDeleteTag(key, userId);
      return;
    } catch {}
  }

  if (canWriteLocal()) {
    let tagFile: Record<string, { label: string; icon: string }> = {};
    if (fs.existsSync(TAGS_PATH)) {
      try { tagFile = JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8")); } catch {}
    }
    delete tagFile[key];
    fs.writeFileSync(TAGS_PATH, JSON.stringify(tagFile, null, 2));
    return;
  }

  if (isGithubMode()) {
    const current = await getTags();
    delete current[key];
    await commitFile(relPath(TAGS_PATH), JSON.stringify(current, null, 2), `Delete tag: ${key}`);
  } else {
    throw new Error("No writable storage available.");
  }
}

export async function getPublicRecords(category?: string): Promise<RecordMeta[]> {
  await ensureTurso();
  if (isTursoConfigured()) {
    try {
      const records = await tursoGetPublicRecords(category);
      if (records.length > 0) return records;
    } catch {}
  }
  // Turso 未配置或无公开记录时，回退到本地文件
  try {
    const raw = fs.readFileSync(INDEX_PATH, "utf-8");
    const records = JSON.parse(raw) as RecordMeta[];
    if (category && category !== "all") {
      return records.filter((r) => r.category === category);
    }
    return records;
  } catch {
    return [];
  }
}
