"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
} from "@/lib/icons";

function renderMarkdown(text: string): string {
  let html = mdToHtml(text);
  html = html
    .replace(/\n/g, "<br>")
    .replace(/<br><br><\/p>/g, "</p>")
    .replace(/<p><br>/g, "<p>");
  return html;
}

export function AgentSidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [displayedContent, setDisplayedContent] = useState("");
  const [showSessionList, setShowSessionList] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const typewriterRef = useRef<number | null>(null);

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
    if (sessions.length > 0) saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, displayedContent]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  useEffect(() => {
    if (!streaming || !streamContent) {
      setDisplayedContent(streamContent);
      return;
    }

    let idx = 0;
    const fullText = streamContent;

    function tick() {
      if (idx < fullText.length) {
        idx += 2;
        setDisplayedContent(fullText.slice(0, idx));
        typewriterRef.current = window.setTimeout(tick, 8);
      } else {
        setDisplayedContent(fullText);
      }
    }

    tick();

    return () => {
      if (typewriterRef.current) clearTimeout(typewriterRef.current);
    };
  }, [streamContent, streaming]);

  function switchSession(id: string) {
    setActiveId(id);
    setShowSessionList(false);
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
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId ? { ...s, messages: [], title: "新对话", updatedAt: Date.now() } : s
      )
    );
  }

  function handleCopyMessage(content: string) {
    navigator.clipboard.writeText(content);
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming || !activeId) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: text };
    setSessions((prev) => addMessage(prev, activeId, userMsg));
    setStreaming(true);
    setStreamContent("");
    setDisplayedContent("");

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const currentSessions = loadSessions();
      const session = currentSessions.find((s) => s.id === activeId);
      const history = session ? getContextForLLM(session.messages) : [];

      const agentConfigRaw = localStorage.getItem("zhiyi-agent-config");
      let agentConfig = {};
      if (agentConfigRaw) {
        try { agentConfig = JSON.parse(agentConfigRaw); } catch {}
      }

      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, agentConfig }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        setStreamContent("Failed to connect to agent. Is LLM_API_KEY configured?");
        setStreaming(false);
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
            } else if (data.type === "tool") {
              fullContent += `\n\n**Using tool:** \`${data.name}\`...\n\n`;
              setStreamContent(fullContent);
            } else if (data.type === "error") {
              fullContent += `\n\n**Error:** ${data.content}`;
              setStreamContent(fullContent);
            }
          } catch {}
        }
      }

      if (fullContent) {
        const assistantMsg: ChatMessage = { role: "assistant", content: fullContent };
        setSessions((prev) => addMessage(prev, activeId, assistantMsg));
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setStreamContent(`Error: ${err.message}`);
      }
    } finally {
      setStreaming(false);
      setStreamContent("");
      setDisplayedContent("");
      abortRef.current = null;
    }
  }, [input, streaming, activeId]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const showWelcome = messages.length === 0 && !streaming;

  return (
    <aside className={`agent-sidebar${open ? "" : " collapsed"}`}>
      <div className="agent-sidebar-header">
        {open ? (
          <>
            <h4>
              <span className="agent-status-dot"></span>
              {t("agentTitle")}
            </h4>
            <div className="agent-header-actions">
              <button className="agent-header-btn icon-btn" onClick={() => setShowSessionList((v) => !v)} title="Sessions">
                <MenuIcon size={14} />
              </button>
              <button className="agent-header-btn icon-btn" onClick={handleClearSession} title="Clear conversation">
                <TrashIcon size={14} />
              </button>
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

          <div className="agent-messages">
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

            {messages.map((msg, i) => (
              <div key={i} className={`agent-msg agent-msg-${msg.role}`}>
                <div className="agent-msg-avatar">{msg.role === "assistant" ? <BotIcon size={16} /> : <UserIcon size={16} />}</div>
                <div className="agent-msg-content-wrap">
                  <div
                    className="agent-msg-content agent-msg-html"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                  <button
                    className="agent-msg-copy icon-btn"
                    onClick={() => handleCopyMessage(msg.content)}
                    title="Copy message"
                  >
                    <CopyIcon size={12} />
                  </button>
                </div>
              </div>
            ))}

            {streaming && streamContent && (
              <div className="agent-msg agent-msg-assistant">
                <div className="agent-msg-avatar"><BotIcon size={16} /></div>
                <div className="agent-msg-content-wrap">
                  <div
                    className="agent-msg-content agent-msg-html"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(displayedContent) }}
                  />
                  {displayedContent.length < streamContent.length && (
                    <span className="agent-cursor">▊</span>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="agent-sidebar-footer">
            <div className="agent-input-row">
              <input
                className="agent-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("agentPlaceholder")}
                disabled={streaming}
              />
              <button
                className="agent-send-btn"
                onClick={sendMessage}
                disabled={streaming || !input.trim()}
              >
                {streaming ? "..." : t("agentSend")}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
