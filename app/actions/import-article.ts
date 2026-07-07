"use server";

import { writeRecord, generateId } from "@/lib/content";
import type { RecordMeta, Category, ContentFormat } from "@/lib/types";
import type { ImportedArticle } from "@/lib/article-importer";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

async function requireAuth(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get("zhiyi_token")?.value;
  if (!token) {
    throw new Error("Unauthorized");
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("Unauthorized");
  }
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    return (payload.sub as string) || "admin";
  } catch {
    throw new Error("Unauthorized");
  }
}

export async function importArticleAction(
  article: ImportedArticle
): Promise<{ ok: boolean; error?: string }> {
  "use server";
  const username = await requireAuth();
  const slug = article.title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  try {
    const id = await generateId(username);
    const meta: RecordMeta = {
      id,
      slug,
      title: article.title,
      date: article.date,
      category: article.category as Category,
      summary: article.summary,
      format: "md" as ContentFormat,
      visibility: "private",
    };

    await writeRecord(meta, article.content, username);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}