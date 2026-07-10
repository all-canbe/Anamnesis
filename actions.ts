"use server";

import { revalidatePath } from "next/cache";
import { writeRecord, deleteRecord, generateId, getRecord } from "@/lib/content";
import { slugify } from "@/lib/utils";
import type { RecordMeta } from "@/lib/types";
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

export async function createRecord(formData: FormData) {
  const username = await requireAuth();
  const title = formData.get("title") as string;
  const category = formData.get("category") as string;
  const date = formData.get("date") as string;
  const summary = formData.get("summary") as string;
  const content = formData.get("content") as string;
  const format = formData.get("format") as "md" | "html";

  const id = await generateId(username);
  const slug = slugify(title);

  const meta: RecordMeta = { id, slug, title, date, category: category as RecordMeta["category"], summary, format, visibility: "private" };
  await writeRecord(meta, content, username);
  revalidatePath("/");
  revalidatePath("/orchestration");
}

export async function updateRecord(id: string, formData: FormData) {
  const username = await requireAuth();
  const title = formData.get("title") as string;
  const category = formData.get("category") as string;
  const summary = formData.get("summary") as string;
  const content = formData.get("content") as string;
  const format = formData.get("format") as "md" | "html";

  const existing = await getRecord(id, username);
  const slug = slugify(title);
  const meta: RecordMeta = {
    id, slug, title, date: existing?.meta.date || "",
    category: category as RecordMeta["category"], summary, format,
    visibility: existing?.meta.visibility || "private",
  };
  await writeRecord(meta, content, username);
  revalidatePath("/");
  revalidatePath("/orchestration");
}

export async function removeRecord(id: string) {
  const username = await requireAuth();
  await deleteRecord(id, username);
  revalidatePath("/");
  revalidatePath("/orchestration");
}

export async function getRecordAction(id: string) {
  const username = await requireAuth();
  return getRecord(id, username);
}