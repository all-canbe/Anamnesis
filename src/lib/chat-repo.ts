/**
 * Agent 会话历史数据访问层
 * 所有函数依赖 runWithUserId 注入的请求上下文获取 user_id
 * 强制 WHERE user_id = ? 实现用户隔离
 */

import { query } from "./turso";
import { getCurrentUserId } from "./request-context";
import type { ChatMessage } from "./chat-store";

export interface ChatSessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

function requireUserId(): string {
  const userId = getCurrentUserId();
  if (!userId) throw new Error("未在请求上下文中找到 userId");
  return userId;
}

/** 校验会话归属当前用户，不属于则抛错（不区分不存在与越权，避免泄露存在性） */
async function assertSessionOwned(sessionId: string): Promise<void> {
  const userId = requireUserId();
  const rows = await query(
    "SELECT 1 FROM chat_sessions WHERE id = ? AND user_id = ? LIMIT 1",
    [sessionId, userId]
  );
  if (rows.length === 0) {
    throw new SessionNotFoundError(sessionId);
  }
}

export class SessionNotFoundError extends Error {
  constructor(public readonly sessionId: string) {
    super(`会话不存在或无权访问: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}

/** 列出当前用户的会话（仅元数据，不含消息） */
export async function listSessions(limit = 50): Promise<ChatSessionMeta[]> {
  const userId = requireUserId();
  const rows = await query(
    "SELECT id, title, created_at, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?",
    [userId, limit]
  );
  return rows.map((row: any) => ({
    id: row[0],
    title: row[1],
    createdAt: new Date(row[2]).getTime(),
    updatedAt: new Date(row[3]).getTime(),
  }));
}

/** 获取会话内全部消息（按 seq 升序） */
export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  await assertSessionOwned(sessionId);
  const rows = await query(
    "SELECT role, content, tool_call_id, tool_name, tool_calls_json, timestamp FROM chat_messages WHERE session_id = ? ORDER BY seq ASC",
    [sessionId]
  );
  return rows.map((row: any) => {
    const msg: ChatMessage = { role: row[0], content: row[1] };
    if (row[2]) {
      msg.toolCallId = row[2];
      msg.tool_call_id = row[2]; // LLM API 兼容
    }
    if (row[3]) {
      msg.toolName = row[3];
      msg.name = row[3]; // LLM API 兼容
    }
    if (row[4]) {
      try {
        msg.tool_calls = JSON.parse(row[4]);
      } catch {}
    }
    if (row[5]) msg.timestamp = row[5];
    return msg;
  });
}

/** 创建会话（INSERT OR IGNORE 防重复，客户端可乐观生成 id） */
export async function createSession(id: string, title = "新对话"): Promise<void> {
  const userId = requireUserId();
  await query(
    "INSERT OR IGNORE INTO chat_sessions (id, user_id, title) VALUES (?, ?, ?)",
    [id, userId, title]
  );
}

/** 重命名会话 */
export async function renameSession(id: string, title: string): Promise<void> {
  await assertSessionOwned(id);
  await query(
    "UPDATE chat_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?",
    [title, id]
  );
}

/** 删除会话（消息由外键级联删除） */
export async function deleteSession(id: string): Promise<void> {
  await assertSessionOwned(id);
  // 先删消息再删会话，避免部分 Turso HTTP 端未启用外键级联
  await query("DELETE FROM chat_messages WHERE session_id = ?", [id]);
  await query("DELETE FROM chat_sessions WHERE id = ?", [id]);
}

/** 清空会话消息但保留空会话 */
export async function clearSessionMessages(id: string): Promise<void> {
  await assertSessionOwned(id);
  await query("DELETE FROM chat_messages WHERE session_id = ?", [id]);
  await query(
    "UPDATE chat_sessions SET title = '新对话', updated_at = datetime('now') WHERE id = ?",
    [id]
  );
}

/** 追加单条消息，seq 自动递增 */
export async function appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
  await assertSessionOwned(sessionId);
  const seqRows = await query(
    "SELECT COALESCE(MAX(seq), 0) FROM chat_messages WHERE session_id = ?",
    [sessionId]
  );
  const nextSeq = (seqRows[0]?.[0] || 0) + 1;
  const toolCallsJson = message.tool_calls ? JSON.stringify(message.tool_calls) : null;
  await query(
    `INSERT INTO chat_messages (session_id, role, content, tool_call_id, tool_name, tool_calls_json, timestamp, seq)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      message.role,
      message.content,
      message.toolCallId || message.tool_call_id || null,
      message.toolName || message.name || null,
      toolCallsJson,
      message.timestamp || Date.now(),
      nextSeq,
    ]
  );
  // 首条用户消息自动更新会话标题
  if (nextSeq === 1 && message.role === "user") {
    const title = message.content.slice(0, 30) + (message.content.length > 30 ? "..." : "");
    await query(
      "UPDATE chat_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?",
      [title, sessionId]
    );
  } else {
    await query(
      "UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?",
      [sessionId]
    );
  }
}
