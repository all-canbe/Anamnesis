import fs from "fs";
import path from "path";
import { type RecordMeta, type ContentRecord, CATEGORIES } from "./types";
import { commitFile, deleteFile as githubDeleteFile, isGithubMode } from "./github-api";

const CONTENT_DIR = path.join(process.cwd(), "content");
const INDEX_PATH = path.join(CONTENT_DIR, "index.json");
const TAGS_PATH = path.join(CONTENT_DIR, "tags.json");

function relPath(absPath: string): string {
  return path.relative(CONTENT_DIR, absPath).replace(/\\/g, "/");
}

export function getRecords(): RecordMeta[] {
  const raw = fs.readFileSync(INDEX_PATH, "utf-8");
  return JSON.parse(raw);
}

export function getRecord(id: string): ContentRecord | null {
  const records = getRecords();
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

export function getCategories(): string[] {
  const records = getRecords();
  return [...new Set(records.map((r) => r.category))];
}

export function getFilteredRecords(category?: string): RecordMeta[] {
  const records = getRecords();
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

export async function writeRecord(meta: RecordMeta, content: string): Promise<void> {
  const filePath = path.join(CONTENT_DIR, `${meta.id}-${meta.slug}.md`);
  const fullContent = buildFrontmatter(meta, content);
  fs.writeFileSync(filePath, fullContent);
  await rebuildIndex();
  // Sync to GitHub if configured
  if (isGithubMode()) {
    const rp = `content/${relPath(filePath)}`;
    await commitFile(rp, fullContent, `Add record: ${meta.title}`);
    const indexRaw = fs.readFileSync(INDEX_PATH, "utf-8");
    await commitFile("content/index.json", indexRaw, "Update index.json");
  }
}

export async function deleteRecord(id: string): Promise<void> {
  const records = getRecords();
  const meta = records.find((r) => r.id === id);
  if (!meta) return;
  const filePath = path.join(CONTENT_DIR, `${meta.id}-${meta.slug}.md`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await rebuildIndex();
  // Sync to GitHub if configured
  if (isGithubMode()) {
    const rp = `content/${relPath(filePath)}`;
    await githubDeleteFile(rp, `Delete record: ${meta.title}`);
    const indexRaw = fs.readFileSync(INDEX_PATH, "utf-8");
    await commitFile("content/index.json", indexRaw, "Update index.json");
  }
}

export async function rebuildIndex(): Promise<void> {
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
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

export function getTags(): Record<string, { label: string; emoji: string }> {
  if (!fs.existsSync(TAGS_PATH)) return { ...CATEGORIES };
  try {
    const custom = JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8"));
    return { ...CATEGORIES, ...custom };
  } catch {
    return { ...CATEGORIES };
  }
}

export async function addTag(key: string, label: string, emoji: string): Promise<void> {
  let tagFile: Record<string, { label: string; emoji: string }> = {};
  if (fs.existsSync(TAGS_PATH)) {
    try { tagFile = JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8")); } catch {}
  }
  tagFile[key] = { label, emoji };
  fs.writeFileSync(TAGS_PATH, JSON.stringify(tagFile, null, 2));
  if (isGithubMode()) {
    const raw = fs.readFileSync(TAGS_PATH, "utf-8");
    await commitFile("content/tags.json", raw, `Add tag: ${key}`);
  }
}

export async function deleteTag(key: string): Promise<void> {
  if (key in CATEGORIES) return;
  let tagFile: Record<string, { label: string; emoji: string }> = {};
  if (fs.existsSync(TAGS_PATH)) {
    try { tagFile = JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8")); } catch {}
  }
  delete tagFile[key];
  fs.writeFileSync(TAGS_PATH, JSON.stringify(tagFile, null, 2));
  if (isGithubMode()) {
    const raw = fs.readFileSync(TAGS_PATH, "utf-8");
    await commitFile("content/tags.json", raw, `Delete tag: ${key}`);
  }
}