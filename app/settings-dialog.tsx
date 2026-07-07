"use client";

import { useState, useEffect, useCallback } from "react";
import { SunIcon, MoonIcon, MonitorIcon, CloseIcon, BotIcon } from "@/lib/icons";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const THEME_KEY = "zhiyi-theme";

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("light");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("Qwen/Qwen2.5-7B-Instruct");
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyPreview, setKeyPreview] = useState(""); // 脱敏后的 Key 预览
  const [keyFocused, setKeyFocused] = useState(false);
  const [loadError, setLoadError] = useState("");

  // 加载配置
  const loadSettings = useCallback(async () => {
    try {
      setLoadError("");
      const res = await fetch("/api/settings", { credentials: "same-origin" });
      if (!res.ok) {
        setLoadError(res.status === 401 ? "未登录或登录已过期，请重新登录" : "加载配置失败");
        return;
      }
      const data = await res.json();
      setBaseUrl(data.baseUrl || "");
      setModel(data.model || "Qwen/Qwen2.5-7B-Instruct");
      setHasKey(data.configured || false);
      setKeyPreview(data.keyPreview || "");
      setApiKey(""); // 清空输入框，用户需手动输入新密钥
      setKeyFocused(false);
    } catch {
      setLoadError("加载配置失败，请检查网络或登录状态");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const savedTheme = localStorage.getItem(THEME_KEY) as "light" | "dark" | "system" | null;
    if (savedTheme) setThemeState(savedTheme);

    loadSettings();
  }, [open, loadSettings]);

  function applyTheme(t: "light" | "dark" | "system") {
    if (t === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else if (t === "light") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    }
  }

  function setTheme(t: "light" | "dark" | "system") {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
    applyTheme(t);
  }

  // 手动保存到数据库
  async function handleSave() {
    if (!baseUrl) return;
    if (!apiKey && !hasKey) return; // 首次配置必须提供 Key
    setLoading(true);
    try {
      const body: Record<string, string> = { baseUrl, model };
      if (apiKey) body.apiKey = apiKey;

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setHasKey(true);
        if (apiKey) {
          setKeyPreview(maskKeyLocal(apiKey));
        }
        setApiKey("");
        setKeyFocused(false);
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  function maskKeyLocal(key: string): string {
    if (key.length <= 8) return key.slice(0, 2) + "****" + key.slice(-2);
    return key.slice(0, 4) + "****" + key.slice(-4);
  }

  function handleOverlayClick(e: React.MouseEvent) {
    // 禁止点击遮罩层关闭，必须点关闭按钮
    e.stopPropagation();
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="settings-dialog">
        <div className="settings-dialog-header">
          <h3>Settings</h3>
          <button className="modal-close icon-btn" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="settings-dialog-body">
          {/* Theme */}
          <div className="settings-group">
            <div className="settings-group-title">Theme</div>
            <div className="theme-toggle-group">
              <button
                className={`theme-toggle-btn${theme === "light" ? " active" : ""}`}
                onClick={() => setTheme("light")}
              >
                <SunIcon size={14} /> Light
              </button>
              <button
                className={`theme-toggle-btn${theme === "dark" ? " active" : ""}`}
                onClick={() => setTheme("dark")}
              >
                <MoonIcon size={14} /> Dark
              </button>
              <button
                className={`theme-toggle-btn${theme === "system" ? " active" : ""}`}
                onClick={() => setTheme("system")}
              >
                <MonitorIcon size={14} /> System
              </button>
            </div>
          </div>

          {/* Agent Settings */}
          <div className="settings-group">
            <div className="settings-group-title">
              <BotIcon size={12} /> Agent
            </div>
            {loadError && (
              <div className="settings-row-desc" style={{ color: "var(--color-danger)", marginBottom: 8 }}>
                {loadError}
              </div>
            )}

            <div className="settings-row">
              <div className="settings-row-label">Base URL</div>
              <input
                className="settings-input"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="e.g. https://api.siliconflow.cn/v1"
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-label">API Key</div>
              <input
                className="settings-input"
                type="password"
                value={keyFocused ? apiKey : (apiKey || (hasKey && keyPreview ? keyPreview : ""))}
                onChange={(e) => setApiKey(e.target.value)}
                onFocus={() => setKeyFocused(true)}
                onBlur={() => setKeyFocused(false)}
                placeholder={hasKey && keyPreview ? `${keyPreview}（点击输入新密钥）` : "sk-..."}
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-label">Model</div>
              <input
                className="settings-input"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Qwen/Qwen2.5-7B-Instruct"
              />
            </div>

            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                {hasKey ? "已配置" : ""}
              </span>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleSave}
                disabled={loading || !baseUrl || (!apiKey && !hasKey)}
              >
                {loading ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}