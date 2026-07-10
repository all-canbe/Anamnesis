import { getTags, addTag, deleteTag } from "@/lib/content";
import { verifyRequestAuth, unauthorizedResponse } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();
  const tags = await getTags(username);
  return NextResponse.json(tags);
}

export async function POST(request: Request) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();
  try {
    const { key, label, icon, color } = await request.json();
    if (!key || !label) {
      return NextResponse.json({ error: "key and label are required" }, { status: 400 });
    }
    await addTag(key, label, icon || "ai", color || "#3b82f6", username);
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
    await deleteTag(key, username);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
