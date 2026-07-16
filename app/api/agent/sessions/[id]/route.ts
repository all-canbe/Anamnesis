import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth, unauthorizedResponse } from "@/lib/api-auth";
import { runWithUserId } from "@/lib/request-context";
import {
  getSessionMessages,
  renameSession,
  deleteSession,
  SessionNotFoundError,
} from "@/lib/chat-repo";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/** GET /api/agent/sessions/[id] — 返回该会话的消息列表 */
export async function GET(request: NextRequest, ctx: RouteCtx) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();
  const { id } = await ctx.params;
  try {
    const messages = await runWithUserId(username, () => getSessionMessages(id));
    return NextResponse.json({ messages });
  } catch (err: any) {
    if (err instanceof SessionNotFoundError) {
      return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || "加载消息失败" }, { status: 500 });
  }
}

/** PATCH /api/agent/sessions/[id] — 重命名 { title } */
export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    const { title } = body as { title: string };
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "缺少有效 title" }, { status: 400 });
    }
    await runWithUserId(username, () => renameSession(id, title));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof SessionNotFoundError) {
      return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || "重命名失败" }, { status: 500 });
  }
}

/** DELETE /api/agent/sessions/[id] — 删除会话 */
export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();
  const { id } = await ctx.params;
  try {
    await runWithUserId(username, () => deleteSession(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof SessionNotFoundError) {
      return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || "删除失败" }, { status: 500 });
  }
}
