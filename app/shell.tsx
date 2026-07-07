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

const VIEW_KEY = "zhiyi-view-mode";
const THEME_KEY = "zhiyi-theme";

export function Shell({ children }: { children: React.ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid" | "compact">("list");
  const [listMode, setListMode] = useState<"private" | "public">("private");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  // 初始化：检查登录状态
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (data.username) {
          setUsername(data.username);
          return;
        }
      }
      // 开发环境自动登录
      if (process.env.NODE_ENV === "development") {
        const devRes = await fetch("/api/auth/dev-login", {
          method: "POST",
          credentials: "same-origin",
        });
        if (devRes.ok) {
          const devData = await devRes.json();
          setUsername(devData.username);
        }
      }
    } catch {}
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  // 登出
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {}
    setUsername(null);
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
    if (saved) setViewMode(saved);
  }, []);

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
  }

  return (
    <div className="shell">
      <header className="site-header" id="site-header">
        <div className="header-inner">
          <div className="header-left">
            <a href="/" className="site-logo">知忆</a>
          </div>
          <div className="header-right">
            <nav className="site-nav">
              <a href="/" className="nav-link active" data-page="records">Records</a>
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
          username={username}
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

        <AgentSidebar open={agentOpen} onToggle={() => setAgentOpen((v) => !v)} />
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <LoginDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoginSuccess={(name) => setUsername(name)}
      />
    </div>
  );
}
