"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RecordMeta } from "@/lib/types";
import { CATEGORIES, THUMB_COLORS } from "@/lib/types";
import { useLanguage } from "@/lib/language-context";
import { EditIcon, LinkIcon, ArrowLeftIcon, ArrowRightIcon, CodeIcon, BookOpenIcon, HomeIcon, CategoryIcon } from "@/lib/icons";

interface TocItem {
  tag: string;
  text: string;
  id: string;
}

export function DetailClient({
  prev, next, recordId, similar, contentHtml, category
}: {
  prev: RecordMeta | null;
  next: RecordMeta | null;
  recordId: string;
  similar: RecordMeta[];
  contentHtml: string;
  category: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [activeTocId, setActiveTocId] = useState("");
  const [readingProgress, setReadingProgress] = useState(0);

  // Reading progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setReadingProgress(Math.min((scrollTop / docHeight) * 100, 100));
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Render category icon into thumbnail
  useEffect(() => {
    const thumb = document.querySelector(".detail-thumbnail span");
    if (thumb) {
      const wrapper = document.createElement("span");
      wrapper.style.cssText = "font-size:48px;position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;";
      wrapper.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${getCategorySvgPath(category)}</svg>`;
      thumb.replaceWith(wrapper);
    }
  }, [category]);

  // Extract TOC from content
  useEffect(() => {
    const temp = document.createElement("div");
    temp.innerHTML = contentHtml;
    const headings = temp.querySelectorAll("h2, h3");
    const items: TocItem[] = [];
    headings.forEach((h, i) => {
      const id = `toc-${i}`;
      h.setAttribute("id", id);
      items.push({ tag: h.tagName.toLowerCase(), text: h.textContent || "", id });
    });
    setTocItems(items);

    const contentEl = document.querySelector(".detail-content");
    if (contentEl) {
      contentEl.innerHTML = temp.innerHTML;
    }
  }, [contentHtml]);

  // Active TOC tracking
  useEffect(() => {
    if (tocItems.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveTocId(entry.target.id);
        }
      }
    }, { rootMargin: "-80px 0px -60% 0px" });

    tocItems.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [tocItems]);

  // Code copy buttons
  useEffect(() => {
    document.querySelectorAll(".detail-content pre").forEach((pre) => {
      if (pre.parentElement?.classList.contains("code-block-wrapper")) return;
      const wrapper = document.createElement("div");
      wrapper.className = "code-block-wrapper";
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const btn = document.createElement("button");
      btn.className = "code-copy-btn icon-btn";
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
      btn.setAttribute("data-code", pre.textContent || "");
      btn.addEventListener("click", () => {
        const code = btn.getAttribute("data-code") || "";
        navigator.clipboard.writeText(code).then(() => {
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
          btn.classList.add("copied");
          setTimeout(() => {
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
            btn.classList.remove("copied");
          }, 2000);
        });
      });
      wrapper.appendChild(btn);
    });
  }, [contentHtml]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, []);

  return (
    <>
      {/* Reading progress bar */}
      <div className="reading-progress">
        <div className="reading-progress-fill" style={{ width: `${readingProgress}%` }} />
      </div>

      {/* Action buttons */}
      <div className="detail-actions">
        <button className="detail-action-btn" onClick={() => router.push(`/settings?edit=${recordId}`)}>
          <EditIcon size={12} /> Edit
        </button>
        <button
          className={`detail-action-btn${copied ? " copied" : ""}`}
          onClick={handleCopyLink}
        >
          {copied ? <><CodeIcon size={12} /> Copied</> : <><LinkIcon size={12} /> Copy Link</>}
        </button>
      </div>

      {/* TOC */}
      {tocItems.length > 0 && (
        <div className="detail-toc visible">
          <div className="detail-toc-title"><BookOpenIcon size={10} /> Contents</div>
          {tocItems.map((item) => (
            <a
              key={item.id}
              className={`detail-toc-item ${item.tag}${activeTocId === item.id ? " active" : ""}`}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {item.text}
            </a>
          ))}
        </div>
      )}

      {/* Navigation */}
      <nav className="detail-nav">
        {prev ? (
          <Link href={`/records/${prev.id}`} className="nav-prev">
            <ArrowLeftIcon size={14} />
            <span className="nav-label">{t("prevLabel")}</span>
            <span className="nav-title">{prev.title}</span>
          </Link>
        ) : (
          <div style={{ visibility: "hidden" }} />
        )}
        <Link href="/" className="nav-back"><HomeIcon size={14} /> {t("back")}</Link>
        {next ? (
          <Link href={`/records/${next.id}`} className="nav-next">
            <span className="nav-label">{t("nextLabel")}</span>
            <ArrowRightIcon size={14} />
            <span className="nav-title">{next.title}</span>
          </Link>
        ) : (
          <div style={{ visibility: "hidden" }} />
        )}
      </nav>

      {/* Similar recommendations */}
      {similar.length > 0 && (
        <div className="similar-section">
          <div className="similar-title"><BookOpenIcon size={14} /> Similar Articles</div>
          <div className="similar-list">
            {similar.map((r) => {
              const cat = CATEGORIES[r.category as keyof typeof CATEGORIES] || {};
              const colorIdx = Object.keys(CATEGORIES).indexOf(r.category);
              const color = THUMB_COLORS[colorIdx >= 0 ? colorIdx : 0];
              return (
                <div
                  key={r.id}
                  className="similar-item"
                  onClick={() => router.push(`/records/${r.id}`)}
                >
                  <div className="similar-item-icon" style={{ background: color }}>
                    <CategoryIcon category={r.category} size={18} />
                  </div>
                  <div className="similar-item-body">
                    <div className="similar-item-title">{r.title}</div>
                    <div className="similar-item-meta">{r.date} · {cat.label || r.category}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function getCategorySvgPath(category: string): string {
  switch (category) {
    case "frontend":
      return '<path d="M6 4 Q3 4 3 7 L3 10 Q3 12 5 12 Q3 12 3 14 L3 17 Q3 20 6 20"/>';
    case "backend":
      return '<path d="M4 6 L20 6 L20 12 L4 12 L4 18 L20 18"/>';
    case "ai":
      return '<path d="M12 2 L13 9 L20 10 L13 11 L12 18 L11 11 L4 10 L11 9 Z"/>';
    case "reading":
      return '<path d="M4 5 L4 19 Q4 20 6 20 L12 20 L12 5 L18 5 Q20 5 20 7 L20 19"/>';
    case "devops":
      return '<path d="M12 4 A8 8 0 1 1 11.99 4 L12 8 L8 5 L12 2"/>';
    case "design":
      return '<path d="M12 2 L20 12 L12 22 L4 12 Z"/>';
    default:
      return '<path d="M6 4 Q3 4 3 7 L3 10 Q3 12 5 12 Q3 12 3 14 L3 17 Q3 20 6 20"/>';
  }
}
