"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [listMode, setListMode] = useState<"private" | "public">("private");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [settingsConfig, setSettingsConfig] = useState<CachedAgentConfig | null>(() => {
    try {
      const raw = localStorage.getItem(AGENT_CONFIG_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  /** 从服务端加载配置并缓存到 localStorage（不含完整 API Key） */
  const loadSettingsConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
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
      }
    } catch {}
  }, []);

  // 初始化：检查登录状态
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (data.email) {
          setUserEmail(data.email);
          loadSettingsConfig();
          return;
        }
      }
    } catch {}
  }, [loadSettingsConfig]);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  // 未登录时强制切换到公开列表
  useEffect(() => {
    if (!userEmail) {
      setListMode("public");
    }
  }, [userEmail]);

  // 登出
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {}
    setUserEmail(null);
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
    if (saved && saved !== initialViewMode) setViewMode(saved);
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
          username={userEmail}
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
        onLoginSuccess={(email) => setUserEmail(email)}
      />
    </div>
  );
}
