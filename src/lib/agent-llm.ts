import type { AgentConfig } from "./agent-config";

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface LLMResult {
  finishReason: "stop" | "tool_calls" | "length";
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
}

const TIMEOUT_MS = 30_000;

/** 安全错误消息：不泄露 URL、Key */
export function safeError(status: number, fallback: string): string {
  switch (status) {
    case 401: return "认证失败 — API Key 无效或已过期，请在设置中检查。";
    case 403: return "无权限 — 该 API Key 无权访问此模型，请检查模型名称或 API Key 权限。";
    case 404: return "未找到模型 — 请检查 Base URL 和模型名称是否正确。";
    case 429: return "请求过于频繁 — 请稍后重试。";
    case 500: return "LLM 服务内部错误，请稍后重试。";
    case 502: return "LLM 服务网关错误，请稍后重试。";
    case 503: return "LLM 服务暂时不可用，请稍后重试。";
    default:
      // 清洗 fallback 中可能包含的敏感信息（API Key、URL、Bearer token）
      return fallback
        .replace(/sk-[a-zA-Z0-9]{10,}/g, "sk-***")
        .replace(/https?:\/\/[^\s]+/g, "[URL]")
        .replace(/Bearer\s+\S+/gi, "[REDACTED]");
  }
}

/** 清洗 baseUrl：去除首尾空格、末尾斜杠、反引号 */
function sanitizeBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/[`'"\s]/g, "")
    .replace(/\/+$/, "");
}

/** 调用 LLM 并流式输出，返回 finishReason + 累积的 tool_calls */
export async function callLLM(
  messages: ChatMessage[],
  tools: ToolDef[],
  config: AgentConfig,
  enqueue: (type: string, payload: Record<string, any>) => void,
): Promise<LLMResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const baseUrl = sanitizeBaseUrl(config.baseUrl);

  let llmRes: Response;
  try {
    llmRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        tools,
        tool_choice: "auto",
        stream: true,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("LLM 服务响应超时（30s），请检查网络或服务状态。");
    }
    throw new Error("无法连接到 LLM 服务 — 请检查 Base URL 和网络连接。");
  }
  clearTimeout(timeoutId);

  if (!llmRes.ok) {
    throw new Error(safeError(llmRes.status, `LLM 服务返回错误（${llmRes.status}），请稍后重试。`));
  }
  if (!llmRes.body) {
    throw new Error("LLM 服务返回空响应，请检查模型配置。");
  }

  const reader = llmRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason = "stop" as LLMResult["finishReason"];
  const toolCallsAcc: Record<number, { id: string; name: string; arguments: string }> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const chunk = JSON.parse(jsonStr);
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;
        if (delta?.content) {
          content += delta.content;
          enqueue("delta", { content: delta.content });
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallsAcc[idx]) {
              toolCallsAcc[idx] = { id: "", name: "", arguments: "" };
            }
            if (tc.id) toolCallsAcc[idx].id = tc.id;
            if (tc.function?.name) toolCallsAcc[idx].name += tc.function.name;
            if (tc.function?.arguments) toolCallsAcc[idx].arguments += tc.function.arguments;
          }
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
      } catch {}
    }
  }

  const toolCalls = Object.values(toolCallsAcc).filter((tc) => tc.name);

  return { finishReason, content, toolCalls };
}