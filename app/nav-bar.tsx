"use client";

import { useLanguage } from "@/lib/language-context";
import { MenuIcon, FolderIcon, DownloadIcon, SettingsIcon, UserIcon, GlobeIcon, CloseIcon } from "@/lib/icons";
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
  isAdmin?: boolean;
  onUsernameUpdate?: (username: string) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export function NavBar({ activeMode, listMode, onModeChange, onListModeChange, onOpenLeftPanel, onOpenSettings, onOpenImport, username, isAdmin, onUsernameUpdate, onOpenLogin, onLogout }: NavBarProps) {
  const { t } = useLanguage();
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [editUsernameOpen, setEditUsernameOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState("");
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

  function openEditUsername() {
    setAvatarMenuOpen(false);
    setNewUsername(username || "");
    setUsernameError("");
    setEditUsernameOpen(true);
  }

  async function handleSaveUsername() {
    const trimmed = newUsername.trim();
    if (!trimmed) {
      setUsernameError(t("usernameEmptyError"));
      return;
    }
    if (trimmed.length > 30) {
      setUsernameError(t("usernameEmptyError"));
      return;
    }
    setUsernameSaving(true);
    setUsernameError("");
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: trimmed }),
      });
      const data = await res.json();
      if (data.ok) {
        onUsernameUpdate?.(data.username);
        setEditUsernameOpen(false);
      } else {
        setUsernameError(data.error || t("usernameEmptyError"));
      }
    } catch {
      setUsernameError(t("usernameEmptyError"));
    } finally {
      setUsernameSaving(false);
    }
  }

  return (
    <nav className="nav-bar">
      <div className="nav-bar-items">
        <button
          className={`nav-bar-btn${listMode === "private" ? " active" : ""}${!username ? " disabled" : ""}`}
          onClick={() => username ? handleListModeChange("private") : undefined}
          title={username ? t("navPrivateList") : t("loginRequired")}
          disabled={!username}
        >
          <MenuIcon size={16} />
          <span className="nav-bar-tooltip">{username ? t("navPrivateList") : t("loginRequired")}</span>
        </button>

        <button
          className={`nav-bar-btn${listMode === "public" ? " active" : ""}`}
          onClick={() => handleListModeChange("public")}
          title={t("navPublicList")}
        >
          <GlobeIcon size={16} />
          <span className="nav-bar-tooltip">{t("navPublicList")}</span>
        </button>

        <div className="nav-bar-divider" />

        <button
          className="nav-bar-btn"
          onClick={onOpenLeftPanel}
          title={t("navFilesSkills")}
        >
          <FolderIcon size={16} />
          <span className="nav-bar-tooltip">{t("navFilesSkills")}</span>
        </button>

        <button
          className={`nav-bar-btn${!username ? " disabled" : ""}`}
          onClick={() => username ? onOpenImport() : undefined}
          title={username ? t("navImportArticle") : t("loginRequired")}
          disabled={!username}
        >
          <DownloadIcon size={16} />
          <span className="nav-bar-tooltip">{username ? t("navImportArticle") : t("loginRequired")}</span>
        </button>
      </div>

      <div className="nav-bar-bottom">
        <div className="nav-bar-divider" />
        {!username ? (
          <button
            className="nav-bar-btn"
            onClick={onOpenLogin}
            title={t("navLogin")}
          >
            <UserIcon size={16} />
            <span className="nav-bar-tooltip">{t("navLogin")}</span>
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
                {!isAdmin && (
                  <button
                    className="nav-bar-avatar-menu-item"
                    onClick={openEditUsername}
                  >
                    {t("navEditUsername")}
                  </button>
                )}
                <button
                  className="nav-bar-avatar-menu-item"
                  onClick={() => {
                    setAvatarMenuOpen(false);
                    onLogout();
                  }}
                >
                  {t("navLogout")}
                </button>
              </div>
            )}
          </div>
        )}
        <button
            className={`nav-bar-btn${!username ? " disabled" : ""}`}
            onClick={() => username ? onOpenSettings() : undefined}
            title={username ? t("navSettings") : t("loginRequired")}
            disabled={!username}
          >
            <SettingsIcon size={16} />
            <span className="nav-bar-tooltip">{username ? t("navSettings") : t("loginRequired")}</span>
          </button>
      </div>

      {editUsernameOpen && (
        <div className="modal-overlay" onClick={() => setEditUsernameOpen(false)}>
          <div className="login-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="login-dialog-header">
              <h3>{t("usernameDialogTitle")}</h3>
              <button className="modal-close icon-btn" onClick={() => setEditUsernameOpen(false)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="login-dialog-body">
              {usernameError && (
                <div className="login-error">{usernameError}</div>
              )}
              <div className="login-row">
                <div className="login-row-label">{t("usernameLabel")}</div>
                <input
                  className="login-input"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder={t("usernamePlaceholder")}
                  maxLength={30}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && !usernameSaving) handleSaveUsername(); }}
                />
              </div>
              <div className="login-actions">
                <button
                  className="btn btn-sm btn-link"
                  onClick={() => setEditUsernameOpen(false)}
                  type="button"
                >
                  {t("cancel")}
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleSaveUsername}
                  disabled={usernameSaving}
                >
                  {usernameSaving ? t("usernameSaving") : t("usernameSaveBtn")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
