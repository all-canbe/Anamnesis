import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth, unauthorizedResponse } from "@/lib/api-auth";
import { runWithUserId } from "@/lib/request-context";
import {
  appendMessage,
  clearSessionMessages,
  SessionNotFoundError,
} from "@/lib/chat-repo";
import type { ChatMessage } from "@/lib/chat-store";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/** POST /api/agent/sessions/[id]/messages — 追加消息 */
export async function POST(request: NextRequest, ctx: RouteCtx) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    const { message } = body as { message: ChatMessage };
    if (!message || !message.role || typeof message.content !== "string") {
      return NextResponse.json({ error: "消息格式无效" }, { status: 400 });
    }
    await runWithUserId(username, () => appendMessage(id, message));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof SessionNotFoundError) {
      return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || "追加消息失败" }, { status: 500 });
  }
}

/** DELETE /api/agent/sessions/[id]/messages — 清空会话消息（保留空会话） */
export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();
  const { id } = await ctx.params;
  try {
    await runWithUserId(username, () => clearSessionMessages(id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof SessionNotFoundError) {
      return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || "清空失败" }, { status: 500 });
  }
}
