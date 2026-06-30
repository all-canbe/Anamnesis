"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { RecordMeta } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { getRecord } from "@/lib/content";
import { createRecord, updateRecord, removeRecord } from "./actions";
import { mdToHtml, htmlToMd } from "@/lib/md-to-html";

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
    showConfirm("Delete Record", `确定删除 「${record.title}」？此操作不可撤销。`, async () => {
      await removeRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      showToast("已删除");
    });
  }

  if (mode === "editor") {
    return <EditorPage editId={editingId} onDone={showMain} />;
  }

  return (
    <>
      <div className="orchestration-header">
        <h2>Orchestration</h2>
        <button className="btn btn-primary" onClick={startCreate}>+ New Record</button>
      </div>

      {records.length === 0 ? (
        <div className="orchestration-empty">
          <div className="empty-icon">📝</div>
          <div className="empty-text">还没有知识记录</div>
          <button className="btn btn-primary" onClick={startCreate}>+ Create First Record</button>
        </div>
      ) : (
        <table className="orchestration-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Date</th>
              <th>Format</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const cat = CATEGORIES[r.category as keyof typeof CATEGORIES] || {};
              return (
                <tr key={r.id}>
                  <td className="cell-title">{r.title}</td>
                  <td className="cell-category"><span className="category-badge">{cat.label || r.category}</span></td>
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

  const isEdit = editId !== null;

  useEffect(() => {
    if (isEdit && editId) {
      (async () => {
        const r = await getRecord(editId);
        if (r) {
          setTitle(r.meta.title);
          setCategory(r.meta.category);
          setDate(r.meta.date);
          setSummary(r.meta.summary);
          setContent(r.content);
          setFormat(r.meta.format);
        }
      })();
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
    if (!title.trim()) { showToast("请填写标题"); return; }
    if (!summary.trim()) { showToast("请填写摘要"); return; }
    if (!content.trim()) { showToast("请填写内容"); return; }

    const fd = new FormData();
    fd.set("title", title);
    fd.set("category", category);
    fd.set("date", date);
    fd.set("summary", summary);
    fd.set("content", content);
    fd.set("format", format);

    if (isEdit && editId) {
      await updateRecord(editId, fd);
      showToast("已更新");
    } else {
      await createRecord(fd);
      showToast("已发布");
    }
    onDone();
  }

  async function handleDelete() {
    if (!editId) return;
    showConfirm("Delete Record", `确定删除 「${title}」？`, async () => {
      await removeRecord(editId);
      showToast("已删除");
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

  const catOptions = Object.entries(CATEGORIES)
    .filter(([k]) => k !== "all")
    .map(([k, v]) => `<option value="${k}" ${category === k ? "selected" : ""}>${(v as { label: string }).label}</option>`)
    .join("");

  const previewHtml = format === "md" ? mdToHtml(content) : content;

  return (
    <div className="orchestration-form">
      <div className="form-header">
        <h3>{isEdit ? "Edit Record" : "New Record"}</h3>
        <button className="btn btn-secondary" onClick={onDone}>Cancel</button>
      </div>

      <div className="form-group">
        <label>Title</label>
        <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="输入标题..." />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Category</label>
          <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}
            dangerouslySetInnerHTML={{ __html: catOptions }} />
        </div>
        <div className="form-group">
          <label>Date</label>
          <input className="form-input" value={date} onChange={(e) => setDate(e.target.value)} placeholder="YYYY-MM-DD" />
        </div>
        <div className="form-group">
          <label>Format</label>
          <div className="format-toggle">
            <button className={`format-btn${format === "md" ? " active" : ""}`} onClick={() => handleFormatSwitch("md")}>MD</button>
            <button className={`format-btn${format === "html" ? " active" : ""}`} onClick={() => handleFormatSwitch("html")}>HTML</button>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>Summary</label>
        <textarea className="form-textarea short" value={summary} onChange={(e) => setSummary(e.target.value)}
          placeholder="简要描述（显示在列表卡片中）..." />
      </div>

      <div className="form-group">
        <label>Content</label>
        <div className="editor-wrapper">
          <div ref={toolbarRef}></div>
          <textarea
            ref={textareaRef}
            className="form-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={format === "md" ? "输入 Markdown 内容..." : '<p>输入 HTML 内容...</p>'}
            style={{ fontFamily: format === "md" ? "var(--font-mono)" : "var(--font-sans)" }}
          />
        </div>
        <div className="form-hint">
          {format === "md"
            ? "支持 Markdown：##标题 **粗体** *斜体* `代码` >引用 -列表"
            : "支持 HTML 标签：p, h2, h3, ul, ol, li, pre, code, blockquote"}
        </div>
      </div>

      {previewOpen && (
        <>
          <div className="preview-header">
            <span>Preview</span>
            <button className="btn btn-sm btn-secondary" onClick={() => setPreviewOpen(false)}>Close Preview</button>
          </div>
          <div className="preview-panel" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </>
      )}

      <div className="form-actions">
        <div className="actions-left">
          <button className="btn btn-secondary" onClick={() => setPreviewOpen(!previewOpen)}>
            {previewOpen ? "Hide Preview" : "Preview"}
          </button>
          {isEdit && <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>}
        </div>
        <div className="actions-right">
          <button className="btn btn-secondary" onClick={onDone}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{isEdit ? "Update" : "Publish"}</button>
        </div>
      </div>
    </div>
  );
}