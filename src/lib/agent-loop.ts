import type { AgentConfig } from "./agent-config";
import type { ChatMessage, ToolDef, LLMResult } from "./agent-llm";
import { callLLM, safeError } from "./agent-llm";
import { getTool } from "./agent-tools";

// ─── 类型定义 ───

/** 执行结果（参考 opencode 的 Result 类型） */
export type LoopResult =
  | { type: "stop" }                        // 任务完成
  | { type: "error"; message: string }      // 错误终止
  | { type: "compact" }                     // 需要压缩（预留）

/** 执行上下文 */
export interface LoopContext {
  messages: ChatMessage[];
  config: AgentConfig;
  tools: ToolDef[];
  recentToolCalls: Array<{ name: string; args: string }>;
  round: number;
}

// ─── 常量 ───

const MAX_ROUNDS = 5;
const DOOM_LOOP_THRESHOLD = 3;

// ─── Doom Loop 检测 ───

/** 规范化 args：递归排序 key 后 stringify，消除 key 顺序/空白差异 */
function normalizeArgs(args: string): string {
  try {
    const sortKeys = (val: unknown): unknown => {
      if (Array.isArray(val)) return val.map(sortKeys);
      if (val && typeof val === "object") {
        const sorted: Record<string, unknown> = {};
        for (const k of Object.keys(val as Record<string, unknown>).sort()) {
          sorted[k] = sortKeys((val as Record<string, unknown>)[k]);
        }
        return sorted;
      }
      return val;
    };
    return JSON.stringify(sortKeys(JSON.parse(args)));
  } catch {
    return args;
  }
}

function isDoomLoop(recentCalls: Array<{ name: string; args: string }>): boolean {
  if (recentCalls.length < DOOM_LOOP_THRESHOLD) return false;
  const last = recentCalls[recentCalls.length - 1];
  const lastName = last.name;
  const lastArgs = normalizeArgs(last.args);
  return recentCalls.slice(-DOOM_LOOP_THRESHOLD).every(
    (call) => call.name === lastName && normalizeArgs(call.args) === lastArgs,
  );
}

// ─── 工具执行 ───

type ToolExecResult = "ok" | "doom_loop" | "all_failed";

async function executeTools(
  ctx: LoopContext,
  toolCalls: LLMResult["toolCalls"],
  enqueue: (type: string, payload: Record<string, any>) => void,
): Promise<ToolExecResult> {
  enqueue("tool", { name: toolCalls.map((tc) => tc.name).join(", ") });

  let allFailed = true;

  for (const tc of toolCalls) {
    // doom loop 检测
    ctx.recentToolCalls.push({ name: tc.name, args: tc.arguments });
    if (isDoomLoop(ctx.recentToolCalls)) {
      return "doom_loop";
    }

    // 工具开始
    enqueue("tool_start", { id: tc.id, name: tc.name });

    let args: Record<string, any> = {};
    try {
      args = JSON.parse(tc.arguments);
    } catch {}

    const tool = getTool(tc.name);
    if (!tool) {
      ctx.messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: `Unknown tool: ${tc.name}`,
      });
      enqueue("tool_end", { id: tc.id, name: tc.name, status: "error" });
      continue;
    }

    // 执行工具
    let toolResult: any;
    try {
      toolResult = await tool.execute(args);
    } catch (err: any) {
      toolResult = { status: "error", error: err.message, data: null };
    }

    // 统一为 ToolResult 格式
    const result = toolResult?.status
      ? toolResult
      : { status: "completed", data: toolResult };

    // 特殊处理 ask_kb：注入上下文
    if (tc.name === "ask_kb" && result.data?.context) {
      ctx.messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result.data),
      });
      ctx.messages.push({
        role: "system",
        content: `Here is relevant context from the knowledge base to answer the user's question:\n\n${result.data.context}\n\nAnswer the user's question based on this context. Cite sources like [k1] when using information. If the context doesn't contain enough information, say so.`,
      });
      allFailed = false;
      enqueue("tool_end", { id: tc.id, name: tc.name, status: "completed" });
    } else if (result.status === "error") {
      ctx.messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify({ error: result.error }),
      });
      enqueue("tool_end", { id: tc.id, name: tc.name, status: "error" });
    } else {
      ctx.messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result.data ?? result),
      });
      allFailed = false;
      enqueue("tool_end", { id: tc.id, name: tc.name, status: "completed" });
    }
  }

  enqueue("tool_done", { count: toolCalls.length });

  return allFailed ? "all_failed" : "ok";
}

// ─── 核心循环 ───

/**
 * Agent 执行循环
 *
 * 参考 opencode SessionProcessor.process() 的设计：
 * - 每轮调用 LLM，根据 finishReason 决定继续/停止
 * - 工具调用有完整的状态机：pending → running → completed/error
 * - doom loop 检测：连续 3 次相同工具+参数 → 终止
 * - 返回 LoopResult 明确告知上层发生了什么
 *
 * 完成条件（任一满足即终止）：
 *   1. finishReason === "stop" → LLM 确认完成
 *   2. round >= MAX_ROUNDS → 达到最大轮数
 *   3. doom loop 触发 → 安全终止
 *   4. 所有工具失败 → 无法继续
 *   5. finishReason === "length" → 上下文超长
 */
export async function executeAgentLoop(
  ctx: LoopContext,
  enqueue: (type: string, payload: Record<string, any>) => void,
): Promise<LoopResult> {
  while (ctx.round < MAX_ROUNDS) {
    // 1. 调用 LLM（捕获错误，转为 LoopResult）
    let result: LLMResult;
    try {
      result = await callLLM(ctx.messages, ctx.tools, ctx.config, enqueue);
    } catch (err: any) {
      return { type: "error", message: err.message || "LLM 调用失败，请重试。" };
    }

    // 2. finishReason === "stop" → LLM 确认任务完成
    if (result.finishReason === "stop") {
      if (result.content) {
        ctx.messages.push({ role: "assistant", content: result.content });
      } else {
        // LLM 返回空内容 → 追加提示重试一次（覆盖首轮和工具后两种场景）
        const hasNudge = ctx.messages.some(
          (m) => m.role === "system" && m.content.includes("给用户一个回复"),
        );
        if (!hasNudge) {
          ctx.messages.push({
            role: "system",
            content: ctx.recentToolCalls.length > 0
              ? "请基于上面的工具执行结果给用户一个回复。如果获取了网页内容，请总结或保存。"
              : "请给用户一个回复。如果用户的问题需要工具辅助，请调用合适的工具；如果可以直接回答，请直接回复。",
          });
          continue;
        }
        return { type: "error", message: "LLM 返回了空响应，请重试或检查模型配置。" };
      }
      return { type: "stop" };
    }

    // 3. finishReason === "length" → 上下文超长
    if (result.finishReason === "length") {
      ctx.messages.push({ role: "assistant", content: result.content || "(响应超出长度限制)" });
      return { type: "error", message: "响应超出长度限制，请简化问题后重试。" };
    }

    // 4. finishReason === "tool_calls" → 执行工具
    if (result.toolCalls.length > 0) {
      // 添加 assistant 消息（含 tool_calls 用于上下文）
      ctx.messages.push({
        role: "assistant",
        content: result.content || "",
      });

      const toolResult = await executeTools(ctx, result.toolCalls, enqueue);

      if (toolResult === "doom_loop") {
        return {
          type: "error",
          message: `检测到重复调用循环 — 已连续 ${DOOM_LOOP_THRESHOLD} 次相同调用，已中止。请换个方式提问。`,
        };
      }
      if (toolResult === "all_failed") {
        return { type: "error", message: "所有工具调用均失败，请检查知识库或重试。" };
      }

      ctx.round++;
      continue;
    }

    // 5. 无 tool_calls 但 finishReason 也不是 stop → 补 content 并终止
    if (result.content) {
      ctx.messages.push({ role: "assistant", content: result.content });
    }
    return { type: "stop" };
  }

  // 达到最大轮数
  return { type: "stop" };
}