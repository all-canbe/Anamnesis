"use client";

import { MenuIcon, FolderIcon, DownloadIcon, SettingsIcon, UserIcon, GlobeIcon } from "@/lib/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface NavBarProps {
  activeMode: "list" | "grid" | "compact";
  listMode: "private" | "public";
  onModeChange: (mode: "list" | "grid" | "compact") => void;
  onListModeChange: (mode: "private" | "public") => void;
  onOpenLeftPanel: () => void;
  onOpenSettings: () => void;
  onOpenImport: () => void;
  username: string | null;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export function NavBar({ activeMode, listMode, onModeChange, onListModeChange, onOpenLeftPanel, onOpenSettings, onOpenImport, username, onOpenLogin, onLogout }: NavBarProps) {
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const router = useRouter();

  function handleListModeChange(mode: "private" | "public") {
    onListModeChange(mode);
    if (mode === "public") {
      router.push("/?mode=public");
    } else {
      router.push("/");
    }
  }

  function getInitial(name: string): string {
    return (name[0] || "").toUpperCase();
  }

  return (
    <nav className="nav-bar">
      <div className="nav-bar-items">
        <button
          className={`nav-bar-btn${listMode === "private" ? " active" : ""}`}
          onClick={() => handleListModeChange("private")}
          title="Private list"
        >
          <MenuIcon size={16} />
          <span className="nav-bar-tooltip">Private</span>
        </button>

        <button
          className={`nav-bar-btn${listMode === "public" ? " active" : ""}`}
          onClick={() => handleListModeChange("public")}
          title="Public list"
        >
          <GlobeIcon size={16} />
          <span className="nav-bar-tooltip">Public</span>
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
        {!username ? (
          <button
            className="nav-bar-btn"
            onClick={onOpenLogin}
            title="Login"
          >
            <UserIcon size={16} />
            <span className="nav-bar-tooltip">Login</span>
          </button>
        ) : (
          <div className="nav-bar-avatar-container">
            <button
              className="nav-bar-avatar"
              onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
              title={username}
            >
              {getInitial(username)}
            </button>
            {avatarMenuOpen && (
              <div className="nav-bar-avatar-menu">
                <button
                  className="nav-bar-avatar-menu-item"
                  onClick={() => {
                    setAvatarMenuOpen(false);
                    onLogout();
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
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
