"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RecordMeta } from "@/lib/types";
import { CATEGORIES, THUMB_COLORS } from "@/lib/types";

export function RecordsClient({
  records, currentCategory, currentPage, totalPages
}: {
  records: RecordMeta[];
  currentCategory: string;
  currentPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const observerRef = useRef<IntersectionObserver | null>(null);

  const categories = ["all", "frontend", "backend", "ai", "reading", "devops", "design"];

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("visible");
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    document.querySelectorAll(".animate-on-scroll").forEach((el) => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, [records]);

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

  return (
    <>
      <div className="category-tabs">
        {categories.map((key) => {
          const cat = CATEGORIES[key as keyof typeof CATEGORIES] || { label: "ALL", emoji: "" };
          const isActive = currentCategory === key;
          return (
            <button
              key={key}
              className={`category-tab${isActive ? " active" : ""}`}
              onClick={() => updateParams("category", key)}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      <div className="records-list">
        {records.map((r, i) => {
          const cat = CATEGORIES[r.category as keyof typeof CATEGORIES] || {};
          const color = THUMB_COLORS[i % THUMB_COLORS.length];
          const fmt = r.format === "md"
            ? ' <span class="format-badge">MD</span>'
            : ' <span class="format-badge">HTML</span>';
          return (
            <article
              key={r.id}
              className="record-card animate-on-scroll"
              onClick={() => router.push(`/records/${r.id}`)}
            >
              <div className="record-thumb" style={{ background: color }}>
                <span>{cat.emoji || "📄"}</span>
              </div>
              <div className="record-body">
                <div className="record-meta stagger-text">
                  <span className="record-date">{r.date}</span>
                  <span className="category-badge">{cat.label || r.category}</span>
                  <span dangerouslySetInnerHTML={{ __html: fmt }} />
                </div>
                <h2 className="record-title stagger-text">{r.title}</h2>
                <p className="record-summary stagger-text">{r.summary}</p>
                <span className="record-detail-btn stagger-text">
                  DETAIL <span className="arrow-icon">→</span>
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {totalPages > 0 && (
        <div className="pagination">
          <button
            className="page-btn"
            disabled={currentPage <= 1}
            onClick={() => updateParams("page", String(currentPage - 1))}
          >
            &laquo; Prev
          </button>
          <span className="page-info">{currentPage} / {totalPages}</span>
          <button
            className="page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => updateParams("page", String(currentPage + 1))}
          >
            Next &raquo;
          </button>
        </div>
      )}
    </>
  );
}