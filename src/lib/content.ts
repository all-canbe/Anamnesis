import { commitFile, deleteFile as githubDeleteFile, isGithubMode, triggerRedeploy } from "./github-api";
import { type RecordMeta, type ContentRecord, CATEGORIES } from "./types";
import fs from "fs";
import path from "path";

const CONTENT_DIR = path.join(process.cwd(), "content");
const INDEX_PATH = path.join(CONTENT_DIR, "index.json");
const TAGS_PATH = path.join(CONTENT_DIR, "tags.json");

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
  const filePath = path.join(CONTENT_DIR, `${meta.id}-${meta.slug}.md`);
  const fullContent = buildFrontmatter(meta, content);

  if (canWriteLocal()) {
    fs.writeFileSync(filePath, fullContent);
    const index = buildIndex();
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
    return;
  }

  // 部署环境：仅同步到 GitHub
  if (isGithubMode()) {
    await commitFile(relPath(filePath), fullContent, `Add record: ${meta.title}`);
    const newIndex = buildIndex();
    const newIndexWithMeta = [...newIndex.filter((r) => r.id !== meta.id), meta];
    newIndexWithMeta.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(b.id));
    await commitFile(relPath(INDEX_PATH), JSON.stringify(newIndexWithMeta, null, 2), "Update index.json");
    await triggerRedeploy();
  } else {
    throw new Error("Serverless environment is read-only. Set GITHUB_TOKEN to enable writes.");
  }
}

export async function deleteRecord(id: string): Promise<void> {
  const records = getRecords();
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
    throw new Error("Serverless environment is read-only. Set GITHUB_TOKEN to enable writes.");
  }
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
  const newTag = { [key]: { label, emoji } };

  if (canWriteLocal()) {
    let tagFile: Record<string, { label: string; emoji: string }> = {};
    if (fs.existsSync(TAGS_PATH)) {
      try { tagFile = JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8")); } catch {}
    }
    Object.assign(tagFile, newTag);
    fs.writeFileSync(TAGS_PATH, JSON.stringify(tagFile, null, 2));
    return;
  }

  if (isGithubMode()) {
    const current = getTags();
    const merged = { ...current, ...newTag };
    await commitFile(relPath(TAGS_PATH), JSON.stringify(merged, null, 2), `Add tag: ${key}`);
  } else {
    throw new Error("Serverless environment is read-only. Set GITHUB_TOKEN to enable writes.");
  }
}

export async function deleteTag(key: string): Promise<void> {
  if (key in CATEGORIES) return;

  if (canWriteLocal()) {
    let tagFile: Record<string, { label: string; emoji: string }> = {};
    if (fs.existsSync(TAGS_PATH)) {
      try { tagFile = JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8")); } catch {}
    }
    delete tagFile[key];
    fs.writeFileSync(TAGS_PATH, JSON.stringify(tagFile, null, 2));
    return;
  }

  if (isGithubMode()) {
    const current = getTags();
    delete current[key];
    await commitFile(relPath(TAGS_PATH), JSON.stringify(current, null, 2), `Delete tag: ${key}`);
  } else {
    throw new Error("Serverless environment is read-only. Set GITHUB_TOKEN to enable writes.");
  }
}