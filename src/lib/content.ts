import { commitFile, deleteFile as githubDeleteFile, isGithubMode, triggerRedeploy } from "./github-api";
import { type RecordMeta, type ContentRecord, CATEGORIES } from "./types";
import {
  isTursoConfigured,
  tursoGetRecords,
  tursoGetRecord,
  tursoWriteRecord,
  tursoDeleteRecord,
  tursoGetTags,
  tursoAddTag,
  tursoDeleteTag,
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

export async function getRecords(): Promise<RecordMeta[]> {
  await ensureTurso();
  if (isTursoConfigured()) {
    try {
      return await tursoGetRecords();
    } catch {}
  }
  const raw = fs.readFileSync(INDEX_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function getRecord(id: string): Promise<ContentRecord | null> {
  await ensureTurso();
  if (isTursoConfigured()) {
    try {
      const record = await tursoGetRecord(id);
      if (record) return record;
    } catch {}
  }

  const records = await getRecords();
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

export async function getCategories(): Promise<string[]> {
  const records = await getRecords();
  return [...new Set(records.map((r) => r.category))];
}

export async function getFilteredRecords(category?: string): Promise<RecordMeta[]> {
  const records = await getRecords();
  if (!category || category === "all") return records;
  return records.filter((r) => r.category === category);
}

let _nextId = 12;

export function generateId(): string {
  _nextId++;
  return `k${_nextId}`;
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
  const index: RecordMeta[] = files.map((f) => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, f), "utf-8");
    const match = raw.match(/^---\n([\s\S]+?)\n---/);
    if (!match) return null;
    const attrs: { [key: string]: string } = {};
    match[1].split("\n").forEach((line) => {
      const sep = line.indexOf(":");
      if (sep > 0) attrs[line.slice(0, sep).trim()] = line.slice(sep + 1).trim().replace(/^"|"$/g, "");
    });
    return attrs as unknown as RecordMeta;
  }).filter(Boolean) as RecordMeta[];

  index.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(b.id));
  return index;
}

export async function writeRecord(meta: RecordMeta, content: string): Promise<void> {
  await ensureTurso();

  // Primary: Turso
  if (isTursoConfigured()) {
    try {
      await tursoWriteRecord(meta, content);
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

export async function deleteRecord(id: string): Promise<void> {
  await ensureTurso();

  // Primary: Turso
  if (isTursoConfigured()) {
    try {
      await tursoDeleteRecord(id);
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

export async function getTags(): Promise<Record<string, { label: string; icon: string }>> {
  await ensureTurso();
  if (isTursoConfigured()) {
    try {
      return await tursoGetTags();
    } catch {}
  }

  if (!fs.existsSync(TAGS_PATH)) return { ...CATEGORIES };
  try {
    const custom = JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8"));
    return { ...CATEGORIES, ...custom };
  } catch {
    return { ...CATEGORIES };
  }
}

export async function addTag(key: string, label: string, icon: string): Promise<void> {
  await ensureTurso();

  if (isTursoConfigured()) {
    try {
      await tursoAddTag(key, label, icon);
      return;
    } catch {}
  }

  if (canWriteLocal()) {
    let tagFile: Record<string, { label: string; icon: string }> = {};
    if (fs.existsSync(TAGS_PATH)) {
      try { tagFile = JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8")); } catch {}
    }
    Object.assign(tagFile, { [key]: { label, icon } });
    fs.writeFileSync(TAGS_PATH, JSON.stringify(tagFile, null, 2));
    return;
  }

  if (isGithubMode()) {
    const current = await getTags();
    const merged = { ...current, [key]: { label, icon } };
    await commitFile(relPath(TAGS_PATH), JSON.stringify(merged, null, 2), `Add tag: ${key}`);
  } else {
    throw new Error("No writable storage available.");
  }
}

export async function deleteTag(key: string): Promise<void> {
  if (key in CATEGORIES) return;
  await ensureTurso();

  if (isTursoConfigured()) {
    try {
      await tursoDeleteTag(key);
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
