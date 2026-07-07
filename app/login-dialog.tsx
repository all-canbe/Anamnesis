"use client";

import { useState } from "react";
import { CloseIcon } from "@/lib/icons";

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess: (username: string) => void;
}

export function LoginDialog({ open, onClose, onLoginSuccess }: LoginDialogProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleLogin() {
    if (!username || !password) {
      setError("请输入用户名和密码");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.ok) {
        onLoginSuccess(data.username);
        onClose();
      } else {
        setError(data.error || "登录失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    e.stopPropagation();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !loading) {
      handleLogin();
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="login-dialog" onClick={handleOverlayClick}>
        <div className="login-dialog-header">
          <h3>登录</h3>
          <button className="modal-close icon-btn" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="login-dialog-body">
          {error && (
            <div className="login-error">{error}</div>
          )}
          <div className="login-row">
            <div className="login-row-label">用户名</div>
            <input
              className="settings-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="login-row">
            <div className="login-row-label">密码</div>
            <input
              className="settings-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="login-actions">
            <button
              className="btn btn-sm btn-primary"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
