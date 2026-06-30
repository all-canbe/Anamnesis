"use client";

import { useState, useEffect } from "react";
import { LeftPanel } from "./left-panel";
import { AgentSidebar } from "./agent-sidebar";
import { FooterBar } from "./footer-bar";
import { LangToggle } from "./lang-toggle";
import { NavBar } from "./nav-bar";
import { SettingsDialog } from "./settings-dialog";
import { ImportDialog } from "./import-dialog";

const VIEW_KEY = "zhiyi-view-mode";
const THEME_KEY = "zhiyi-theme";

export function Shell({ children }: { children: React.ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid" | "compact">("list");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

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
              <a href="/settings" className="nav-link" data-page="settings">
                <span className="nav-link-icon">⚙</span>
              </a>
            </nav>
            <LangToggle />
          </div>
        </div>
      </header>

      <div className="shell-body">
        <NavBar
          activeMode={viewMode}
          onModeChange={handleViewMode}
          onOpenLeftPanel={() => setLeftOpen((v) => !v)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenImport={() => setImportOpen(true)}
        />

        <LeftPanel
          open={leftOpen}
          viewMode={viewMode}
          onViewModeChange={handleViewMode}
          onClose={() => setLeftOpen(false)}
        />

        <main className={`site-main${viewMode === "grid" ? " view-grid" : viewMode === "compact" ? " view-compact" : ""}`}>
          {children}
        </main>

        <AgentSidebar open={agentOpen} onToggle={() => setAgentOpen((v) => !v)} />
      </div>

      <FooterBar />

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
