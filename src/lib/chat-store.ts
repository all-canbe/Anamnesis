// ─── Config ───

export interface CompactionConfig {
  contextWindow: number;                // LLM 上下文窗口大小 (默认 100K)
  compactionThresholdRatio: number;     // 触发压缩的窗口比例 (默认 0.8)
  outputHeadroom: number;              // 为模型输出预留 token
  compactionHeadroom: number;          // 为压缩操作预留 token
  microCompactToolCount: number;       // 工具调用数触发微压缩 (20)
  microCompactMinTokens: number;       // 微压缩最低 token 数 (20K)
  collapseMinTokens: number;           // 折叠触发下限 (30K)
  hotTailSize: number;                 // 保留最近 N 条工具结果 (3)
  hotTailTokens: number;               // 保留最近 N 条工具结果 token 上限 (40K)
  sessionMemoryMaxTokens: number;      // 摘要链最大 token 数 (8K)
  preferCacheStability: boolean;       // 是否优先保持 prefix cache 稳定
}

const DEFAULT_CONFIG: CompactionConfig = {
  contextWindow: 100_000,
  compactionThresholdRatio: 0.8,
  outputHeadroom: 4_000,
  compactionHeadroom: 2_000,
  microCompactToolCount: 20,
  microCompactMinTokens: 20_000,
  collapseMinTokens: 30_000,
  hotTailSize: 3,
  hotTailTokens: 40_000,
  sessionMemoryMaxTokens: 8_000,
  preferCacheStability: true,
};

// ─── Token estimate ───

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Message types ───

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
  timestamp?: number;
}

export interface TokenEstimate {
  system: number;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  total: number;
}

export function estimateTokensByRole(messages: ChatMessage[]): TokenEstimate {
  const est: TokenEstimate = { system: 0, userMessages: 0, assistantMessages: 0, toolCalls: 0, toolResults: 0, total: 0 };
  for (const m of messages) {
    const t = estimateTokens(m.content);
    if (m.role === "system") est.system += t;
    else if (m.role === "user") est.userMessages += t;
    else if (m.role === "assistant") est.assistantMessages += t;
    else if (m.role === "tool") {
      if (m.toolName) est.toolCalls += t;
      else est.toolResults += t;
    }
  }
  est.total = est.system + est.userMessages + est.assistantMessages + est.toolCalls + est.toolResults;
  return est;
}

// ─── Summary chain ───

class SummaryChain {
  private summaries: string[] = [];
  private maxTokens: number;

  constructor(maxTokens: number) {
    this.maxTokens = maxTokens;
  }

  add(summary: string): void {
    this.summaries.push(summary);
    while (this.tokenCount() > this.maxTokens && this.summaries.length > 1) {
      this.summaries.shift();
    }
  }

  merge(): string {
    return this.summaries.join("\n\n");
  }

  tokenCount(): number {
    return estimateTokens(this.merge());
  }

  get length(): number {
    return this.summaries.length;
  }
}

// ─── Compression level ───

export type CompressionLevel = "none" | "micro" | "collapse" | "session_memory" | "full";

// ─── Compression Pipeline ───

export interface CompactResult {
  compressed: ChatMessage[];
  level: CompressionLevel;
  reason: string;
  summary?: string;
}

export class CompactionPipeline {
  private config: CompactionConfig;
  private summaryChain: SummaryChain;

  constructor(config: CompactionConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.summaryChain = new SummaryChain(config.sessionMemoryMaxTokens);
  }

  shouldCompact(messages: ChatMessage[]): { should: boolean; reason: string; level: CompressionLevel } {
    const est = estimateTokensByRole(messages);
    const effectiveThreshold = this.config.contextWindow * this.config.compactionThresholdRatio;
    const toolCallCount = messages.filter((m) => m.role === "tool" && m.toolName).length;

    // Priority 1: tool calls exceed threshold
    if (toolCallCount >= this.config.microCompactToolCount && est.total >= this.config.microCompactMinTokens) {
      return { should: true, reason: `tool_calls=${toolCallCount} >= ${this.config.microCompactToolCount}`, level: "micro" };
    }

    // Priority 2: total tokens exceed threshold
    if (est.total >= effectiveThreshold) {
      if (est.total >= this.config.collapseMinTokens) {
        return { should: true, reason: `total=${est.total} >= collapse=${this.config.collapseMinTokens}`, level: "collapse" };
      }
      return { should: true, reason: `total=${est.total} >= threshold=${effectiveThreshold}`, level: "micro" };
    }

    // Priority 3: summary chain too long
    if (this.summaryChain.tokenCount() >= this.config.sessionMemoryMaxTokens) {
      return { should: true, reason: `summary_chain=${this.summaryChain.tokenCount()} >= ${this.config.sessionMemoryMaxTokens}`, level: "session_memory" };
    }

    return { should: false, reason: "", level: "none" };
  }

  compact(messages: ChatMessage[], level: CompressionLevel): CompactResult {
    const hotTail = this.getHotTail(messages);

    let result: CompactResult;

    switch (level) {
      case "micro":
        result = this.microCompact(messages, hotTail);
        break;
      case "collapse":
        result = this.collapseCompact(messages, hotTail);
        break;
      case "session_memory":
        result = this.sessionMemoryCompact(messages, hotTail);
        break;
      case "full":
        result = this.fullCompact(messages);
        break;
      default:
        return { compressed: messages, level: "none", reason: "no compression needed" };
    }

    if (result.level !== "none") {
      this.summaryChain.add(result.summary || result.reason);
    }

    return result;
  }

  private getHotTail(messages: ChatMessage[]): ChatMessage[] {
    const toolResults = messages.filter((m) => m.role === "tool" && !m.toolName);
    const hot: ChatMessage[] = [];
    let tokens = 0;

    for (let i = toolResults.length - 1; i >= 0 && hot.length < this.config.hotTailSize && tokens < this.config.hotTailTokens; i--) {
      hot.unshift(toolResults[i]);
      tokens += estimateTokens(toolResults[i].content);
    }

    return hot;
  }

  private microCompact(messages: ChatMessage[], hotTail: ChatMessage[]): CompactResult {
    const keepRecent = 10;
    const hotIds = new Set(hotTail.map((h) => h.content));

    const nonHot: ChatMessage[] = [];
    const recent: ChatMessage[] = [];

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (hotIds.has(m.content)) {
        recent.push(m);
      } else if (i >= messages.length - keepRecent) {
        recent.push(m);
      } else {
        nonHot.push(m);
      }
    }

    const compressed: ChatMessage[] = [
      {
        role: "system",
        content: `[系统已压缩 ${nonHot.length} 条历史消息，以节省上下文空间。压缩前的对话摘要：${this.summaryChain.merge() || "无"}]`,
      },
      ...recent,
    ];

    return {
      compressed,
      level: "micro",
      reason: `micro_compact: compressed ${nonHot.length} messages, kept ${recent.length}`,
      summary: `微压缩：移除了 ${nonHot.length} 条早期消息`,
    };
  }

  private collapseCompact(messages: ChatMessage[], hotTail: ChatMessage[]): CompactResult {
    const hotIds = new Set(hotTail.map((h) => h.content));
    const half = Math.floor(messages.length / 2);

    const toCollapse: ChatMessage[] = [];
    const toKeep: ChatMessage[] = [];

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (hotIds.has(m.content) || i >= half) {
        toKeep.push(m);
      } else {
        toCollapse.push(m);
      }
    }

    const compressed: ChatMessage[] = [
      {
        role: "system",
        content: `[系统已压缩 ${toCollapse.length} 条上下文消息。压缩前的对话摘要：${this.summaryChain.merge() || "无"}]`,
      },
      ...toKeep,
    ];

    return {
      compressed,
      level: "collapse",
      reason: `collapse_compact: collapsed ${toCollapse.length} messages, kept ${toKeep.length}`,
      summary: `上下文折叠：折叠了 ${toCollapse.length} 条消息`,
    };
  }

  private sessionMemoryCompact(messages: ChatMessage[], hotTail: ChatMessage[]): CompactResult {
    // Same as collapse for now; enhanced version would call LLM for structured summary
    return this.collapseCompact(messages, hotTail);
  }

  private fullCompact(messages: ChatMessage[]): CompactResult {
    const last = messages[messages.length - 1];

    const compressed: ChatMessage[] = [
      {
        role: "system",
        content: `[系统已压缩全部 ${messages.length - 1} 条消息。完整对话摘要：${this.summaryChain.merge() || "无"}]`,
      },
      last,
    ];

    return {
      compressed,
      level: "full",
      reason: `full_compact: compressed all ${messages.length - 1} messages`,
      summary: `全量压缩：压缩了全部 ${messages.length - 1} 条消息`,
    };
  }

  getSummaryChain(): string {
    return this.summaryChain.merge();
  }
}

// ─── Context Manager ───

export class ContextManager {
  private pipeline: CompactionPipeline;
  private messages: ChatMessage[] = [];
  private compactedCount = 0;

  constructor(config: CompactionConfig = DEFAULT_CONFIG) {
    this.pipeline = new CompactionPipeline(config);
  }

  addMessage(msg: ChatMessage): void {
    this.messages.push({ ...msg, timestamp: Date.now() });
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  async maybeCompact(): Promise<CompactResult | null> {
    const { should, reason, level } = this.pipeline.shouldCompact(this.messages);
    if (!should) return null;

    const result = this.pipeline.compact(this.messages, level);
    this.messages = result.compressed;
    this.compactedCount++;
    return result;
  }

  getCompactedCount(): number {
    return this.compactedCount;
  }

  getSummaryChain(): string {
    return this.pipeline.getSummaryChain();
  }
}

// ─── Session storage ───

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "zhiyi-chat-sessions";
const MAX_SESSIONS = 20;

// 单调递增版本号，防止多标签页间的 localStorage 旧数据覆盖新数据
let _version = 0;

function generateId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 兼容旧格式：旧版是数组，新版是 { _version, sessions }
      if (Array.isArray(parsed)) {
        _version = 0;
        return parsed;
      }
      _version = parsed._version || 0;
      return parsed.sessions || [];
    }
  } catch {}
  return [];
}

export function saveSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    // 检查版本号：如果 localStorage 已有更新的数据，跳过本次写入
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) && (parsed._version || 0) > _version) {
        return; // 其他标签页已写入更新版本，放弃本次写入
      }
    }
    _version++;
    const data = { _version, sessions: sessions.slice(0, MAX_SESSIONS) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    try {
      const trimmed = sessions.slice(-5).map((s) => ({ ...s, messages: s.messages.slice(-4) }));
      const data = { _version, sessions: trimmed };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }
}

export function createSession(title = "新对话"): ChatSession {
  return {
    id: generateId(),
    title,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function deleteSession(sessions: ChatSession[], id: string): ChatSession[] {
  return sessions.filter((s) => s.id !== id);
}

export function addMessage(sessions: ChatSession[], sessionId: string, message: ChatMessage): ChatSession[] {
  return sessions.map((s) => {
    if (s.id !== sessionId) return s;
    // 跳过连续重复消息（同角色、同内容）— 防御性去重
    const lastMsg = s.messages[s.messages.length - 1];
    if (lastMsg && lastMsg.role === message.role && lastMsg.content === message.content) {
      return s;
    }
    const messages = [...s.messages, { ...message, timestamp: Date.now() }];
    const title = s.messages.length === 0 && message.role === "user"
      ? message.content.slice(0, 30) + (message.content.length > 30 ? "..." : "")
      : s.title;
    return { ...s, messages, title, updatedAt: Date.now() };
  });
}

// ─── Public compression API ───

export function compressContext(messages: ChatMessage[]): ChatMessage[] {
  const pipeline = new CompactionPipeline();
  const { should, level } = pipeline.shouldCompact(messages);
  if (should) {
    const result = pipeline.compact(messages, level);
    return result.compressed;
  }
  return messages;
}

export function getContextForLLM(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= 10) return messages;

  const est = estimateTokensByRole(messages);
  const effectiveThreshold = DEFAULT_CONFIG.contextWindow * DEFAULT_CONFIG.compactionThresholdRatio;

  if (est.total < effectiveThreshold) return messages;

  return compressContext(messages);
}
