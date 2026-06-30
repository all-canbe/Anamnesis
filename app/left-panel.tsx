"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { UploadFolderDialog } from "./upload-folder-dialog";
import { MenuIcon, FolderIcon, PlusIcon, ChevronLeftIcon, SearchIcon } from "@/lib/icons";

interface LeftPanelProps {
  open: boolean;
  viewMode: "list" | "grid" | "compact";
  onViewModeChange: (mode: "list" | "grid" | "compact") => void;
  onClose: () => void;
}

export function LeftPanel({ open, viewMode, onViewModeChange, onClose }: LeftPanelProps) {
  const { t } = useLanguage();
  const [showUpload, setShowUpload] = useState(false);

  return (
    <>
      <aside className={`left-panel${open ? " open" : ""}`}>
        <div className="left-panel-header">
          <h4>{t("leftPanelTitle")}</h4>
          <button className="left-panel-upload-btn" title={t("leftPanelUpload")} onClick={() => setShowUpload(true)}>
            <PlusIcon size={12} /> {t("leftPanelUpload")}
          </button>
        </div>

        <div className="left-panel-section">
          <div className="left-panel-section-title">
            <FolderIcon size={12} /> {t("leftPanelFiles")}
          </div>
          <div className="left-panel-tree">
            <div className="tree-item active">
              <FolderIcon size={14} />
              <span>{t("all")}</span>
              <span className="tree-count">14</span>
            </div>
            <div className="tree-item">
              <FolderIcon size={14} />
              <span>{t("category.frontend")}</span>
              <span className="tree-count">2</span>
            </div>
            <div className="tree-item">
              <FolderIcon size={14} />
              <span>{t("category.backend")}</span>
              <span className="tree-count">2</span>
            </div>
            <div className="tree-item">
              <FolderIcon size={14} />
              <span>{t("category.ai")}</span>
              <span className="tree-count">3</span>
            </div>
            <div className="tree-item">
              <FolderIcon size={14} />
              <span>{t("category.reading")}</span>
              <span className="tree-count">3</span>
            </div>
            <div className="tree-item">
              <FolderIcon size={14} />
              <span>{t("category.devops")}</span>
              <span className="tree-count">2</span>
            </div>
            <div className="tree-item">
              <FolderIcon size={14} />
              <span>{t("category.design")}</span>
              <span className="tree-count">2</span>
            </div>
          </div>
        </div>

        <div className="left-panel-section">
          <div className="left-panel-section-title">
            <MenuIcon size={12} /> {t("leftPanelView")}
          </div>
          <div className="view-toggle">
            <button
              className={`view-toggle-btn${viewMode === "list" ? " active" : ""}`}
              onClick={() => onViewModeChange("list")}
              title={t("leftPanelViewList")}
            >
              <MenuIcon size={14} />
            </button>
            <button
              className={`view-toggle-btn${viewMode === "grid" ? " active" : ""}`}
              onClick={() => onViewModeChange("grid")}
              title={t("leftPanelViewGrid")}
            >
              <MenuIcon size={14} />
            </button>
            <button
              className={`view-toggle-btn${viewMode === "compact" ? " active" : ""}`}
              onClick={() => onViewModeChange("compact")}
              title={t("leftPanelViewCompact")}
            >
              <MenuIcon size={14} />
            </button>
          </div>
        </div>

        <div className="left-panel-section">
          <div className="left-panel-section-title">
            <SearchIcon size={12} /> {t("leftPanelFilter")}
          </div>
          <input className="left-panel-search" type="text" placeholder={t("leftPanelSearch")} />
        </div>

        <button className="left-panel-close" onClick={onClose}>
          <ChevronLeftIcon size={14} /> {t("leftPanelClose")}
        </button>
      </aside>

      {showUpload && <UploadFolderDialog onClose={() => setShowUpload(false)} />}
    </>
  );
}
