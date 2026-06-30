"use client";

import { MenuIcon, FolderIcon, DownloadIcon, SettingsIcon } from "@/lib/icons";

interface NavBarProps {
  activeMode: "list" | "grid" | "compact";
  onModeChange: (mode: "list" | "grid" | "compact") => void;
  onOpenLeftPanel: () => void;
  onOpenSettings: () => void;
  onOpenImport: () => void;
}

export function NavBar({ activeMode, onModeChange, onOpenLeftPanel, onOpenSettings, onOpenImport }: NavBarProps) {
  return (
    <nav className="nav-bar">
      <div className="nav-bar-items">
        <button
          className={`nav-bar-btn${activeMode === "list" ? " active" : ""}`}
          onClick={() => onModeChange("list")}
          title="List view"
        >
          <MenuIcon size={16} />
          <span className="nav-bar-tooltip">List</span>
        </button>

        <div className="nav-bar-divider" />

        <button
          className="nav-bar-btn"
          onClick={onOpenLeftPanel}
          title="Files / Skills"
        >
          <FolderIcon size={16} />
          <span className="nav-bar-tooltip">Files</span>
        </button>

        <button
          className="nav-bar-btn"
          onClick={onOpenImport}
          title="Import Article"
        >
          <DownloadIcon size={16} />
          <span className="nav-bar-tooltip">Import</span>
        </button>
      </div>

      <div className="nav-bar-bottom">
        <div className="nav-bar-divider" />
        <button
          className="nav-bar-btn"
          onClick={onOpenSettings}
          title="Settings"
        >
          <SettingsIcon size={16} />
          <span className="nav-bar-tooltip">Settings</span>
        </button>
      </div>
    </nav>
  );
}
