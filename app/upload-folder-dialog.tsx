"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";

interface ParsedFile {
  path: string;
  filename: string;
  title: string;
  content: string;
  category: string;
  summary: string;
  images: string[];
}

interface UploadResult {
  path: string;
  status: "ok" | "skip" | "error";
  message?: string;
}

export function UploadFolderDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [step, setStep] = useState<"select" | "preview" | "uploading" | "done">("select");
  const [results, setResults] = useState<UploadResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [categories, setCategories] = useState<{key: string; label: string}[]>([]);
  useEffect(() => {
    fetch("/api/categories?mode=private")
      .then(res => res.ok ? res.json() : [])
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);
  const [skillName, setSkillName] = useState("");

  function parseTitle(filename: string): string {
    let name = filename.replace(/\.md$/i, "");
    name = name.replace(/^\d+[\s\-_\.]+/, "");
    name = name.replace(/[-_]/g, " ");
    return name;
  }

  function parseSummary(content: string): string {
    const text = content
      .replace(/^---[\s\S]*?---\n?/, "")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/[#*`>\[\]]/g, "")
      .trim();
    return text.slice(0, 120).replace(/\n/g, " ").trim() + (text.length > 120 ? "..." : "");
  }

  function detectCategory(path: string): string {
    const lower = path.toLowerCase();
    const catMap: Record<string, string> = {
      frontend: "frontend", backend: "backend", ai: "ai", ml: "ai",
      reading: "reading", book: "reading", devops: "devops", ops: "devops",
      design: "design", ui: "design", ux: "design",
    };
    for (const [key, val] of Object.entries(catMap)) {
      if (lower.includes(key)) return val;
    }
    return "reading";
  }

  function extractImages(content: string): string[] {
    const urls: string[] = [];
    const regex = /!\[.*?\]\((.*?)\)/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
      urls.push(m[1]);
    }
    return urls;
  }

  const handleFolderSelect = useCallback(async () => {
    const input = inputRef.current;
    if (!input || !input.files) return;

    const fileList = Array.from(input.files);
    const mdFiles = fileList.filter((f) => f.name.endsWith(".md"));
    const imageFiles = fileList.filter((f) => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f.name));

    const parsed: ParsedFile[] = [];
    let detectedSkillName = "";

    // Check for skill.json
    const skillJsonFile = fileList.find((f) => f.name === "skill.json");
    if (skillJsonFile) {
      try {
        const skillContent = await skillJsonFile.text();
        const skillMeta = JSON.parse(skillContent);
        detectedSkillName = skillMeta.name || "";
      } catch {}
    }

    for (const file of mdFiles) {
      if (file.name === "skill.json") continue;
      const content = await file.text();
      const relativePath = file.webkitRelativePath || file.name;
      const title = parseTitle(file.name);
      const category = detectCategory(relativePath);
      const summary = parseSummary(content);
      const images = extractImages(content);

      parsed.push({
        path: relativePath,
        filename: file.name,
        title,
        content,
        category,
        summary,
        images,
      });
    }

    if (parsed.length === 0) {
      setResults([{ path: "", status: "error", message: "No .md files found in the selected folder" }]);
      setStep("done");
      return;
    }

    setSkillName(detectedSkillName);
    setFiles(parsed);
    setStep("preview");
  }, []);

  function updateFile(index: number, updates: Partial<ParsedFile>) {
    setFiles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }

  async function handleUpload() {
    setStep("uploading");
    const uploadResults: UploadResult[] = [];

    const token = (() => {
      try {
        const raw = localStorage.getItem("zhiyi-turso-config");
        if (raw) {
          const cfg = JSON.parse(raw);
          return cfg.token || "";
        }
      } catch {}
      return "";
    })();

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const slug = f.title
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60);

        const res = await fetch("/api/cli", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            command: "publish",
            title: f.title,
            slug,
            category: f.category,
            summary: f.summary,
            content: f.content,
            format: "md",
          }),
        });

        const data = await res.json();
        if (res.ok) {
          uploadResults.push({ path: f.path, status: "ok" });
        } else {
          uploadResults.push({ path: f.path, status: "error", message: data.error || "Unknown error" });
        }
      } catch (err) {
        uploadResults.push({ path: f.path, status: "error", message: String(err) });
      }
      setProgress(i + 1);
    }

    setResults(uploadResults);
    setStep("done");
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="upload-dialog">
        <div className="upload-dialog-header">
          <h3>{t("uploadTitle")}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {step === "select" && (
          <div className="upload-select">
            <div className="upload-select-icon">📂</div>
            <p className="upload-select-text">{t("uploadSelectDesc")}</p>
            <p className="upload-select-hint">{t("uploadSelectHint")}</p>
            <input
              ref={inputRef}
              type="file"
              {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
              multiple
              style={{ display: "none" }}
              onChange={handleFolderSelect}
            />
            <button className="btn btn-primary" onClick={() => inputRef.current?.click()}>
              {t("uploadSelectBtn")}
            </button>
          </div>
        )}

        {step === "preview" && (
          <div className="upload-preview">
            {skillName && (
              <div className="upload-preview-skill">
                📦 <strong>{skillName}</strong>
              </div>
            )}
            <p className="upload-preview-count">
              {t("uploadFound")} <strong>{files.length}</strong> {t("uploadFiles")}
            </p>
            <div className="upload-preview-list">
              {files.map((f, i) => (
                <div key={i} className="upload-preview-item">
                  <div className="upload-preview-path">{f.path}</div>
                  <div className="upload-preview-fields">
                    <input
                      className="upload-preview-input"
                      value={f.title}
                      onChange={(e) => updateFile(i, { title: e.target.value })}
                      placeholder={t("uploadTitlePlaceholder")}
                    />
                    <select
                      className="upload-preview-select"
                      value={f.category}
                      onChange={(e) => updateFile(i, { category: e.target.value })}
                    >
                      {categories.map(cat => (
                        <option key={cat.key} value={cat.key}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="upload-preview-summary">{f.summary}</div>
                  {f.images.length > 0 && (
                    <div className="upload-preview-images">
                      📎 {f.images.length} {t("uploadImages")}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="upload-preview-actions">
              <button className="btn btn-secondary" onClick={onClose}>{t("cancel")}</button>
              <button className="btn btn-primary" onClick={handleUpload}>
                {t("uploadImport")} ({files.length})
              </button>
            </div>
          </div>
        )}

        {step === "uploading" && (
          <div className="upload-progress">
            <div className="upload-progress-bar">
              <div
                className="upload-progress-fill"
                style={{ width: `${(progress / files.length) * 100}%` }}
              />
            </div>
            <p className="upload-progress-text">
              {t("uploadProgress")} {progress}/{files.length}
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="upload-done">
            <div className="upload-done-icon">
              {errorCount === 0 ? "✅" : okCount > 0 ? "⚠️" : "❌"}
            </div>
            <p className="upload-done-text">
              {t("uploadDone")} {okCount} {t("uploadSuccess")}
              {errorCount > 0 && `, ${errorCount} ${t("uploadFailed")}`}
            </p>
            {results.filter((r) => r.status === "error").length > 0 && (
              <div className="upload-done-errors">
                {results.filter((r) => r.status === "error").map((r, i) => (
                  <p key={i} className="upload-error-item">{r.path}: {r.message}</p>
                ))}
              </div>
            )}
            <div className="upload-preview-actions">
              <button className="btn btn-primary" onClick={onClose}>{t("close")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
