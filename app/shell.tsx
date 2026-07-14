"use client";

import { useState, useEffect } from "react";
import { LeftPanel } from "./left-panel";
import { AgentSidebar } from "./agent-sidebar";
import { FooterBar } from "./footer-bar";
import { LangToggle } from "./lang-toggle";
import { NavBar } from "./nav-bar";
import { SettingsDialog } from "./settings-dialog";
import { ImportDialog } from "./import-dialog";
import { LoginDialog } from "./login-dialog";
import { useLanguage } from "@/lib/language-context";

const VIEW_KEY = "zhiyi-view-mode";
const THEME_KEY = "zhiyi-theme";
const AGENT_CONFIG_CACHE_KEY = "zhiyi-agent-config";

export interface CachedAgentConfig {
  configured: boolean;
  baseUrl: string;
  model: string;
  keyPreview?: string;
  embeddingBaseUrl?: string;
  embeddingModel?: string;
  zvecEnabled?: boolean;
}

export function Shell({
  children,
  initialViewMode = "list",
}: {
  children: React.ReactNode;
  initialViewMode?: "list" | "grid" | "compact";
}) {
  const { t } = useLanguage();
  const [leftOpen, setLeftOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid" | "compact">(initialViewMode);
  const [listMode, setListMode] = useState<"private" | "public">("public");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [settingsConfig, setSettingsConfig] = useState<CachedAgentConfig | null>(() => {
    try {
      const raw = localStorage.getItem(AGENT_CONFIG_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  // 初始化：检查登录状态 + 加载配置
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.email) {
          setUserEmail(data.email);
          setUserUsername(data.username || null);
          setListMode("private");
          return fetch("/api/settings", { credentials: "same-origin" });
        }
        return null;
      })
      .then(settingsRes => {
        if (settingsRes?.ok) {
          settingsRes.json().then(data => {
            const config: CachedAgentConfig = {
              configured: data.configured || false,
              baseUrl: data.baseUrl || "",
              model: data.model || "",
              keyPreview: data.keyPreview,
              embeddingBaseUrl: data.embeddingBaseUrl,
              embeddingModel: data.embeddingModel,
              zvecEnabled: data.zvecEnabled,
            };
            setSettingsConfig(config);
            try { localStorage.setItem(AGENT_CONFIG_CACHE_KEY, JSON.stringify(config)); } catch {}
          });
        }
      })
      .catch(() => {});
  }, []);

  // 登出
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {}
    setUserEmail(null);
    setUserUsername(null);
    setListMode("public");
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSettingsOpen(false);
        setImportOpen(false);
        setLoginOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(".search-bar-input");
        input?.focus();
      }
      if (e.key === "?" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY) as "list" | "grid" | "compact" | null;
    if (saved) {
      if (saved !== initialViewMode) setViewMode(saved);
      // 将 localStorage 中的视图偏好同步回 cookie，使服务端下次渲染能按该视图分页
      try {
        document.cookie = `zhiyi-view-mode=${saved};path=/;max-age=31536000`;
      } catch {}
    }
  }, [initialViewMode]);

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as "light" | "dark" | "system" | null;
    if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else if (savedTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  function handleViewMode(mode: "list" | "grid" | "compact") {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
    try {
      document.cookie = `zhiyi-view-mode=${mode};path=/;max-age=31536000`;
    } catch {}
    // 触发服务端按新 cookie 重新计算 PER_PAGE 并切片
    router.refresh();
  }

  return (
    <div className="shell">
      <header className="site-header" id="site-header">
        <div className="header-inner">
          <div className="header-left">
            <a href="/" className="site-logo">{t("siteTitle")}</a>
          </div>
          <div className="header-right">
            <nav className="site-nav">
              <a href="/" className="nav-link active" data-page="records">{t("records")}</a>
            </nav>
            <LangToggle />
          </div>
        </div>
      </header>

      <div className="shell-body">
        <NavBar
          activeMode={viewMode}
          listMode={listMode}
          onModeChange={handleViewMode}
          onListModeChange={setListMode}
          onOpenLeftPanel={() => setLeftOpen((v) => !v)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenImport={() => setImportOpen(true)}
          username={userUsername || userEmail}
          isAdmin={userEmail === "admin"}
          onUsernameUpdate={setUserUsername}
          onOpenLogin={() => setLoginOpen(true)}
          onLogout={handleLogout}
        />

        <LeftPanel
          open={leftOpen}
          listMode={listMode}
          viewMode={viewMode}
          onViewModeChange={handleViewMode}
          onClose={() => setLeftOpen(false)}
        />

        <main className={`site-main${viewMode === "grid" ? " view-grid" : viewMode === "compact" ? " view-compact" : ""}`}>
          {children}
          <FooterBar />
        </main>

        <AgentSidebar open={agentOpen} onToggle={() => setAgentOpen((v) => !v)} settingsConfig={settingsConfig} />
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} initialConfig={settingsConfig} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <LoginDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoginSuccess={(email) => {
          setUserEmail(email);
          setListMode("private");
          fetch("/api/auth/me", { credentials: "same-origin" })
            .then(res => res.ok ? res.json() : null)
            .then(data => { if (data?.username) setUserUsername(data.username); })
            .catch(() => {});
        }}
      />
    </div>
  );
}
