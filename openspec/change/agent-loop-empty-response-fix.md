# Agent Loop 空回复修复

## 修改了什么
- 在 `src/lib/agent-loop.ts` 的 `executeAgentLoop` 函数中，`finishReason === "stop"` 分支增加了对"工具执行后 LLM 返回空内容"的兜底处理。
- 当 `ctx.recentToolCalls.length > 0` 且 `result.content` 为空时，追加一条 system message 提示 LLM 基于工具结果生成回复，然后 `continue` 重试一轮。
- 通过检测 `hasNudge` 避免重复添加死循环。

## 为何这样修改
- 部分 LLM 模型（如 DeepSeek、Qwen 等）在执行工具后，第二轮收到工具结果时，偶尔会返回 `finishReason: "stop"` 但 `content` 为空串。
- 原代码在 `content` 为 falsy 时直接 `return { type: "stop" }`，不 stream 任何文本给用户，导致对话静默结束。
- 用户看到 `tool_done` 事件后无任何后续响应，体验极差。

## 变更的意义
- 避免"工具执行成功但用户看不到任何回复"的 P0 级体验问题。
- 最多只重试一次，不会导致无限循环。

## 涉及文件
- `src/lib/agent-loop.ts`
