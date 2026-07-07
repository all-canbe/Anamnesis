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
  generateId,
} from "@/lib/content";
import type { Category, ContentFormat, RecordMeta } from "@/lib/types";

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

// ──── Route handler ────

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const username = await verifyToken(token);
    if (!username) {
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
        visibility = "private",
      } = args as Record<string, string>;

      if (!title || !content) {
        return NextResponse.json({
          ok: false,
          error: "title and content are required",
        });
      }

      const id = await generateId(username);
      const slug = slugify(title);

      await writeRecord(
        { id, slug, title, date, category: category as Category, summary, format: format as ContentFormat, visibility: visibility as "private" | "public" },
        content,
        username
      );

      return NextResponse.json({ ok: true, id, slug });
    }

    // ── list ──
    if (command === "list") {
      const { category, limit } = args as {
        category?: string;
        limit?: number;
      };
      let records = await getRecords(username);
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
      const record = await getRecord(id, username);
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

      const existing = await getRecord(id, username);
      if (!existing) {
        return NextResponse.json({ ok: false, error: `Record '${id}' not found` });
      }

      const newSlug = title ? slugify(title) : existing.meta.slug;
      const newContent = content !== undefined ? content : existing.content;

      const newMeta: RecordMeta = {
        ...existing.meta,
        title: title || existing.meta.title,
        category: (category || existing.meta.category) as Category,
        date: date || existing.meta.date,
        format: (format || existing.meta.format) as ContentFormat,
        summary: summary || existing.meta.summary,
        slug: newSlug,
      };

      await writeRecord(newMeta, newContent, username);

      return NextResponse.json({ ok: true, id, slug: newSlug });
    }

    // ── delete ──
    if (command === "delete") {
      const { id } = args as { id?: string };
      if (!id) {
        return NextResponse.json({ ok: false, error: "id is required" });
      }
      await deleteRecord(id, username);
      return NextResponse.json({ ok: true, id });
    }

    // ── status ──
    if (command === "status") {
      const records = await getRecords(username);
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
      const { key, label, icon = "ai", color = "#3b82f6" } = args as Record<string, string>;
      if (!key || !label) {
        return NextResponse.json({ ok: false, error: "key and label are required" });
      }
      await addTag(key, label, icon, color, username);
      return NextResponse.json({ ok: true, key, label, icon, color });
    }

    // ── delete-tag ──
    if (command === "delete-tag") {
      const { key } = args as { key?: string };
      if (!key) {
        return NextResponse.json({ ok: false, error: "key is required" });
      }
      await deleteTag(key, username);
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
