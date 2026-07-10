import { getCategories, getPublicCategories, addCategory, deleteCategory } from "@/lib/content";
import { verifyRequestAuth, unauthorizedResponse } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "public";

  if (mode === "public") {
    const categories = await getPublicCategories();
    return NextResponse.json(categories);
  }

  // mode === "private" 需认证
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();
  const categories = await getCategories(username);
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();
  try {
    const { key, label, label_en, icon, color, isPublic } = await request.json();
    if (!key || !label) {
      return NextResponse.json({ error: "key and label are required" }, { status: 400 });
    }
    await addCategory(key, label, label_en || "", icon || "ai", color || "#3b82f6", !!isPublic, username);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();
  try {
    const { key } = await request.json();
    if (!key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }
    await deleteCategory(key, username);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
