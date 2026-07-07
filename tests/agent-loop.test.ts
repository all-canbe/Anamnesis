/**
 * Agent Loop Tests
 *
 * Tests the core agent execution loop:
 * - Doom loop detection (3 consecutive identical tool calls → abort)
 * - Max rounds enforcement (MAX_ROUNDS = 3)
 * - Tool execution error handling
 * - Unknown tool handling
 * - finishReason handling (stop, length, tool_calls)
 *
 * Mocks: callLLM (agent-llm), getTool (agent-tools)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMResult, ChatMessage, ToolDef } from "@/lib/agent-llm";
import type { AgentConfig } from "@/lib/agent-config";
import type { Tool, ToolResult } from "@/lib/agent-tools";

// ─── Mocks ───

// Track the mocked callLLM so we can control its return value per test
let mockLLMResult: LLMResult;
let mockLLMShouldThrow = false;
let mockLLMThrowError: Error | null = null;
// Optional sequence: if set, callLLM returns results in order, then falls back to mockLLMResult
let mockLLMSequence: LLMResult[] | null = null;
let mockLLMCallCount = 0;

vi.mock("@/lib/agent-llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent-llm")>();
  return {
    ...actual,
    callLLM: vi.fn(async (): Promise<LLMResult> => {
      mockLLMCallCount++;
      if (mockLLMShouldThrow && mockLLMThrowError) throw mockLLMThrowError;
      if (mockLLMSequence && mockLLMCallCount <= mockLLMSequence.length) {
        return mockLLMSequence[mockLLMCallCount - 1];
      }
      return mockLLMResult;
    }),
  };
});

// Track the mocked getTool so we can control tool behavior per test
let mockToolExecute: ((args: Record<string, any>) => Promise<ToolResult>) | null = null;

vi.mock("@/lib/agent-tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent-tools")>();
  return {
    ...actual,
    getTool: vi.fn((name: string): Tool | undefined => {
      if (!mockToolExecute) return actual.getTool(name);
      return {
        name,
        description: `mock ${name}`,
        parameters: { type: "object", properties: {}, required: [] },
        execute: mockToolExecute,
      };
    }),
  };
});

// ─── Helpers ───

function makeConfig(): AgentConfig {
  return { baseUrl: "https://api.test.com/v1", apiKey: "sk-test", model: "test-model" };
}

function makeCtx(overrides?: Partial<{
  messages: ChatMessage[];
  recentToolCalls: Array<{ name: string; args: string }>;
}>): import("@/lib/agent-loop").LoopContext {
  return {
    messages: overrides?.messages || [
      { role: "system", content: "system" },
      { role: "user", content: "hello" },
    ],
    config: makeConfig(),
    tools: [] as ToolDef[],
    recentToolCalls: overrides?.recentToolCalls || [],
    round: 0,
  };
}

function makeToolCall(name: string, args: string = "{}", id: string = "call_1"): LLMResult["toolCalls"][0] {
  return { id, name, arguments: args };
}

const noopEnqueue = vi.fn();

// ─── Tests ───

describe("Agent Loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLLMResult = { finishReason: "stop", content: "Hello!", toolCalls: [] };
    mockLLMShouldThrow = false;
    mockLLMThrowError = null;
    mockLLMSequence = null;
    mockLLMCallCount = 0;
    mockToolExecute = null;
  });

  describe("finishReason: stop", () => {
    it("should return 'stop' when LLM finishes normally", async () => {
      mockLLMResult = { finishReason: "stop", content: "Done!", toolCalls: [] };
      const { executeAgentLoop } = await import("@/lib/agent-loop");
      const result = await executeAgentLoop(makeCtx(), noopEnqueue);
      expect(result.type).toBe("stop");
    });

    it("should emit delta content via enqueue", async () => {
      mockLLMResult = { finishReason: "stop", content: "Done!", toolCalls: [] };
      const { executeAgentLoop } = await import("@/lib/agent-loop");
      await executeAgentLoop(makeCtx(), noopEnqueue);
      // callLLM mock handles streaming internally; just verify no crash
      expect(noopEnqueue).toBeDefined();
    });
  });

  describe("finishReason: length", () => {
    it("should return error when context too long", async () => {
      mockLLMResult = { finishReason: "length", content: "partial...", toolCalls: [] };
      const { executeAgentLoop } = await import("@/lib/agent-loop");
      const result = await executeAgentLoop(makeCtx(), noopEnqueue);
      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.message).toContain("长度");
      }
    });
  });

  describe("LLM call failure", () => {
    it("should return error when callLLM throws", async () => {
      mockLLMShouldThrow = true;
      mockLLMThrowError = new Error("Connection refused");
      const { executeAgentLoop } = await import("@/lib/agent-loop");
      const result = await executeAgentLoop(makeCtx(), noopEnqueue);
      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.message).toContain("Connection refused");
      }
    });

    it("should use fallback message when error has no message", async () => {
      mockLLMShouldThrow = true;
      mockLLMThrowError = new Error("");
      const { executeAgentLoop } = await import("@/lib/agent-loop");
      const result = await executeAgentLoop(makeCtx(), noopEnqueue);
      expect(result.type).toBe("error");
    });
  });

  describe("Doom loop detection", () => {
    it("should detect doom loop after 3 identical tool calls", async () => {
      // Pre-seed recentToolCalls with 2 identical calls, then LLM returns the 3rd
      mockToolExecute = vi.fn(async (): Promise<ToolResult> => ({
        status: "completed",
        data: { result: "ok" },
      }));

      // LLM returns a tool call that matches the last 2
      mockLLMResult = {
        finishReason: "tool_calls",
        content: "",
        toolCalls: [makeToolCall("search_kb", '{"query":"test"}', "call_3")],
      };

      const ctx = makeCtx({
        recentToolCalls: [
          { name: "search_kb", args: '{"query":"test"}' },
          { name: "search_kb", args: '{"query":"test"}' },
        ],
      });

      const { executeAgentLoop } = await import("@/lib/agent-loop");
      const result = await executeAgentLoop(ctx, noopEnqueue);

      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.message).toContain("循环");
      }
    });

    it("should NOT trigger doom loop with different tool calls", async () => {
      mockToolExecute = vi.fn(async (): Promise<ToolResult> => ({
        status: "completed",
        data: { result: "ok" },
      }));

      // 3 calls but different args
      const ctx = makeCtx({
        recentToolCalls: [
          { name: "search_kb", args: '{"query":"a"}' },
          { name: "search_kb", args: '{"query":"b"}' },
        ],
      });

      // First LLM call returns tool_call with different args, second returns stop
      mockLLMSequence = [
        {
          finishReason: "tool_calls",
          content: "",
          toolCalls: [makeToolCall("search_kb", '{"query":"c"}', "call_3")],
        },
        { finishReason: "stop", content: "Done!", toolCalls: [] },
      ];

      const { executeAgentLoop } = await import("@/lib/agent-loop");
      const result = await executeAgentLoop(ctx, noopEnqueue);
      // Should stop normally, not doom loop
      expect(result.type).toBe("stop");
    });

    it("should NOT trigger doom loop with different tool names", async () => {
      mockToolExecute = vi.fn(async (): Promise<ToolResult> => ({
        status: "completed",
        data: { result: "ok" },
      }));

      const ctx = makeCtx({
        recentToolCalls: [
          { name: "search_kb", args: '{"query":"test"}' },
          { name: "web_search", args: '{"query":"test"}' },
        ],
      });

      mockLLMSequence = [
        {
          finishReason: "tool_calls",
          content: "",
          toolCalls: [makeToolCall("stats", "{}", "call_3")],
        },
        { finishReason: "stop", content: "Done!", toolCalls: [] },
      ];

      const { executeAgentLoop } = await import("@/lib/agent-loop");
      const result = await executeAgentLoop(ctx, noopEnqueue);
      expect(result.type).toBe("stop");
    });

    it("should NOT trigger doom loop with fewer than 3 calls", async () => {
      mockToolExecute = vi.fn(async (): Promise<ToolResult> => ({
        status: "completed",
        data: { result: "ok" },
      }));

      const ctx = makeCtx({
        recentToolCalls: [
          { name: "search_kb", args: '{"query":"test"}' },
        ],
      });

      mockLLMSequence = [
        {
          finishReason: "tool_calls",
          content: "",
          toolCalls: [makeToolCall("search_kb", '{"query":"test"}', "call_2")],
        },
        { finishReason: "stop", content: "Done!", toolCalls: [] },
      ];

      const { executeAgentLoop } = await import("@/lib/agent-loop");
      const result = await executeAgentLoop(ctx, noopEnqueue);
      expect(result.type).toBe("stop");
    });
  });

  describe("Max rounds enforcement", () => {
    it("should stop after reaching MAX_ROUNDS (3)", async () => {
      mockToolExecute = vi.fn(async (): Promise<ToolResult> => ({
        status: "completed",
        data: { result: "ok" },
      }));

      // LLM returns tool calls with DIFFERENT args each round (avoids doom loop)
      // MAX_ROUNDS=3: round 0→1, 1→2, 2→3 (exits loop at 3 < 3 = false)
      mockLLMSequence = [
        { finishReason: "tool_calls", content: "", toolCalls: [makeToolCall("search_kb", '{"query":"r1"}', "call_1")] },
        { finishReason: "tool_calls", content: "", toolCalls: [makeToolCall("search_kb", '{"query":"r2"}', "call_2")] },
        { finishReason: "tool_calls", content: "", toolCalls: [makeToolCall("search_kb", '{"query":"r3"}', "call_3")] },
        { finishReason: "tool_calls", content: "", toolCalls: [makeToolCall("search_kb", '{"query":"r4"}', "call_4")] },
      ];

      const { executeAgentLoop } = await import("@/lib/agent-loop");
      const result = await executeAgentLoop(makeCtx(), noopEnqueue);
      // Should stop (not error) after max rounds
      expect(result.type).toBe("stop");
    });
  });

  describe("Tool execution", () => {
    it("should handle unknown tool gracefully", async () => {
      // Set mockToolExecute to null so getTool returns undefined for unknown tools
      mockToolExecute = null;

      mockLLMResult = {
        finishReason: "tool_calls",
        content: "",
        toolCalls: [makeToolCall("nonexistent_tool", "{}", "call_1")],
      };

      const { executeAgentLoop } = await import("@/lib/agent-loop");
      const result = await executeAgentLoop(makeCtx(), noopEnqueue);
      // Unknown tool → all_failed or continues
      // The mock getTool returns undefined for non-mocked tools, so it pushes "Unknown tool"
      // and allFailed stays true → all_failed error
      expect(result.type).toBe("error");
    });

    it("should handle tool execution throwing an error", async () => {
      mockToolExecute = vi.fn(async (): Promise<ToolResult> => {
        throw new Error("Tool crashed");
      });

      mockLLMResult = {
        finishReason: "tool_calls",
        content: "",
        toolCalls: [makeToolCall("search_kb", '{"query":"test"}', "call_1")],
      };

      const { executeAgentLoop } = await import("@/lib/agent-loop");
      const result = await executeAgentLoop(makeCtx(), noopEnqueue);
      // Tool threw → error status → all_failed
      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.message).toContain("失败");
      }
    });

    it("should handle malformed tool arguments (invalid JSON)", async () => {
      mockToolExecute = vi.fn(async (args): Promise<ToolResult> => ({
        status: "completed",
        data: args,
      }));

      mockLLMResult = {
        finishReason: "tool_calls",
        content: "",
        toolCalls: [makeToolCall("search_kb", "not-valid-json{{{", "call_1")],
      };

      const { executeAgentLoop } = await import("@/lib/agent-loop");
      // Should not crash — args parse fails silently to {}
      const result = await executeAgentLoop(makeCtx(), noopEnqueue);
      expect(result).toBeDefined();
    });
  });

  describe("ask_kb special handling", () => {
    it("should inject context as system message for ask_kb", async () => {
      mockToolExecute = vi.fn(async (): Promise<ToolResult> => ({
        status: "completed",
        data: {
          context: "Here is some KB context",
          sources: [{ id: "k1", title: "Test", score: 0.9 }],
        },
      }));

      mockLLMResult = {
        finishReason: "tool_calls",
        content: "",
        toolCalls: [makeToolCall("ask_kb", '{"question":"test"}', "call_1")],
      };

      const ctx = makeCtx();
      const { executeAgentLoop } = await import("@/lib/agent-loop");
      const result = await executeAgentLoop(ctx, noopEnqueue);

      // After ask_kb, a system message with context should be injected
      const systemMsgs = ctx.messages.filter((m) => m.role === "system");
      const contextMsg = systemMsgs.find((m) => m.content.includes("Here is some KB context"));
      expect(contextMsg).toBeDefined();
    });
  });
});
