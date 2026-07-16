import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth, unauthorizedResponse } from "@/lib/api-auth";
import { runWithUserId } from "@/lib/request-context";
import { listSessions, createSession } from "@/lib/chat-repo";

/** GET /api/agent/sessions — 当前用户会话列表（仅元数据） */
export async function GET(request: NextRequest) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();
  try {
    const sessions = await runWithUserId(username, () => listSessions());
    return NextResponse.json({ sessions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "加载会话失败" }, { status: 500 });
  }
}

/** POST /api/agent/sessions — 创建新会话 { id, title } */
export async function POST(request: NextRequest) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();
  try {
    const body = await request.json();
    const { id, title } = body as { id: string; title?: string };
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "缺少有效会话 id" }, { status: 400 });
    }
    await runWithUserId(username, () => createSession(id, title || "新对话"));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "创建会话失败" }, { status: 500 });
  }
}
