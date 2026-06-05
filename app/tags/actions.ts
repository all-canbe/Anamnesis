"use server";

import { revalidatePath } from "next/cache";
import { addTag, deleteTag, getTags } from "@/lib/content";

export async function createTag(formData: FormData) {
  const key = formData.get("key") as string;
  const label = formData.get("label") as string;
  const emoji = formData.get("emoji") as string;
  if (!key || !label) return { error: "Key and label are required" };
  await addTag(key.toLowerCase().replace(/[^a-z0-9]/g, "-"), label, emoji || "📌");
  revalidatePath("/tags");
}

export async function removeTag(key: string) {
  await deleteTag(key);
  revalidatePath("/tags");
}

export async function loadTags() {
  return getTags();
}