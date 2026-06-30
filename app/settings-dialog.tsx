"use client";

import { useState, useEffect } from "react";
import { SunIcon, MoonIcon, MonitorIcon, CloseIcon, CheckIcon, BotIcon } from "@/lib/icons";

interface AgentConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

const AGENT_CONFIG_KEY = "zhiyi-agent-config";
const THEME_KEY = "zhiyi-theme";

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("light");
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    baseUrl: "",
    apiKey: "",
    model: "Qwen/Qwen2.5-7B-Instruct",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as "light" | "dark" | "system" | null;
    if (savedTheme) setThemeState(savedTheme);

    const savedAgent = localStorage.getItem(AGENT_CONFIG_KEY);
    if (savedAgent) {
      try {
        setAgentConfig(JSON.parse(savedAgent));
      } catch {}
    }
  }, [open]);

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

  function saveAgentConfig() {
    localStorage.setItem(AGENT_CONFIG_KEY, JSON.stringify(agentConfig));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
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

            <div className="settings-row">
              <div>
                <div className="settings-row-label">Base URL</div>
                <div className="settings-row-desc">e.g. https://api.siliconflow.cn/v1</div>
              </div>
              <input
                className="settings-input"
                type="text"
                value={agentConfig.baseUrl}
                onChange={(e) => setAgentConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="https://api.siliconflow.cn/v1"
              />
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">API Key</div>
                <div className="settings-row-desc">Your LLM provider API key</div>
              </div>
              <input
                className="settings-input"
                type="password"
                value={agentConfig.apiKey}
                onChange={(e) => setAgentConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sk-..."
              />
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">Model</div>
                <div className="settings-row-desc">e.g. Qwen/Qwen2.5-7B-Instruct</div>
              </div>
              <input
                className="settings-input"
                type="text"
                value={agentConfig.model}
                onChange={(e) => setAgentConfig((prev) => ({ ...prev, model: e.target.value }))}
                placeholder="Qwen/Qwen2.5-7B-Instruct"
              />
            </div>
          </div>
        </div>

        <div className="settings-dialog-footer">
          <button className="btn btn-primary" onClick={saveAgentConfig}>
            <CheckIcon size={14} /> {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
