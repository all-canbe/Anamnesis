"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { RecordMeta } from "@/lib/types";
import { createRecord, updateRecord, removeRecord, getRecordData } from "./actions";
import { mdToHtml, htmlToMd } from "@/lib/md-to-html";
import { useLanguage } from "@/lib/language-context";

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end);
  const replacement = before + (selected || "text") + after;
  textarea.setRangeText(replacement, start, end, "end");
  textarea.focus();
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function buildToolbar(textarea: HTMLTextAreaElement) {
  const toolbar = document.createElement("div");
  toolbar.className = "editor-toolbar";

  const btns: ({ label: string; title: string; action: () => void } | null)[] = [
    { label: "B", title: "Bold", action: () => wrapSelection(textarea, "**", "**") },
    { label: "I", title: "Italic", action: () => wrapSelection(textarea, "*", "*") },
    { label: "⧸\\", title: "Code", action: () => wrapSelection(textarea, "`", "`") },
    null,
    { label: "H2", title: "Heading 2", action: () => wrapSelection(textarea, "## ", "") },
    { label: "H3", title: "Heading 3", action: () => wrapSelection(textarea, "### ", "") },
    null,
    { label: "•", title: "Unordered list", action: () => wrapSelection(textarea, "- ", "") },
    { label: "1.", title: "Ordered list", action: () => wrapSelection(textarea, "1. ", "") },
    { label: "❝", title: "Blockquote", action: () => wrapSelection(textarea, "> ", "") },
    null,
    { label: "🔗", title: "Link", action: () => wrapSelection(textarea, "[", "](url)") },
    { label: "```", title: "Code block", action: () => wrapSelection(textarea, "```\n", "\n```") },
    null,
    { label: "—", title: "Horizontal rule", action: () => wrapSelection(textarea, "\n---\n", "") },
  ];

  btns.forEach((btn) => {
    if (btn === null) {
      const sep = document.createElement("span");
      sep.className = "toolbar-separator";
      toolbar.appendChild(sep);
    } else {
      const el = document.createElement("button");
      el.className = "toolbar-btn";
      el.textContent = btn.label;
      el.title = btn.title;
      el.addEventListener("click", () => btn.action());
      toolbar.appendChild(el);
    }
  });

  return toolbar;
}

function showToast(msg: string) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function showConfirm(title: string, text: string, onConfirm: () => void) {
  const overlay = document.createElement("div");
  overlay.className = "toast-confirm";
  overlay.innerHTML = `<div class="confirm-box">
    <div class="confirm-title">${title}</div>
    <div class="confirm-text">${text}</div>
    <div class="confirm-actions">
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-danger" data-action="confirm">Delete</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-action=cancel]")!.addEventListener("click", () => overlay.remove());
  overlay.querySelector("[data-action=confirm]")!.addEventListener("click", () => { overlay.remove(); onConfirm(); });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

export function OrchestrationClient({ records: initialRecords }: { records: RecordMeta[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<"main" | "editor">("main");
  const { t } = useLanguage();

  const showMain = useCallback(() => {
    setMode("main");
    setEditingId(null);
  }, []);

  function startCreate() {
    setEditingId(null);
    setMode("editor");
  }

  function startEdit(id: string) {
    setEditingId(id);
    setMode("editor");
  }

  async function handleDelete(id: string) {
    const record = records.find((r) => r.id === id);
    if (!record) return;
    showConfirm(t("deleteConfirmTitle"), `${t("confirmDelete")} 「${record.title}」？${t("deleteConfirmText")}`, async () => {
      await removeRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      showToast(t("deleted"));
    });
  }

  if (mode === "editor") {
    return <EditorPage editId={editingId} onDone={showMain} />;
  }

  return (
    <>
      <div className="orchestration-header">
        <h2>{t("orchestrationTitle")}</h2>
        <button className="btn btn-primary" onClick={startCreate}>{t("newRecord")}</button>
      </div>

      {records.length === 0 ? (
        <div className="orchestration-empty">
          <div className="empty-icon">📝</div>
          <div className="empty-text">{t("noRecordsYet")}</div>
          <button className="btn btn-primary" onClick={startCreate}>{t("createFirst")}</button>
        </div>
      ) : (
        <table className="orchestration-table">
          <thead>
            <tr>
              <th>{t("thTitle")}</th>
              <th>{t("thCategory")}</th>
              <th>{t("thDate")}</th>
              <th>{t("thFormat")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const catLabel = t(`category.${r.category}`);
              return (
                <tr key={r.id}>
                  <td className="cell-title">{r.title}</td>
                  <td className="cell-category"><span className="category-badge">{catLabel}</span></td>
                  <td className="cell-date">{r.date}</td>
                  <td className="cell-format">{(r.format || "html").toUpperCase()}</td>
                  <td className="cell-actions">
                    <button className="btn-icon btn-edit" onClick={() => startEdit(r.id)} title="Edit">✎</button>
                    <button className="btn-icon btn-delete" onClick={() => handleDelete(r.id)} title="Delete" style={{ color: "var(--color-danger)" }}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function EditorPage({ editId, onDone }: { editId: string | null; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("frontend");
  const [date, setDate] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [format, setFormat] = useState<"md" | "html">("md");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  const isEdit = editId !== null;

  useEffect(() => {
    if (isEdit && editId) {
      getRecordData(editId).then((r) => {
        if (r) {
          setTitle(r.meta.title);
          setCategory(r.meta.category);
          setDate(r.meta.date);
          setSummary(r.meta.summary);
          setContent(r.content);
          setFormat(r.meta.format);
        }
        setLoading(false);
      });
    } else {
      const d = new Date();
      setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    setLoading(false);
  }, [editId, isEdit]);

  function handleFormatSwitch(newFmt: "md" | "html") {
    if (newFmt === format) return;
    if (newFmt === "md" && format === "html") {
      setContent(htmlToMd(content));
    } else if (newFmt === "html" && format === "md") {
      setContent(mdToHtml(content));
    }
    setFormat(newFmt);
    setPreviewOpen(false);
  }

  async function handleSave() {
    if (!title.trim()) { showToast(t("titlePlaceholder")); return; }
    if (!summary.trim()) { showToast(t("summaryPlaceholder")); return; }
    if (!content.trim()) { showToast(t("htmlPlaceholder")); return; }

    const fd = new FormData();
    fd.set("title", title);
    fd.set("category", category);
    fd.set("date", date);
    fd.set("summary", summary);
    fd.set("content", content);
    fd.set("format", format);

    if (isEdit && editId) {
      await updateRecord(editId, fd);
      showToast(t("updated"));
    } else {
      await createRecord(fd);
      showToast(t("published"));
    }
    onDone();
  }

  async function handleDelete() {
    if (!editId) return;
    showConfirm(t("deleteConfirmTitle"), `${t("confirmDelete")} 「${title}」？`, async () => {
      await removeRecord(editId);
      showToast(t("deleted"));
      onDone();
    });
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toolbarRef.current || !textareaRef.current) return;
    toolbarRef.current.innerHTML = "";
    if (format === "md") {
      const tb = buildToolbar(textareaRef.current);
      toolbarRef.current.appendChild(tb);
    }
  }, [format]);

  if (loading) return null;

  const catOptions = [
    "frontend", "backend", "ai", "reading", "devops", "design",
  ].map((k) => `<option value="${k}" ${category === k ? "selected" : ""}>${t(`category.${k}`)}</option>`)
    .join("");

  const previewHtml = format === "md" ? mdToHtml(content) : content;

  return (
    <div className="orchestration-form">
      <div className="form-header">
        <h3>{isEdit ? t("editRecord") : t("newRecordTitle")}</h3>
        <button className="btn btn-secondary" onClick={onDone}>{t("cancel")}</button>
      </div>

      <div className="form-group">
        <label>{t("thTitle")}</label>
        <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>{t("thCategory")}</label>
          <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}
            dangerouslySetInnerHTML={{ __html: catOptions }} />
        </div>
        <div className="form-group">
          <label>{t("thDate")}</label>
          <input className="form-input" value={date} onChange={(e) => setDate(e.target.value)} placeholder="YYYY-MM-DD" />
        </div>
        <div className="form-group">
          <label>{t("thFormat")}</label>
          <div className="format-toggle">
            <button className={`format-btn${format === "md" ? " active" : ""}`} onClick={() => handleFormatSwitch("md")}>MD</button>
            <button className={`format-btn${format === "html" ? " active" : ""}`} onClick={() => handleFormatSwitch("html")}>HTML</button>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>{t("summary")}</label>
        <textarea className="form-textarea short" value={summary} onChange={(e) => setSummary(e.target.value)}
          placeholder={t("summaryPlaceholder")} />
      </div>

      <div className="form-group">
        <label>{t("content")}</label>
        <div className="editor-wrapper">
          <div ref={toolbarRef}></div>
          <textarea
            ref={textareaRef}
            className="form-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={format === "md" ? t("mdPlaceholder") : t("htmlPlaceholder")}
            style={{ fontFamily: format === "md" ? "var(--font-mono)" : "var(--font-sans)" }}
          />
        </div>
        <div className="form-hint">
          {format === "md" ? t("mdHint") : t("htmlHint")}
        </div>
      </div>

      {previewOpen && (
        <>
          <div className="preview-header">
            <span>{t("preview")}</span>
            <button className="btn btn-sm btn-secondary" onClick={() => setPreviewOpen(false)}>{t("closePreview")}</button>
          </div>
          <div className="preview-panel" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </>
      )}

      <div className="form-actions">
        <div className="actions-left">
          <button className="btn btn-secondary" onClick={() => setPreviewOpen(!previewOpen)}>
            {previewOpen ? t("hidePreview") : t("preview")}
          </button>
          {isEdit && <button className="btn btn-danger btn-sm" onClick={handleDelete}>{t("delete")}</button>}
        </div>
        <div className="actions-right">
          <button className="btn btn-secondary" onClick={onDone}>{t("cancel")}</button>
          <button className="btn btn-primary" onClick={handleSave}>{isEdit ? t("update") : t("publish")}</button>
        </div>
      </div>
    </div>
  );
}