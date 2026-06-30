import { NextRequest } from "next/server";
import { getTool, initAgent } from "@/lib/agent-tools";

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
}

interface AgentConfig {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

let agentInitialized = false;

function llmCall(messages: ChatMessage[], config: AgentConfig, signal?: AbortSignal): Promise<Response> {
  const apiKey = config.apiKey || process.env.LLM_API_KEY || "";
  const baseUrl = (config.baseUrl || process.env.LLM_BASE_URL || "https://api.siliconflow.cn/v1").replace(/\/+$/, "");
  const model = config.model || process.env.LLM_MODEL || "Qwen/Qwen2.5-7B-Instruct";

  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 2048,
    }),
    signal,
  });
}

const SYSTEM_PROMPT = `You are a helpful knowledge assistant for 知忆 (Zhiyi), a personal knowledge base system.

You have access to these tools:
- search_kb: Hybrid search (keyword + vector semantic) in the knowledge base
- get_record: Get full content of a record by ID
- summarize: Summarize a record
- stats: Get knowledge base statistics
- search_skill: Search for skills/tutorials on web and GitHub
- fetch_skill: Download a skill from a GitHub URL (returns file list)
- import_skill: Download and import a skill from a GitHub URL into the knowledge base
- ask_kb: RAG question answering with source context

When the user asks a question, decide if you need to use a tool. If so, respond with a JSON block:
{"tool": "tool_name", "args": {...}}

Workflow for importing skills:
1. User asks to find a skill → use search_skill
2. Show results to user, ask which one to import
3. User picks one → use import_skill with the GitHub URL
4. Report import results

For RAG questions, use ask_kb first to get relevant context, then answer based on it.
After getting the tool result, answer the user naturally in Chinese.
If no tool is needed, just answer directly.

Keep answers concise and helpful.`;

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!agentInitialized) {
          await initAgent();
          agentInitialized = true;
        }

        const body = await request.json();
        const { message, history = [], agentConfig = {} } = body as {
          message: string;
          history: ChatMessage[];
          agentConfig: AgentConfig;
        };

        const config: AgentConfig = {
          baseUrl: agentConfig.baseUrl || undefined,
          apiKey: agentConfig.apiKey || undefined,
          model: agentConfig.model || undefined,
        };

        const messages: ChatMessage[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...history,
          { role: "user", content: message },
        ];

        const MAX_ROUNDS = 3;
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const lastMsg = messages[messages.length - 1];
          const text = lastMsg.content;

          const toolMatch = text.match(/\{"tool":\s*"([^"]+)",\s*"args":\s*(\{[\s\S]*?\})\}/);
          if (!toolMatch) break;

          const toolName = toolMatch[1];
          let args: Record<string, any> = {};
          try { args = JSON.parse(toolMatch[2]); } catch {}

          const tool = getTool(toolName);
          if (!tool) {
            messages.push({ role: "assistant", content: `Unknown tool: ${toolName}` });
            break;
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "tool", name: toolName })}\n\n`));

          let result: any;
          try {
            result = await tool.execute(args);
          } catch (err: any) {
            result = { error: err.message };
          }

          if (toolName === "ask_kb" && result.context) {
            const contextMsg: ChatMessage = {
              role: "system",
              content: `Here is relevant context from the knowledge base to answer the user's question:\n\n${result.context}\n\nAnswer the user's question based on this context. Cite sources like [k1] when using information. If the context doesn't contain enough information, say so.`,
            };
            messages.push(contextMsg);
            continue;
          }

          messages.push({
            role: "tool",
            content: JSON.stringify(result),
            tool_call_id: toolName,
            name: toolName,
          });

          const llmRes = await llmCall(messages, config);
          if (!llmRes.ok || !llmRes.body) {
            messages.push({ role: "assistant", content: "LLM call failed" });
            break;
          }

          const reader = llmRes.body.getReader();
          let buffer = "";
          let fullContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += new TextDecoder().decode(value);

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const chunk = JSON.parse(jsonStr);
                const delta = chunk.choices?.[0]?.delta?.content || "";
                if (delta) {
                  fullContent += delta;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`));
                }
              } catch {}
            }
          }

          messages.push({ role: "assistant", content: fullContent });
        }

        const finalMsg = messages[messages.length - 1];
        if (finalMsg.role === "user" || finalMsg.role === "tool") {
          const llmRes = await llmCall(messages, config);
          if (llmRes.ok && llmRes.body) {
            const reader = llmRes.body.getReader();
            let buffer = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += new TextDecoder().decode(value);
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.slice(6).trim();
                if (jsonStr === "[DONE]") continue;
                try {
                  const chunk = JSON.parse(jsonStr);
                  const delta = chunk.choices?.[0]?.delta?.content || "";
                  if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content: delta })}\n\n`));
                } catch {}
              }
            }
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      } catch (err: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", content: err.message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
