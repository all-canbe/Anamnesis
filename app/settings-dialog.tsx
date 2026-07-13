"use client";

import { useState, useEffect, useCallback } from "react";
import { SunIcon, MoonIcon, MonitorIcon, CloseIcon, BotIcon, InfoIcon, DatabaseIcon } from "@/lib/icons";
import { useLanguage } from "@/lib/language-context";
import type { CachedAgentConfig } from "./shell";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  initialConfig: CachedAgentConfig | null;
}

const THEME_KEY = "zhiyi-theme";
const AGENT_CONFIG_CACHE_KEY = "zhiyi-agent-config";

/** 向量搜索功能开关默认值；服务端标志返回后会覆盖此值 */
const DEFAULT_VECTOR_SEARCH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_VECTOR_SEARCH !== "false";

export function SettingsDialog({ open, onClose, initialConfig }: SettingsDialogProps) {
  const { t } = useLanguage();
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("light");
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl || "");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initialConfig?.model || "Qwen/Qwen2.5-7B-Instruct");
  const [hasKey, setHasKey] = useState(initialConfig?.configured || false);
  const [loading, setLoading] = useState(false);
  const [keyPreview, setKeyPreview] = useState(initialConfig?.keyPreview || "");
  const [keyFocused, setKeyFocused] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [vectorSearchEnabled, setVectorSearchEnabled] = useState(DEFAULT_VECTOR_SEARCH_ENABLED);
  const [zvecEnabled, setZvecEnabled] = useState(
    vectorSearchEnabled ? (initialConfig?.zvecEnabled || false) : false
  );
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState(initialConfig?.embeddingBaseUrl || "");
  const [embeddingApiKey, setEmbeddingApiKey] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState(initialConfig?.embeddingModel || "BAAI/bge-m3");

  // 加载配置，返回是否成功
  const loadSettings = useCallback(async (): Promise<boolean> => {
    try {
      setLoadError("");
      const res = await fetch("/api/settings", { credentials: "same-origin" });
      if (!res.ok) {
        setLoadError(res.status === 401 ? "未登录或登录已过期，请重新登录" : "加载配置失败");
        return false;
      }
      const data = await res.json();
      setBaseUrl(data.baseUrl || "");
      setModel(data.model || "Qwen/Qwen2.5-7B-Instruct");
      setHasKey(data.configured || false);
      setKeyPreview(data.keyPreview || "");
      setApiKey("");
      setKeyFocused(false);
      const serverFlag =
        typeof data.vectorSearchEnabled === "boolean"
          ? data.vectorSearchEnabled
          : DEFAULT_VECTOR_SEARCH_ENABLED;
      setVectorSearchEnabled(serverFlag);
      setZvecEnabled(serverFlag ? (data.zvecEnabled || false) : false);
      setEmbeddingBaseUrl(data.embeddingBaseUrl || "");
      setEmbeddingModel(data.embeddingModel || "BAAI/bge-m3");
      // 同步更新缓存
      const config: CachedAgentConfig = {
        configured: data.configured || false,
        baseUrl: data.baseUrl || "",
        model: data.model || "",
        keyPreview: data.keyPreview,
        embeddingBaseUrl: data.embeddingBaseUrl,
        embeddingModel: data.embeddingModel,
        zvecEnabled: serverFlag ? data.zvecEnabled : false,
      };
      try { localStorage.setItem(AGENT_CONFIG_CACHE_KEY, JSON.stringify(config)); } catch {}
      return true;
    } catch {
      setLoadError("加载配置失败，请检查网络或登录状态");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const savedTheme = localStorage.getItem(THEME_KEY) as "light" | "dark" | "system" | null;
    if (savedTheme) setThemeState(savedTheme);

    // 异步加载，失败时重试（处理认证时序问题）
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 5 && !cancelled; i++) {
        if (await loadSettings() || cancelled) return;
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    })();
    return () => { cancelled = true; };
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
    if (!apiKey && !hasKey) return;
    setLoading(true);
    try {
      const body: Record<string, string | boolean> = {
        baseUrl,
        model,
        embeddingBaseUrl,
        embeddingModel,
        zvecEnabled: vectorSearchEnabled ? zvecEnabled : false,
      };
      if (apiKey) body.apiKey = apiKey;
      if (embeddingApiKey) body.embeddingApiKey = embeddingApiKey;

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setHasKey(true);
        const newPreview = apiKey ? maskKeyLocal(apiKey) : keyPreview;
        if (apiKey) setKeyPreview(newPreview);
        setApiKey("");
        setKeyFocused(false);
        // 更新缓存
        const config: CachedAgentConfig = {
          configured: true,
          baseUrl,
          model,
          keyPreview: newPreview,
          embeddingBaseUrl,
          embeddingModel,
          zvecEnabled: vectorSearchEnabled ? zvecEnabled : false,
        };
        try { localStorage.setItem(AGENT_CONFIG_CACHE_KEY, JSON.stringify(config)); } catch {}
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
          <h3>{t("settingsTitle")}</h3>
          <button className="modal-close icon-btn" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="settings-dialog-body">
          {/* Theme */}
          <div className="settings-group">
            <div className="settings-group-title">{t("settingsTheme")}</div>
            <div className="theme-toggle-group">
              <button
                className={`theme-toggle-btn${theme === "light" ? " active" : ""}`}
                onClick={() => setTheme("light")}
              >
                <SunIcon size={14} /> {t("settingsLight")}
              </button>
              <button
                className={`theme-toggle-btn${theme === "dark" ? " active" : ""}`}
                onClick={() => setTheme("dark")}
              >
                <MoonIcon size={14} /> {t("settingsDark")}
              </button>
              <button
                className={`theme-toggle-btn${theme === "system" ? " active" : ""}`}
                onClick={() => setTheme("system")}
              >
                <MonitorIcon size={14} /> {t("settingsSystem")}
              </button>
            </div>
          </div>

          {/* Agent Settings */}
          <div className="settings-group">
            <div className="settings-group-title">
              <BotIcon size={12} /> {t("settingsAgent")}
            </div>
            {loadError && (
              <div className="settings-row-desc" style={{ color: "var(--color-danger)", marginBottom: 8 }}>
                {loadError}
              </div>
            )}

            <div className="settings-row">
              <div className="settings-row-label">{t("settingsBaseUrl")}</div>
              <input
                className="settings-input"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="e.g. https://api.siliconflow.cn/v1"
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-label">{t("settingsApiKey")}</div>
              <input
                className="settings-input"
                type="password"
                value={keyFocused ? apiKey : (apiKey || (hasKey && keyPreview ? keyPreview : ""))}
                onChange={(e) => setApiKey(e.target.value)}
                onFocus={() => setKeyFocused(true)}
                onBlur={() => setKeyFocused(false)}
                placeholder={hasKey && keyPreview ? `${keyPreview}${t("settingsApiKeyClickHint")}` : "sk-..."}
              />
            </div>

            <div className="settings-row">
              <div className="settings-row-label">{t("settingsModel")}</div>
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
                {hasKey ? t("settingsConfigured") : ""}
              </span>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleSave}
                disabled={loading || !baseUrl || (!apiKey && !hasKey)}
              >
                {loading ? t("settingsSaving") : t("settingsSaveBtn")}
              </button>
            </div>
          </div>

          {/* Vector Search */}
          <div
            className="settings-group"
            style={{ opacity: vectorSearchEnabled ? 1 : 0.5 }}
          >
            <div className="settings-group-title">
              <DatabaseIcon size={12} /> {t("settingsVectorSearch")}
            </div>
            {!vectorSearchEnabled && (
              <div className="settings-row-desc" style={{ marginBottom: 8 }}>
                {t("settingsVectorSearchDisabled")}
              </div>
            )}

            <div className="settings-row">
              <div className="settings-row-label" style={{ display: "flex", alignItems: "center", gap: 4, width: "auto" }}>
                {t("settingsZvec")}
                <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(Embedding)</span>
                <span className="info-tooltip-wrapper">
                  <InfoIcon size={14} />
                  <span className="info-tooltip">
                    {t("settingsZvecTooltip")}
                  </span>
                </span>
              </div>
              <label
                className="settings-checkbox-row"
                style={{
                  marginLeft: "auto",
                  pointerEvents: vectorSearchEnabled ? "auto" : "none",
                  cursor: vectorSearchEnabled ? "pointer" : "not-allowed",
                }}
              >
                <input
                  type="checkbox"
                  checked={zvecEnabled}
                  onChange={(e) => setZvecEnabled(e.target.checked)}
                  disabled={!vectorSearchEnabled}
                />
              </label>
            </div>

            {zvecEnabled && vectorSearchEnabled && (
              <>
                <div className="settings-row">
                  <div className="settings-row-label">{t("settingsBaseUrl")}</div>
                  <input
                    className="settings-input"
                    type="text"
                    value={embeddingBaseUrl}
                    onChange={(e) => setEmbeddingBaseUrl(e.target.value)}
                    placeholder="e.g. https://api.siliconflow.cn/v1"
                  />
                </div>

                <div className="settings-row">
                  <div className="settings-row-label">{t("settingsApiKey")}</div>
                  <input
                    className="settings-input"
                    type="password"
                    value={embeddingApiKey}
                    onChange={(e) => setEmbeddingApiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                </div>

                <div className="settings-row">
                  <div className="settings-row-label">{t("settingsModel")}</div>
                  <input
                    className="settings-input"
                    type="text"
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    placeholder="e.g. BAAI/bge-m3"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}