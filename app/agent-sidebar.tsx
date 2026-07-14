"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/lib/language-context";
import { mdToHtml } from "@/lib/md-to-html";
import {
  type ChatMessage,
  type ChatSession,
  loadSessions,
  saveSessions,
  createSession,
  deleteSession,
  addMessage,
  getContextForLLM,
} from "@/lib/chat-store";
import {
  MenuIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  PlusIcon,
  TrashIcon,
  CopyIcon,
  BotIcon,
  UserIcon,
  CloseIcon,
  SparklesIcon,
  CheckIcon,
  BookOpenIcon,
} from "@/lib/icons";
import {
  type SlashCommand,
  filterCommands,
} from "@/lib/slash-commands";
import { SlashCommandPanel } from "./slash-panel";

function renderMarkdown(text: string): string {
  return mdToHtml(text);
}

function renderUserContent(content: string, commands: SlashCommand[]): { __html: string } {
    const text = content.trimStart();
    const sorted = [...commands].sort((a, b) => b.name.length - a.name.length);
    const matched = sorted.find((cmd) => text.startsWith(`/${cmd.name}`));
    if (!matched) return { __html: renderMarkdown(content) };
    const prefix = `/${matched.name}`;
    const rest = text.slice(prefix.length).trimStart();
    const pill = `<span class="agent-msg-command-pill">${prefix}</span>`;
    if (!rest) return { __html: pill };
    return { __html: `${pill} ${renderMarkdown(rest)}` };
  }

import type { CachedAgentConfig } from "./shell";

export function AgentSidebar({ open, onToggle, settingsConfig }: {
  open: boolean;
  onToggle: () => void;
  settingsConfig: CachedAgentConfig | null;
}) {
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [toolStatus, setToolStatus] = useState("");
  const [thinking, setThinking] = useState(false); // 等待首字响应
  const [errorMessage, setErrorMessage] = useState(""); // 持久化错误消息
  const errorRef = useRef(""); // ref 跟踪最新错误，避免闭包陷阱
  const [showSessionList, setShowSessionList] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [activeSlash, setActiveSlash] = useState<SlashCommand | null>(null);
  const [cursorAtStart, setCursorAtStart] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [slashCommands, setSlashCommands] = useState<SlashCommand[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const [textareaMaxHeight, setTextareaMaxHeight] = useState(120);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(300);

  const activeSession = sessions.find((s) => s.id === activeId);
  const messages = activeSession?.messages || [];

  useEffect(() => {
    const loaded = loadSessions();
    if (loaded.length === 0) {
      const fresh = createSession();
      setSessions([fresh]);
      setActiveId(fresh.id);
    } else {
      setSessions(loaded);
      setActiveId(loaded[0].id);
    }
  }, []);

  useEffect(() => {
    fetch("/api/skills")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.commands)) {
          setSlashCommands(data.commands);
        }
      })
      .catch(() => {
        setSlashCommands([]);
      });
  }, []);

  useEffect(() => {
    if (sessions.length > 0) saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  // ResizeObserver: 动态计算 textarea 最大高度 = .agent-messages 的 40%
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setTextareaMaxHeight(Math.floor(el.clientHeight * 0.4));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 拖拽拉宽侧边栏
  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(e: MouseEvent) {
      const delta = dragStartX.current - e.clientX; // 向左拖 = 变宽
      const newWidth = Math.max(280, Math.min(600, dragStartWidth.current + delta));
      setSidebarWidth(newWidth);
    }

    function handleMouseUp() {
      setIsDragging(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
  }

  function switchSession(id: string) {
    setActiveId(id);
    setShowSessionList(false);
    setShowClearConfirm(false);
  }

  function handleNewSession() {
    const fresh = createSession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
  }

  function handleDeleteSession(id: string) {
    const updated = deleteSession(sessions, id);
    setSessions(updated);
    if (activeId === id) {
      setActiveId(updated[0]?.id || createSession().id);
    }
  }

  function startRename(id: string, currentTitle: string) {
    setRenamingId(id);
    setRenameValue(currentTitle);
  }

  function confirmRename() {
    if (renamingId && renameValue.trim()) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === renamingId ? { ...s, title: renameValue.trim() } : s
        )
      );
    }
    setRenamingId(null);
  }

  function handleClearSession() {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId ? { ...s, messages: [], title: "新对话", updatedAt: Date.now() } : s
      )
    );
    setShowClearConfirm(false);
  }

  function handleCopyMessage(content: string) {
    navigator.clipboard.writeText(content);
  }

  // Extract knowledge base references from message content
  function extractSources(content: string): { id: string; label: string }[] {
    const matches = content.match(/\[k\d+\]/g);
    if (!matches) return [];
    return [...new Set(matches)].map((m) => ({ id: m.slice(1, -1), label: m }));
  }

  // 回滚：移除最后一条用户消息（用于 API 失败时恢复状态）
  const rollbackLastUserMsg = useCallback(() => {
    setSessions((prev) => {
      const session = prev.find((s) => s.id === activeId);
      if (!session || session.messages.length === 0) return prev;
      const msgs = session.messages.slice(0, -1);
      return prev.map((s) => (s.id === activeId ? { ...s, messages: msgs, updatedAt: Date.now() } : s));
    });
  }, [activeId]);

  const sendMessage = useCallback(async () => {
    if (sending) return;
    const body = input.trim();
    const text = activeSlash
      ? `${activeSlash.template.replace("{input}", body).trimEnd()}${body ? " " + body : ""}`.trim()
      : body;
    if (!text || streaming || !activeId) return;
    setSending(true);

    // 检查 API 配置（优先使用缓存，避免认证时序问题）
    if (settingsConfig !== null && !settingsConfig.configured) {
      setErrorMessage(t("agentNotConfigured"));
      errorRef.current = t("agentNotConfigured");
      setSending(false);
      return;
    }

    setInput("");
    setActiveSlash(null);

    const userMsg: ChatMessage = { role: "user", content: text };
    setSessions((prev) => addMessage(prev, activeId, userMsg));
    setStreaming(true);
    setStreamContent("");
    setToolStatus("");
    setThinking(true);
    setErrorMessage("");
    errorRef.current = "";

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      // 使用当前 state 构建 history，避免 localStorage 竞态
      const history = getContextForLLM(messages);

      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, skillId: activeSlash?.id ?? null }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        rollbackLastUserMsg();
        const msg = res.status === 401
          ? t("agentAuthFailed")
          : t("agentConnectionFailed");
        setStreamContent(msg);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "delta") {
              fullContent += data.content;
              setStreamContent(fullContent);
              setThinking(false);
              setToolStatus("");
            } else if (data.type === "tool_start") {
              setToolStatus(t("agentToolRunning").replace("{name}", data.name));
              setThinking(false);
            } else if (data.type === "tool_end") {
              if (data.status === "error") {
                setToolStatus(t("agentToolFailed").replace("{name}", data.name));
              } else {
                setToolStatus(t("agentWaitingForResponse"));
              }
            } else if (data.type === "tool" || data.type === "tool_done") {
              // 兼容旧事件
              if (data.type === "tool") setToolStatus(t("agentUsingTool").replace("{name}", data.name));
              else setToolStatus("");
            } else if (data.type === "done") {
              setToolStatus("");
              setThinking(false);
            } else if (data.type === "error") {
              setToolStatus("");
              setThinking(false);
              const errMsg = data.content || t("agentUnknownError");
              setErrorMessage(errMsg);
              errorRef.current = errMsg;
            }
          } catch {}
        }
      }

      if (fullContent) {
        const assistantMsg: ChatMessage = { role: "assistant", content: fullContent };
        setSessions((prev) => addMessage(prev, activeId, assistantMsg));
      } else if (!errorRef.current) {
        rollbackLastUserMsg();
        setErrorMessage(t("agentNoContent"));
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        rollbackLastUserMsg();
        setErrorMessage(t("agentNetworkError").replace("{message}", err.message));
      }
    } finally {
      setStreaming(false);
      setSending(false);
      abortRef.current = null;
    }
  }, [input, streaming, activeId, activeSlash, sending, settingsConfig, t, messages, rollbackLastUserMsg]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (slashOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => Math.min(i + 1, slashTotal - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const allItems = [..._cmds, ..._sk];
        if (allItems[slashIndex]) {
          handleSlashSelect(allItems[slashIndex]);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeSlash();
        return;
      }
      return;
    }

    if (e.key === "Backspace" && activeSlash && input === "") {
      e.preventDefault();
      setActiveSlash(null);
      return;
    }

    if (e.key === "/" && cursorAtStart) {
      e.preventDefault();
      if (activeSlash) setActiveSlash(null);
      setInput("/");
      setSlashOpen(true);
      setSlashIndex(0);
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending) sendMessage();
    }
  }

  function updateCursorAtStart() {
    const el = inputRef.current;
    if (!el) return;
    setCursorAtStart(el.selectionStart === 0);
  }

  const showWelcome = messages.length === 0 && !streaming;

  // Slash command filter: everything after the leading "/"
  const slashFilter = useMemo(() => {
    if (!slashOpen || !input.startsWith("/")) return "";
    return input.slice(1);
  }, [input, slashOpen]);

  const { commands: _cmds, skills: _sk } = useMemo(
    () => filterCommands(slashCommands, slashFilter),
    [slashCommands, slashFilter]
  );
  const slashTotal = _cmds.length + _sk.length;

  function handleSlashSelect(cmd: SlashCommand) {
    setActiveSlash(cmd);
    setInput("");
    setSlashOpen(false);
    setSlashIndex(0);
    inputRef.current?.focus();
  }

  function closeSlash() {
    setSlashOpen(false);
    setSlashIndex(0);
  }

  return (
    <aside className={`agent-sidebar${open ? "" : " collapsed"}`} style={{ width: open ? sidebarWidth : 40 }}>
      {open && (
        <div
          className="agent-resize-handle"
          onMouseDown={handleDragStart}
        />
      )}
      <div className="agent-sidebar-header">
        {open ? (
          <>
            <h4>
              <span className="agent-status-dot"></span>
              {t("agentTitle")}
            </h4>
            <div className="agent-header-actions">
              <button className="agent-header-btn icon-btn" onClick={() => setShowSessionList((v) => !v)} title={t("agentSessions")}>
                <MenuIcon size={14} />
              </button>
              <button className="agent-header-btn icon-btn" onClick={handleClearSession} title={showClearConfirm ? t("agentClickAgainConfirm") : t("agentClearConversation")}>
                {showClearConfirm ? <CheckIcon size={14} /> : <TrashIcon size={14} />}
              </button>
              {showClearConfirm && <span className="agent-clear-confirm-text">{t("agentClickAgain")}</span>}
              <button className="agent-sidebar-toggle icon-btn" onClick={onToggle} title={t("agentCollapse")}>
                <ChevronRightIcon size={14} />
              </button>
            </div>
          </>
        ) : (
          <button className="agent-sidebar-toggle collapsed icon-btn" onClick={onToggle} title={t("agentExpand")}>
            <ChevronLeftIcon size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="agent-sidebar-body">
          {showSessionList && (
            <div className="agent-session-list">
              <div className="agent-session-list-header">
                <span>{t("agentSessions")}</span>
                <button className="agent-session-new-btn icon-btn" onClick={handleNewSession}>
                  <PlusIcon size={14} />
                </button>
              </div>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`agent-session-item${s.id === activeId ? " active" : ""}`}
                  onClick={() => switchSession(s.id)}
                >
                  {renamingId === s.id ? (
                    <input
                      ref={renameInputRef}
                      className="agent-session-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={confirmRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmRename();
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="agent-session-title"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRename(s.id, s.title);
                      }}
                    >
                      {s.title}
                    </span>
                  )}
                  <button
                    className="agent-session-del icon-btn"
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                  >
                    <CloseIcon size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="agent-messages" ref={messagesRef}>
            {showWelcome && !showSessionList && (
              <div className="agent-welcome">
                <p>{t("agentWelcome")}</p>
                <ul>
                  <li>{t("agentFeature1")}</li>
                  <li>{t("agentFeature2")}</li>
                  <li>{t("agentFeature3")}</li>
                  <li>{t("agentFeature4")}</li>
                </ul>
              </div>
            )}

            {messages.map((msg, i) => {
              const sources = msg.role === "assistant" ? extractSources(msg.content) : [];
              return (
              <div key={i} className={`agent-msg agent-msg-${msg.role}`}>
                <div className="agent-msg-avatar">{msg.role === "assistant" ? <BotIcon size={16} /> : <UserIcon size={16} />}</div>
                <div className="agent-msg-content-wrap">
                  <div
                    className="agent-msg-content agent-msg-html"
                    dangerouslySetInnerHTML={msg.role === "user" ? renderUserContent(msg.content, slashCommands) : { __html: renderMarkdown(msg.content) }}
                  />
                  <button
                    className="agent-msg-copy icon-btn"
                    onClick={() => handleCopyMessage(msg.content)}
                    title={t("agentCopyMessage")}
                  >
                    <CopyIcon size={12} />
                  </button>
                  {sources.length > 0 && (
                    <div className="agent-sources">
                      <div className="agent-sources-label"><BookOpenIcon size={12} /> {t("agentSources")}</div>
                      <div className="agent-sources-list">
                        {sources.map((s) => (
                          <a
                            key={s.id}
                            href={`/records/${s.id}`}
                            className="agent-source-card"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <BookOpenIcon size={12} />
                            <span>{s.label}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              );
            })}

            {streaming && toolStatus && (
              <div className="agent-tool-status">
                <SparklesIcon size={12} />
                <span>{toolStatus}</span>
              </div>
            )}

            {streaming && thinking && !streamContent && (
              <div className="agent-msg agent-msg-assistant">
                <div className="agent-msg-avatar"><BotIcon size={16} /></div>
                <div className="agent-msg-content-wrap">
                  <div className="agent-thinking">
                    <span className="agent-thinking-dot" />
                    <span className="agent-thinking-dot" />
                    <span className="agent-thinking-dot" />
                  </div>
                </div>
              </div>
            )}

            {streaming && streamContent && (
              <div className="agent-msg agent-msg-assistant">
                <div className="agent-msg-avatar"><BotIcon size={16} /></div>
                <div className="agent-msg-content-wrap">
                  <div
                    className="agent-msg-content agent-msg-html"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(streamContent) }}
                  />
                  <span className="agent-cursor">▊</span>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="agent-msg agent-msg-assistant">
                <div className="agent-msg-avatar"><BotIcon size={16} /></div>
                <div className="agent-msg-content-wrap">
                  <div
                    className="agent-msg-content agent-msg-html"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(errorMessage) }}
                  />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

        </div>
      )}

      {open && (
        <div className="agent-sidebar-footer">
          <div className="agent-input-row">
            {activeSlash && (
              <div className="agent-slash-pill-row">
                <span className="agent-slash-pill">
                  /{activeSlash.name}
                  <button
                    type="button"
                    className="agent-slash-pill-remove"
                    onClick={() => {
                      setActiveSlash(null);
                      inputRef.current?.focus();
                    }}
                    tabIndex={-1}
                  >
                    ×
                  </button>
                </span>
              </div>
            )}
            <textarea
                ref={inputRef}
                className="agent-input"
                rows={1}
                style={{ maxHeight: `${textareaMaxHeight}px` }}
                value={input}
                onChange={(e) => {
                  const val = e.target.value;
                  setInput(val);
                  updateCursorAtStart();
                  if (slashOpen && !val.startsWith("/")) {
                    setSlashOpen(false);
                    setSlashIndex(0);
                  }
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={updateCursorAtStart}
                onClick={updateCursorAtStart}
                onSelect={updateCursorAtStart}
                placeholder={t("agentPlaceholder")}
                disabled={streaming}
              />
            <div className="agent-input-toolbar">
              <div className="toolbar-right">
                <button
                  className="agent-send-btn"
                  onClick={sendMessage}
                  disabled={streaming || sending || !input.trim()}
                  title={t("agentSend")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"/>
                    <polyline points="5 12 12 5 19 12"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="agent-disclaimer">{t("agentDisclaimer")}</div>
          {slashOpen && activeSlash === null && (
            <SlashCommandPanel
              commands={slashCommands}
              filterText={slashFilter}
              selectedIndex={slashIndex}
              onSelect={handleSlashSelect}
              anchorRef={inputRef}
            />
          )}
        </div>
      )}
    </aside>
  );
}
