"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { UploadFolderDialog } from "./upload-folder-dialog";
import { CATEGORIES } from "@/lib/types";
import { MenuIcon, FolderIcon, PlusIcon, ChevronLeftIcon, SearchIcon } from "@/lib/icons";

interface TagInfo {
  key: string;
  label: string;
  icon: string;
  color: string;
}

interface LeftPanelProps {
  open: boolean;
  listMode: "private" | "public";
  viewMode: "list" | "grid" | "compact";
  onViewModeChange: (mode: "list" | "grid" | "compact") => void;
  onClose: () => void;
}

export function LeftPanel({ open, listMode, viewMode, onViewModeChange, onClose }: LeftPanelProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [showUpload, setShowUpload] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    fetch("/api/tags")
      .then(res => res.ok ? res.json() : [])
      .then(data => setTags(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch(`/api/record-counts?visibility=${listMode}`)
      .then(res => res.ok ? res.json() : {})
      .then(data => setCounts(data || {}))
      .catch(() => {});
  }, [open, listMode]);

  function handleCategoryClick(key: string) {
    setActiveCategory(key);
    const modeParam = listMode === "public" ? "&mode=public" : "";
    router.push(`/?category=${key}${modeParam}`);
  }

  const categoryKeys = ["all", ...Object.keys(CATEGORIES)];
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

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
            <FolderIcon size={12} /> {listMode === "public" ? "Public" : t("leftPanelFiles")}
          </div>
          <div className="left-panel-tree">
            {categoryKeys.map(key => {
              const isActive = activeCategory === key;
              const label = key === "all" ? t("all") : t(`category.${key}`);
              const count = key === "all" ? totalCount : (counts[key] || 0);
              return (
                <div
                  key={key}
                  className={`tree-item${isActive ? " active" : ""}`}
                  onClick={() => handleCategoryClick(key)}
                >
                  <FolderIcon size={14} />
                  <span>{label}</span>
                  <span className="tree-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {tags.length > 0 && (
          <div className="left-panel-section">
            <div className="left-panel-section-title">
              <SearchIcon size={12} /> {t("leftPanelFilter")}
            </div>
            <div className="left-panel-tree">
              {tags.map(tag => (
                <div key={tag.key} className="tree-item">
                  <span>{tag.icon || "🏷"}</span>
                  <span>{tag.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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

        <button className="left-panel-close" onClick={onClose}>
          <ChevronLeftIcon size={14} /> {t("leftPanelClose")}
        </button>
      </aside>

      {showUpload && <UploadFolderDialog onClose={() => setShowUpload(false)} />}
    </>
  );
}
