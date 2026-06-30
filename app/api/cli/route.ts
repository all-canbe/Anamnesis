import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  getRecords,
  getRecord,
  writeRecord,
  deleteRecord,
  getTags,
  addTag,
  deleteTag,
} from "@/lib/content";
import type { Category, ContentFormat, RecordMeta } from "@/lib/types";
import {
  commitFile,
  deleteFile as githubDeleteFile,
  isGithubMode,
  triggerRedeploy,
} from "@/lib/github-api";
import fs from "fs";
import path from "path";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[《》]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "");
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getContentDir(): string {
  return path.join(process.cwd(), "content");
}

function buildFrontmatter(meta: Record<string, string>, content: string): string {
  return `---
${Object.entries(meta)
  .map(([k, v]) => `${k}: "${v}"`)
  .join("\n")}
---
\n${content}`;
}

function relPath(absPath: string): string {
  return path.relative(process.cwd(), absPath).replace(/\\/g, "/");
}

function buildIndex(): Record<string, string>[] {
  const contentDir = getContentDir();
  if (!fs.existsSync(contentDir)) return [];
  const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md"));
  const index: Record<string, string>[] = files
    .map((f) => {
      const raw = fs.readFileSync(path.join(contentDir, f), "utf-8");
      const match = raw.match(/^---\n([\s\S]+?)\n---/);
      if (!match) return null;
      const attrs: Record<string, string> = {};
      match[1].split("\n").forEach((line) => {
        const sep = line.indexOf(":");
        if (sep > 0)
          attrs[line.slice(0, sep).trim()] = line
            .slice(sep + 1)
            .trim()
            .replace(/^"|"$/g, "");
      });
      return attrs;
    })
    .filter(Boolean) as Record<string, string>[];

  index.sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(b.id)
  );
  return index;
}

async function writeRecordGitHub(
  id: string,
  slug: string,
  title: string,
  date: string,
  category: string,
  summary: string,
  format: string,
  content: string
): Promise<void> {
  const meta = { id, slug, title, date, category, summary, format };
  const filePath = `content/${id}-${slug}.md`;
  const fullContent = buildFrontmatter(meta, content);
  await commitFile(filePath, fullContent, `Add record: ${title}`);

  const records = buildIndex();
  const updated = [...records.filter((r) => r.id !== id), meta];
  updated.sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(b.id)
  );
  await commitFile(
    "content/index.json",
    JSON.stringify(updated, null, 2),
    "Update index.json"
  );
  await triggerRedeploy();
}

async function deleteRecordGitHub(id: string): Promise<void> {
  const records = buildIndex();
  const meta = records.find((r) => r.id === id);
  if (!meta) return;
  await githubDeleteFile(
    `content/${meta.id}-${meta.slug}.md`,
    `Delete record: ${meta.title}`
  );
  const newIndex = records.filter((r) => r.id !== id);
  await commitFile(
    "content/index.json",
    JSON.stringify(newIndex, null, 2),
    "Update index.json"
  );
  await triggerRedeploy();
}

async function nextId(): Promise<string> {
  const records = buildIndex();
  const maxId = records.reduce((max, r) => {
    const num = parseInt((r.id || "k0").replace("k", ""), 10);
    return num > max ? num : max;
  }, 0);
  return `k${maxId + 1}`;
}

// ──── Route handler ────

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token || !verifyToken(token)) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired token. Run 'kb login' first." },
        { status: 401 }
      );
    }

    let body: { command?: string; args?: Record<string, unknown> };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { command, args = {} } = body;

    if (!command) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing 'command'. Available: publish, list, get, edit, delete, status, add-tag, delete-tag, tags",
        },
        { status: 400 }
      );
    }

    // ── publish ──
    if (command === "publish") {
      const {
        title = "",
        category = "reading",
        date = todayStr(),
        format = "md",
        summary = "",
        content = "",
      } = args as Record<string, string>;

      if (!title || !content) {
        return NextResponse.json({
          ok: false,
          error: "title and content are required",
        });
      }

      const id = await nextId();
      const slug = slugify(title);

      if (isGithubMode()) {
        await writeRecordGitHub(id, slug, title, date, category, summary, format, content);
      } else {
        await writeRecord(
          { id, slug, title, date, category: category as Category, summary, format: format as ContentFormat },
          content
        );
      }

      return NextResponse.json({ ok: true, id, slug });
    }

    // ── list ──
    if (command === "list") {
      const { category, limit } = args as {
        category?: string;
        limit?: number;
      };
      let records = await getRecords();
      if (category && category !== "all") {
        records = records.filter((r: any) => r.category === category);
      }
      if (limit && typeof limit === "number" && limit > 0) {
        records = records.slice(0, limit);
      }
      return NextResponse.json({ ok: true, records, total: records.length });
    }

    // ── get ──
    if (command === "get") {
      const { id } = args as { id?: string };
      if (!id) {
        return NextResponse.json({ ok: false, error: "id is required" });
      }
      const record = await getRecord(id);
      if (!record) {
        return NextResponse.json({ ok: false, error: `Record '${id}' not found` });
      }
      return NextResponse.json({ ok: true, record });
    }

    // ── edit ──
    if (command === "edit") {
      const { id, title, category, date, format, summary, content } =
        args as Record<string, string>;

      if (!id) {
        return NextResponse.json({ ok: false, error: "id is required" });
      }

      const existing = await getRecord(id);
      if (!existing) {
        return NextResponse.json({ ok: false, error: `Record '${id}' not found` });
      }

      const newSlug = title ? slugify(title) : existing.meta.slug;
      const newContent = content !== undefined ? content : existing.content;
      const oldPath = `${existing.meta.id}-${existing.meta.slug}.md`;
      const newPath = `${id}-${newSlug}.md`;

      const newMeta: RecordMeta = {
        ...existing.meta,
        title: title || existing.meta.title,
        category: (category || existing.meta.category) as Category,
        date: date || existing.meta.date,
        format: (format || existing.meta.format) as ContentFormat,
        summary: summary || existing.meta.summary,
        slug: newSlug,
      };

      if (isGithubMode()) {
        if (oldPath !== newPath) {
          await githubDeleteFile(`content/${oldPath}`, `Remove old: ${existing.meta.title}`);
        }
        await writeRecordGitHub(
          id,
          newSlug,
          newMeta.title,
          newMeta.date,
          newMeta.category,
          newMeta.summary,
          newMeta.format,
          newContent
        );
      } else {
        const contentDir = getContentDir();
        const oldFullPath = path.join(contentDir, oldPath);
        if (fs.existsSync(oldFullPath)) fs.unlinkSync(oldFullPath);
        await writeRecord(newMeta, newContent);
      }

      return NextResponse.json({ ok: true, id, slug: newSlug });
    }

    // ── delete ──
    if (command === "delete") {
      const { id } = args as { id?: string };
      if (!id) {
        return NextResponse.json({ ok: false, error: "id is required" });
      }
      if (isGithubMode()) {
        await deleteRecordGitHub(id);
      } else {
        await deleteRecord(id);
      }
      return NextResponse.json({ ok: true, id });
    }

    // ── status ──
    if (command === "status") {
      const records = await getRecords();
      const total = records.length;
      const categories: Record<string, number> = {};
      const formats: Record<string, number> = {};

      records.forEach((r) => {
        categories[r.category] = (categories[r.category] || 0) + 1;
        const fmt = r.format || "md";
        formats[fmt] = (formats[fmt] || 0) + 1;
      });

      const latest = records.slice(0, 5).map((r) => ({
        id: r.id,
        date: r.date,
        title: r.title,
        category: r.category,
      }));

      return NextResponse.json({ ok: true, total, categories, formats, latest });
    }

    // ── add-tag ──
    if (command === "add-tag") {
      const { key, label, icon = "ai" } = args as Record<string, string>;
      if (!key || !label) {
        return NextResponse.json({ ok: false, error: "key and label are required" });
      }
      await addTag(key, label, icon);
      return NextResponse.json({ ok: true, key, label, icon });
    }

    // ── delete-tag ──
    if (command === "delete-tag") {
      const { key } = args as { key?: string };
      if (!key) {
        return NextResponse.json({ ok: false, error: "key is required" });
      }
      await deleteTag(key);
      return NextResponse.json({ ok: true, key });
    }

    // ── tags ──
    if (command === "tags") {
      const tags = await getTags();
      return NextResponse.json({ ok: true, tags });
    }

    return NextResponse.json(
      {
        ok: false,
        error: `Unknown command '${command}'. Available: publish, list, get, edit, delete, status, add-tag, delete-tag, tags`,
      },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("CLI API error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
