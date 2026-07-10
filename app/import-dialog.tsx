"use client";

import { useState, useEffect } from "react";
import { fetchArticle, fetchRSSFeed, type ImportedArticle, type RSSFeedItem } from "@/lib/article-importer";
import { importArticleAction } from "./actions/import-article";
import {
  GlobeIcon,
  RSSIcon,
  CloseIcon,
  CheckIcon,
  ArrowLeftIcon,
  LoaderIcon,
  SuccessIcon,
  WarningIcon,
  ErrorIcon,
  SearchIcon,
  AttachmentIcon,
} from "@/lib/icons";
import { useLanguage } from "@/lib/language-context";

interface ImportResult {
  title: string;
  status: "ok" | "error";
  message?: string;
}

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"url" | "rss">("url");
  const [urlInput, setUrlInput] = useState("");
  const [rssInput, setRssInput] = useState("");
  const [fetching, setFetching] = useState(false);
  const [article, setArticle] = useState<ImportedArticle | null>(null);
  const [rssItems, setRssItems] = useState<RSSFeedItem[]>([]);
  const [selectedRss, setSelectedRss] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [step, setStep] = useState<"input" | "preview" | "done">("input");
  const [categories, setCategories] = useState<{key: string; label: string}[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/categories?mode=private")
      .then(res => res.ok ? res.json() : [])
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [open]);

  async function handleFetch() {
    if (mode === "url" && !urlInput.trim()) return;
    if (mode === "rss" && !rssInput.trim()) return;

    setFetching(true);
    try {
      if (mode === "url") {
        const result = await fetchArticle(urlInput.trim());
        setArticle(result);
        setStep("preview");
      } else {
        const items = await fetchRSSFeed(rssInput.trim());
        setRssItems(items);
        setSelectedRss(new Set());
        setStep("preview");
      }
    } catch (err: any) {
      setResults([{ title: "", status: "error", message: err.message }]);
      setStep("done");
    } finally {
      setFetching(false);
    }
  }

  function toggleRssItem(link: string) {
    setSelectedRss((prev) => {
      const next = new Set(prev);
      if (next.has(link)) next.delete(link);
      else next.add(link);
      return next;
    });
  }

  function selectAllRss() {
    setSelectedRss(new Set(rssItems.map((i) => i.link)));
  }

  async function handleImport() {
    setImporting(true);
    const importResults: ImportResult[] = [];

    if (mode === "url" && article) {
      const result = await importArticleAction(article);
      importResults.push({
        title: article.title,
        status: result.ok ? "ok" : "error",
        message: result.error,
      });
    } else if (mode === "rss") {
      const selected = rssItems.filter((i) => selectedRss.has(i.link));
      for (const item of selected) {
        try {
          const fetched = await fetchArticle(item.link);
          const result = await importArticleAction(fetched);
          importResults.push({
            title: fetched.title,
            status: result.ok ? "ok" : "error",
            message: result.error,
          });
        } catch (err: any) {
          importResults.push({
            title: item.title,
            status: "error",
            message: err.message,
          });
        }
      }
    }

    setResults(importResults);
    setStep("done");
    setImporting(false);
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="import-dialog">
        <div className="import-dialog-header">
          <h3>{t("importTitle")}</h3>
          <button className="modal-close icon-btn" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>

        {step === "input" && (
          <div className="import-body">
            <div className="import-mode-tabs">
              <button
                className={`import-mode-tab${mode === "url" ? " active" : ""}`}
                onClick={() => setMode("url")}
              >
                <GlobeIcon size={14} /> {t("importUrlTab")}
              </button>
              <button
                className={`import-mode-tab${mode === "rss" ? " active" : ""}`}
                onClick={() => setMode("rss")}
              >
                <RSSIcon size={14} /> {t("importRssTab")}
              </button>
            </div>

            {mode === "url" ? (
              <div className="import-input-area">
                <p className="import-desc">{t("importUrlDesc")}</p>
                <input
                  className="import-input"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/article"
                  onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                />
                <div className="import-actions">
                  <button className="btn btn-secondary" onClick={onClose}>{t("cancel")}</button>
                  <button
                    className="btn btn-primary"
                    onClick={handleFetch}
                    disabled={fetching || !urlInput.trim()}
                  >
                    {fetching ? <><LoaderIcon size={14} /> {t("importFetching")}</> : <><SearchIcon size={14} /> {t("importFetchPreview")}</>}
                  </button>
                </div>
              </div>
            ) : (
              <div className="import-input-area">
                <p className="import-desc">{t("importRssDesc")}</p>
                <input
                  className="import-input"
                  type="url"
                  value={rssInput}
                  onChange={(e) => setRssInput(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                />
                <div className="import-actions">
                  <button className="btn btn-secondary" onClick={onClose}>{t("cancel")}</button>
                  <button
                    className="btn btn-primary"
                    onClick={handleFetch}
                    disabled={fetching || !rssInput.trim()}
                  >
                    {fetching ? <><LoaderIcon size={14} /> {t("importFetching")}</> : <><SearchIcon size={14} /> {t("importBrowseFeed")}</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "preview" && mode === "url" && article && (
          <div className="import-body">
            <div className="import-preview">
              <div className="import-preview-header">
                <span className="import-preview-label">{t("importPreview")}</span>
                <span className="import-preview-badge">{article.category}</span>
              </div>
              <h4 className="import-preview-title">{article.title}</h4>
              <p className="import-preview-summary">{article.summary}</p>
              {article.images.length > 0 && (
                <p className="import-preview-images">
                  <AttachmentIcon size={12} /> {article.images.length} {t("importImages")}
                </p>
              )}
              <div className="import-preview-category">
                <label className="import-preview-cat-label">{t("importCategory")}:</label>
                <select
                  className="import-preview-cat-select"
                  value={article.category}
                  onChange={(e) => setArticle({ ...article, category: e.target.value })}
                >
                  {categories.map(cat => (
                    <option key={cat.key} value={cat.key}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <p className="import-private-hint">{t("importPrivateHint")}</p>
            </div>
            <div className="import-actions">
              <button className="btn btn-secondary" onClick={() => setStep("input")}>
                <ArrowLeftIcon size={14} /> {t("importBack")}
              </button>
              <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                {importing ? <><LoaderIcon size={14} /> {t("importImporting")}</> : <><CheckIcon size={14} /> {t("importImport")}</>}
              </button>
            </div>
          </div>
        )}

        {step === "preview" && mode === "rss" && (
          <div className="import-body">
            <div className="import-rss-toolbar">
              <span className="import-rss-count">{rssItems.length} {t("importArticles")}</span>
              <button className="import-rss-select-all" onClick={selectAllRss}>
                {t("importSelectAll")}
              </button>
            </div>
            <div className="import-rss-list">
              {rssItems.map((item) => (
                <label key={item.link} className="import-rss-item">
                  <input
                    type="checkbox"
                    checked={selectedRss.has(item.link)}
                    onChange={() => toggleRssItem(item.link)}
                  />
                  <div className="import-rss-item-body">
                    <div className="import-rss-item-title">{item.title}</div>
                    <div className="import-rss-item-desc">{item.description}</div>
                  </div>
                </label>
              ))}
            </div>
            <p className="import-private-hint" style={{ marginTop: 12 }}>{t("importPrivateHint")}</p>
            <div className="import-actions">
              <button className="btn btn-secondary" onClick={() => setStep("input")}>
                <ArrowLeftIcon size={14} /> {t("importBack")}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={importing || selectedRss.size === 0}
              >
                {importing ? <><LoaderIcon size={14} /> {t("importImporting")}</> : <><CheckIcon size={14} /> {t("importImport")} ({selectedRss.size})</>}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="import-body">
            <div className="import-done">
              <div className="import-done-icon">
                {errorCount === 0 ? <SuccessIcon size={48} /> : okCount > 0 ? <WarningIcon size={48} /> : <ErrorIcon size={48} />}
              </div>
              <p className="import-done-text">
                {okCount} {t("importSucceeded")}{errorCount > 0 ? `, ${errorCount} ${t("importFailed")}` : ""}
              </p>
              {results.filter((r) => r.status === "error").length > 0 && (
                <div className="import-done-errors">
                  {results.filter((r) => r.status === "error").map((r, i) => (
                    <p key={i} className="import-error-item">{r.title}: {r.message}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="import-actions">
              <button className="btn btn-primary" onClick={onClose}>
                <CheckIcon size={14} /> {t("close")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
