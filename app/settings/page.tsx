"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";

const STORAGE_KEY = "zhiyi-turso-config";

function loadConfig(): { url: string; token: string } {
  if (typeof window === "undefined") return { url: "", token: "" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { url: "", token: "" };
}

function saveConfig(url: string, token: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, token }));
  document.cookie = `zhiyi-turso-url=${encodeURIComponent(url)};path=/;max-age=31536000`;
  document.cookie = `zhiyi-turso-token=${encodeURIComponent(token)};path=/;max-age=31536000`;
}

function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
  document.cookie = "zhiyi-turso-url=;path=/;max-age=0";
  document.cookie = "zhiyi-turso-token=;path=/;max-age=0";
}

export default function SettingsPage() {
  const { t } = useLanguage();
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  useEffect(() => {
    const cfg = loadConfig();
    setUrl(cfg.url);
    setToken(cfg.token);
  }, []);

  function handleSave() {
    saveConfig(url, token);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClear() {
    clearConfig();
    setUrl("");
    setToken("");
  }

  async function handleTest() {
    if (!url) return;
    setTestResult("testing");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ commands: ["SELECT 1"] }),
      });
      setTestResult(res.ok ? "ok" : "fail");
    } catch {
      setTestResult("fail");
    }
    setTimeout(() => setTestResult("idle"), 3000);
  }

  return (
    <div className="page-view settings-page">
      <div className="settings-header">
        <h2>{t("settings")}</h2>
        <p className="settings-desc">{t("settingsDesc")}</p>
      </div>

      <div className="settings-card">
        <div className="settings-card-title">Turso / sqld {t("settingsDb")}</div>

        <div className="form-group">
          <label>{t("settingsDbUrl")}</label>
          <input
            className="form-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="libsql://mykb.turso.io"
          />
        </div>

        <div className="form-group">
          <label>{t("settingsDbToken")}</label>
          <input
            className="form-input"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="your-turso-auth-token"
          />
        </div>

        <div className="settings-actions">
          <button className="btn btn-secondary" onClick={handleTest} disabled={testResult === "testing" || !url}>
            {testResult === "testing" ? "⏳ ..." : testResult === "ok" ? "✓ OK" : testResult === "fail" ? "✕ Failed" : "🔌 Test"}
          </button>
          <div className="settings-actions-right">
            <button className="btn btn-secondary" onClick={handleClear}>{t("settingsClear")}</button>
            <button className="btn btn-primary" onClick={handleSave}>
              {saved ? "✓ Saved" : t("settingsSave")}
            </button>
          </div>
        </div>

        <div className="settings-hint">
          <p>{t("settingsHint1")}</p>
          <p>{t("settingsHint2")}</p>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-title">{t("settingsAbout")}</div>
        <div className="settings-about">
          <p><strong>{t("settingsArch")}</strong></p>
          <ul>
            <li>Web (Vercel) → Turso HTTP API</li>
            <li>CLI (kb) → Turso HTTP API</li>
            <li>Turso → GitHub ({t("settingsBackup")})</li>
          </ul>
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--color-text-muted)" }}>
            {t("settingsNote")}
          </p>
        </div>
      </div>
    </div>
  );
}
