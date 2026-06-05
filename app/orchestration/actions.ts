"use server";

import { revalidatePath } from "next/cache";
import { writeRecord, deleteRecord, generateId, getRecord } from "@/lib/content";
import { slugify } from "@/lib/utils";
import type { RecordMeta } from "@/lib/types";

export async function getRecordData(id: string) {
  return getRecord(id);
}

export async function createRecord(formData: FormData) {
  const title = formData.get("title") as string;
  const category = formData.get("category") as string;
  const date = formData.get("date") as string;
  const summary = formData.get("summary") as string;
  const content = formData.get("content") as string;
  const format = formData.get("format") as "md" | "html";

  const id = generateId();
  const slug = slugify(title);

  const meta: RecordMeta = { id, slug, title, date, category: category as RecordMeta["category"], summary, format };
  await writeRecord(meta, content);
  revalidatePath("/");
  revalidatePath("/orchestration");
}

export async function updateRecord(id: string, formData: FormData) {
  const title = formData.get("title") as string;
  const category = formData.get("category") as string;
  const summary = formData.get("summary") as string;
  const content = formData.get("content") as string;
  const format = formData.get("format") as "md" | "html";

  const slug = slugify(title);
  const meta: RecordMeta = { id, slug, title, date: "", category: category as RecordMeta["category"], summary, format };
  await writeRecord(meta, content);
  revalidatePath("/");
  revalidatePath("/orchestration");
}

export async function removeRecord(id: string) {
  await deleteRecord(id);
  revalidatePath("/");
  revalidatePath("/orchestration");
}