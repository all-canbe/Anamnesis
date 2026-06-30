"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RecordMeta } from "@/lib/types";
import { CATEGORIES, THUMB_COLORS } from "@/lib/types";
import { useLanguage } from "@/lib/language-context";
import { SearchIcon, SortIcon, ArrowLeftIcon, ArrowRightIcon, BookOpenIcon, CategoryIcon } from "@/lib/icons";

export function RecordsClient({
  records, allRecords, currentCategory, currentPage, totalPages
}: {
  records: RecordMeta[];
  allRecords: RecordMeta[];
  currentCategory: string;
  currentPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "title" | "category">("date");

  const categories = ["all", "frontend", "backend", "ai", "reading", "devops", "design"];

  const filteredRecords = useMemo(() => {
    let result = [...records];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    }
    if (sortBy === "title") {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "category") {
      result.sort((a, b) => a.category.localeCompare(b.category) || b.date.localeCompare(a.date));
    }
    return result;
  }, [records, searchQuery, sortBy]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("visible");
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    document.querySelectorAll(".animate-on-scroll").forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, [filteredRecords]);

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

  const totalCount = allRecords.length;
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of allRecords) {
      counts[r.category] = (counts[r.category] || 0) + 1;
    }
    return counts;
  }, [allRecords]);

  return (
    <>
      <div className="category-tabs">
        {categories.map((key) => {
          const cat = CATEGORIES[key as keyof typeof CATEGORIES] || { label: "ALL", icon: "" };
          const isActive = currentCategory === key;
          const label = key === "all" ? t("all") : t(`category.${key}`);
          const count = key === "all" ? totalCount : (categoryCounts[key] || 0);
          return (
            <button
              key={key}
              className={`category-tab${isActive ? " active" : ""}`}
              onClick={() => updateParams("category", key)}
            >
              {cat.icon ? <CategoryIcon category={cat.icon} size={14} /> : null} {label}
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
          placeholder="Search by title, summary, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="list-toolbar">
        <div className="list-stats">
          <BookOpenIcon size={12} /> <strong>{filteredRecords.length}</strong> {t("records_suffix")}
          {currentCategory !== "all" && ` in ${t(`category.${currentCategory}`)}`}
        </div>
        <div className="list-sort">
          <SortIcon size={12} />
          <span className="list-sort-label">Sort</span>
          <select
            className="list-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "title" | "category")}
          >
            <option value="date">Date</option>
            <option value="title">Title</option>
            <option value="category">Category</option>
          </select>
        </div>
      </div>

      <div className="records-list">
        {filteredRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <BookOpenIcon size={40} />
            </div>
            <p className="empty-state-text">
              {searchQuery ? `No records matching "${searchQuery}"` : t("noRecords")}
            </p>
          </div>
        ) : (
          filteredRecords.map((r, i) => {
            const cat = CATEGORIES[r.category as keyof typeof CATEGORIES] || {};
            const color = THUMB_COLORS[i % THUMB_COLORS.length];
            const fmt = r.format === "md"
              ? ' <span class="format-badge">MD</span>'
              : ' <span class="format-badge">HTML</span>';
            const catLabel = t(`category.${r.category}`);
            return (
              <article
                key={r.id}
                className="record-card animate-on-scroll"
                onClick={() => router.push(`/records/${r.id}`)}
              >
                <div className="record-thumb" style={{ background: color }}>
                  <CategoryIcon category={r.category} size={22} />
                </div>
                <div className="record-body">
                  <div className="record-meta stagger-text">
                    <span className="record-date">{r.date}</span>
                    <span className="category-badge">{catLabel}</span>
                    <span dangerouslySetInnerHTML={{ __html: fmt }} />
                  </div>
                  <h2 className="record-title stagger-text">{r.title}</h2>
                  <p className="record-summary stagger-text">{r.summary}</p>
                  <span className="record-detail-btn stagger-text">
                    {t("detail")} <ArrowRightIcon size={12} />
                  </span>
                </div>
              </article>
            );
          })
        )}
      </div>

      {totalPages > 0 && filteredRecords.length > 0 && (
        <div className="pagination">
          <button
            className="page-btn"
            disabled={currentPage <= 1}
            onClick={() => updateParams("page", String(currentPage - 1))}
          >
            <ArrowLeftIcon size={12} /> {t("prev")}
          </button>
          <span className="page-info">{currentPage} / {totalPages}</span>
          <button
            className="page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => updateParams("page", String(currentPage + 1))}
          >
            {t("next")} <ArrowRightIcon size={12} />
          </button>
        </div>
      )}
    </>
  );
}
