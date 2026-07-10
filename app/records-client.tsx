"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RecordMeta } from "@/lib/types";
import { THUMB_COLORS } from "@/lib/types";
import { useLanguage } from "@/lib/language-context";
import { SearchIcon, ArrowLeftIcon, ArrowRightIcon, BookOpenIcon, CategoryIcon, SparklesIcon, LoaderIcon, CloseIcon } from "@/lib/icons";
import { ContextMenu } from "./context-menu";
import { removeRecord } from "../actions";

interface CategoryItem {
  key: string;
  label: string;
  label_en: string;
  icon: string;
}

interface SearchResult {
  recordId: string;
  title: string;
  category: string;
  score: number;
}

export function RecordsClient({
  records, allRecords, categories, currentCategory, currentPage, totalPages, listMode
}: {
  records: RecordMeta[];
  allRecords: RecordMeta[];
  categories: CategoryItem[];
  currentCategory: string;
  currentPage: number;
  totalPages: number;
  listMode: "private" | "public";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const debounceRef = useRef<number | null>(null);
  const { t, lang } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [semantic, setSemantic] = useState(false);
  const [semanticResults, setSemanticResults] = useState<SearchResult[]>([]);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; recordId: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // 过滤掉已删除的记录
  const activeRecords = useMemo(() => records.filter(r => !deletedIds.has(r.id)), [records, deletedIds]);
  const activeAllRecords = useMemo(() => allRecords.filter(r => !deletedIds.has(r.id)), [allRecords, deletedIds]);

  // 分类 tab 列表
  const categoryKeys = useMemo(() => {
    const keys = ["all", ...categories.map(c => c.key)];
    if (listMode === "private") {
      return [keys[0], "public", ...keys.slice(1)];
    }
    return keys;
  }, [categories, listMode]);

  // 查找分类信息
  const getCategoryInfo = useCallback((key: string): CategoryItem | undefined => {
    return categories.find(c => c.key === key);
  }, [categories]);

  // 显示分类标签：公开模式且语言为英文时显示 label_en
  const getCategoryLabel = useCallback((key: string): string => {
    if (key === "all") return t("all");
    if (key === "public") return t("recordsVisibilityPublic");
    const info = getCategoryInfo(key);
    if (!info) return key;
    return (listMode === "public" && info.label_en && lang === "en") ? info.label_en : info.label;
  }, [categories, listMode, lang, t, getCategoryInfo]);

  // Keyword filter (client-side, paginated)
  const filteredRecords = useMemo(() => {
    let result = [...activeRecords];
    if (!semantic && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [records, searchQuery, semantic]);

  // Semantic search via API
  const doSemanticSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setSemanticResults([]); return; }
    setSemanticLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 20 }),
      });
      if (res.ok) {
        const data = await res.json();
        setSemanticResults(data.results || []);
      }
    } catch {} finally {
      setSemanticLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!semantic) { setSemanticResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => doSemanticSearch(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, semantic, doSemanticSearch]);

  // Resolve semantic results to full RecordMeta
  const semanticRecords = useMemo(() => {
    return semanticResults
      .map((sr) => activeAllRecords.find((r) => r.id === sr.recordId))
      .filter(Boolean) as RecordMeta[];
  }, [semanticResults, activeAllRecords]);

  // Final display list
  const displayRecords = semantic ? semanticRecords : filteredRecords;

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("visible");
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    document.querySelectorAll(".animate-on-scroll").forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, [displayRecords]);

  useEffect(() => {
    const handleScroll = () => {
      document.getElementById("site-header")?.classList.toggle("scrolled", window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const updateParams = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") p.set(key, value);
    else p.delete(key);
    if (key === "category") p.delete("page");
    router.push(`?${p.toString()}`);
  };

  const totalCount = activeAllRecords.length;
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of activeAllRecords) {
      counts[r.category] = (counts[r.category] || 0) + 1;
    }
    if (listMode === "private") {
      counts["public"] = activeAllRecords.filter(r => r.visibility === "public").length;
    }
    return counts;
  }, [activeAllRecords, listMode]);

  function handleContextMenu(e: React.MouseEvent, recordId: string) {
    if (listMode !== "private") return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, recordId });
  }

  async function handleDelete(recordId: string) {
    setDeleting(true);
    try {
      await removeRecord(recordId);
      setDeletedIds(prev => new Set(prev).add(recordId));
      setConfirmDelete(null);
    } catch {
      // 删除失败时保持弹窗，让用户可以重试
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="category-tabs">
        {categoryKeys.map((key) => {
          const cat = getCategoryInfo(key);
          const isActive = currentCategory === key;
          const label = getCategoryLabel(key);
          const count = key === "all" ? totalCount : (categoryCounts[key] || 0);
          return (
            <button
                key={key}
                className={`category-tab${isActive ? " active" : ""}`}
                onClick={() => updateParams("category", key)}
              >
                {cat?.icon && key !== "public" ? <CategoryIcon category={cat.icon} size={14} /> : null} {label}
              <span className="category-count">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="search-bar">
        <span className="search-bar-icon"><SearchIcon size={14} /></span>
        <input
          className="search-bar-input"
          type="text"
          placeholder={semantic ? t("searchSemanticPlaceholder") : t("searchKeywordPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          className={`search-mode-btn${semantic ? " active" : ""}`}
          onClick={() => { setSemantic((v) => !v); setSemanticResults([]); }}
          title={semantic ? t("searchSwitchKeyword") : t("searchSwitchSemantic")}
        >
          {semanticLoading ? <LoaderIcon size={14} /> : <SparklesIcon size={14} />}
        </button>
      </div>

      <div className="records-list">
        {displayRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <BookOpenIcon size={40} />
            </div>
            <p className="empty-state-text">
              {semantic && searchQuery.trim()
                ? t("searchNoSemanticMatch").replace("{query}", searchQuery)
                : searchQuery
                  ? t("searchNoKeywordMatch").replace("{query}", searchQuery)
                  : t("noRecords")
              }
            </p>
          </div>
        ) : (
          <>
            {displayRecords.map((r, i) => {
            const cat = getCategoryInfo(r.category);
            const color = THUMB_COLORS[i % THUMB_COLORS.length];
            const formatLabel = r.format === "md" ? t("recordsFormatMD") : t("recordsFormatHTML");
            const visibilityLabel = r.visibility === "public" ? t("recordsVisibilityPublic") : t("recordsVisibilityPrivate");
            const visibilityClass = r.visibility === "public" ? "visibility-badge public" : "visibility-badge private";
            const catLabel = cat ? (listMode === "public" && cat.label_en && lang === "en" ? cat.label_en : cat.label) : r.category;
            return (
              <article
                key={r.id}
                className="record-card animate-on-scroll"
                onClick={() => router.push(`/records/${r.id}`)}
                onContextMenu={(e) => handleContextMenu(e, r.id)}
              >
                <div className="record-thumb" style={{ background: color }}>
                  <CategoryIcon category={r.category} size={22} />
                </div>
                <div className="record-body">
                  <div className="record-meta stagger-text">
                    <span className="record-date">{r.date}</span>
                    <span className="category-badge">{catLabel}</span>
                    <span className="format-badge">{formatLabel}</span>
                    <span className={visibilityClass}>{visibilityLabel}</span>
                  </div>
                  <h2 className="record-title stagger-text">{r.title}</h2>
                  <p className="record-summary stagger-text">{r.summary}</p>
                  <span className="record-detail-btn stagger-text">
                    {t("detail")} <ArrowRightIcon size={12} />
                  </span>
                </div>
              </article>
            );
          })}
          </>
        )}
      </div>

      {!semantic && totalPages > 0 && displayRecords.length > 0 && (
        <div className="pagination">
          <button
            className="page-btn"
            disabled={currentPage <= 1}
            onClick={() => updateParams("page", String(currentPage - 1))}
          >
            <ArrowLeftIcon size={12} /> {t("prevPage")}
          </button>
          <span className="page-info">{currentPage} / {totalPages}</span>
          <button
            className="page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => updateParams("page", String(currentPage + 1))}
          >
            {t("nextPage")} <ArrowRightIcon size={12} />
          </button>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            { label: t("delete"), onClick: () => setConfirmDelete(contextMenu.recordId), danger: true },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-dialog-header">
              <h3>{t("confirmDeleteTitle")}</h3>
              <button className="modal-close icon-btn" onClick={() => setConfirmDelete(null)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="confirm-dialog-body">
              <p>{t("confirmDeleteMessage")}</p>
              <div className="confirm-dialog-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                  {t("cancel")}
                </button>
                <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)} disabled={deleting}>
                  {deleting ? t("deleting") : t("delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}