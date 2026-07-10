"use client";

import { useLanguage } from "@/lib/language-context";
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
  const { t } = useLanguage();
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
            className="nav-bar-btn"
            onClick={onOpenSettings}
            title={t("navSettings")}
          >
            <SettingsIcon size={16} />
            <span className="nav-bar-tooltip">{t("navSettings")}</span>
          </button>
      </div>
    </nav>
  );
}
