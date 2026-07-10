"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RecordMeta } from "@/lib/types";
import { THUMB_COLORS } from "@/lib/types";
import { useLanguage } from "@/lib/language-context";
import { ArrowLeftIcon, ArrowRightIcon, BookOpenIcon, HomeIcon, CategoryIcon, getCategorySvgPath } from "@/lib/icons";

interface TocItem {
  tag: string;
  text: string;
  id: string;
}

export function DetailClient({
  prev, next, recordId, similar, contentHtml, category, categories
}: {
  prev: RecordMeta | null;
  next: RecordMeta | null;
  recordId: string;
  similar: RecordMeta[];
  contentHtml: string;
  category: string;
  categories?: { key: string; label: string }[];
}) {
  const { t } = useLanguage();
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
      wrapper.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${getCategorySvgPath(category)}"/></svg>`;
      thumb.replaceWith(wrapper);
    }
  }, [category]);

  // Extract TOC from content and create floating panel
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

    // Remove old floating panel if it exists
    const old = document.getElementById("floating-toc");
    if (old) old.remove();

    // Create floating TOC panel
    const panel = document.createElement("div");
    panel.id = "floating-toc";
    panel.className = "floating-toc";

    if (items.length > 0) {
      panel.innerHTML =
        `<div class="floating-toc-title">${t("detailContents")}</div>` +
        items.map((item) =>
          `<a class="detail-toc-item ${item.tag}" href="#${item.id}" data-toc-id="${item.id}">${item.text}</a>`
        ).join("");
    }

    document.body.appendChild(panel);

    // Position the panel between nav-bar and detail-view
    function reposition() {
      const navBar = document.querySelector(".nav-bar");
      const detailView = document.querySelector(".detail-view");
      if (!navBar || !detailView || items.length === 0) return;

      const navRect = navBar.getBoundingClientRect();
      const detailRect = detailView.getBoundingClientRect();
      const tocWidth = 200;
      const minGap = 80;

      const gap = detailRect.left - navRect.right;
      const availWidth = gap;

      const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height || 56;

      // Hide if too narrow
      if (availWidth < tocWidth + minGap * 2) {
        panel.style.display = "none";
        return;
      }
      panel.style.display = "";

      // Center TOC in the gap
      const tocLeft = navRect.right + (availWidth - tocWidth) / 2;
      const tocTop = Math.max(navRect.top + headerHeight + 16, 80);

      panel.style.left = `${tocLeft}px`;
      panel.style.top = `${tocTop}px`;
      panel.style.width = `${tocWidth}px`;
    }

    reposition();

    const ro = new ResizeObserver(reposition);
    ro.observe(document.body);
    window.addEventListener("scroll", reposition, { passive: true });

    return () => {
      panel.remove();
      ro.disconnect();
      window.removeEventListener("scroll", reposition);
    };
  }, [contentHtml]);

  // Active TOC tracking + click delegation
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

    const panel = document.getElementById("floating-toc");
    function handleTocClick(e: Event) {
      const target = e.target as HTMLElement;
      if (target.classList.contains("detail-toc-item")) {
        e.preventDefault();
        const href = target.getAttribute("href");
        if (href) {
          const el = document.getElementById(href.slice(1));
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
    panel?.addEventListener("click", handleTocClick);

    return () => {
      observer.disconnect();
      panel?.removeEventListener("click", handleTocClick);
    };
  }, [tocItems]);

  // Sync active TOC item
  useEffect(() => {
    const panel = document.getElementById("floating-toc");
    if (!panel) return;
    panel.querySelectorAll(".detail-toc-item").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-toc-id") === activeTocId);
    });
  }, [activeTocId]);

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
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>';
      btn.setAttribute("data-code", pre.textContent || "");
      btn.addEventListener("click", () => {
        const code = btn.getAttribute("data-code") || "";
        navigator.clipboard.writeText(code).then(() => {
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
          btn.classList.add("copied");
          setTimeout(() => {
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>';
            btn.classList.remove("copied");
          }, 2000);
        });
      });
      wrapper.appendChild(btn);
    });
  }, [contentHtml]);

  return (
    <>
      {/* Reading progress bar */}
      <div className="reading-progress">
        <div className="reading-progress-fill" style={{ width: `${readingProgress}%` }} />
      </div>

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
          <div className="similar-title"><BookOpenIcon size={14} /> {t("detailSimilarTitle")}</div>
          <div className="similar-list">
            {similar.map((r) => {
              const cat = categories?.find(c => c.key === r.category);
              const colorIdx = categories?.findIndex(c => c.key === r.category) ?? -1;
              const color = THUMB_COLORS[colorIdx >= 0 ? colorIdx : 0];
              return (
                <div
                  key={r.id}
                  className="similar-item"
                  onClick={() => { window.location.href = `/records/${r.id}`; }}
                >
                  <div className="similar-item-icon" style={{ background: color }}>
                    <CategoryIcon category={r.category} size={18} />
                  </div>
                  <div className="similar-item-body">
                    <div className="similar-item-title">{r.title}</div>
                    <div className="similar-item-meta">{r.date} · {cat?.label || r.category}</div>
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
