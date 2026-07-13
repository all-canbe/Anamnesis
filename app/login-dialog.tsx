"use client";

import { useState, useRef, useEffect } from "react";
import { CloseIcon } from "@/lib/icons";
import { useLanguage } from "@/lib/language-context";

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess: (email: string) => void;
}

// 滑块尺寸常量
const THUMB_WIDTH = 30;
const SLIDER_PADDING = 3;

/** 获取滑块验证码令牌 */
async function fetchCaptchaToken(): Promise<string> {
  const res = await fetch("/api/auth/captcha");
  const data = await res.json();
  if (data.ok) return data.token;
  throw new Error("获取验证码令牌失败");
}

export function LoginDialog({ open, onClose, onLoginSuccess }: LoginDialogProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [account, setAccount] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const [sliderDone, setSliderDone] = useState(false);
  const [sliderPos, setSliderPos] = useState(0);
  const [sliderProgress, setSliderProgress] = useState(0);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const captchaFetched = useRef(false);

  // 打开弹窗时预加载滑块验证码令牌
  useEffect(() => {
    if (!open) return;
    captchaFetched.current = false;
    setCaptchaToken("");
    setSliderDone(false);
    setSliderPos(0);
    setSliderProgress(0);
    setCode("");
    setCodeCountdown(0);
    setError("");
    initCaptcha();
  }, [open]);

  async function initCaptcha() {
    if (captchaFetched.current) return;
    captchaFetched.current = true;
    setCaptchaLoading(true);
    try {
      const token = await fetchCaptchaToken();
      setCaptchaToken(token);
    } catch {
      // 静默失败，用户滑动时再重试
    } finally {
      setCaptchaLoading(false);
    }
  }

  function resetSlider() {
    setSliderDone(false);
    setSliderPos(0);
    setSliderProgress(0);
    setCaptchaToken("");
    captchaFetched.current = false;
    // 重新获取令牌
    initCaptcha();
  }

  // 滑块验证
  function handleSliderStart(e: React.MouseEvent | React.TouchEvent) {
    if (sliderDone) return;
    e.preventDefault();
    dragging.current = true;
    const track = sliderRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();

    function onMove(ev: MouseEvent | TouchEvent) {
      if (!dragging.current) return;
      const cx = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const maxX = rect.width - THUMB_WIDTH - SLIDER_PADDING * 2;
      const pos = Math.max(0, Math.min(maxX, cx - rect.left - SLIDER_PADDING - THUMB_WIDTH / 2));
      setSliderPos(pos);
      setSliderProgress((pos / maxX) * 100);
      if (pos >= maxX - 2) {
        dragging.current = false;
        setSliderPos(maxX);
        setSliderProgress(100);
        setSliderDone(true);
        // 滑动完成后 always 刷新令牌，确保发送验证码/注册时令牌未过期
        setCaptchaLoading(true);
        fetchCaptchaToken()
          .then((token) => setCaptchaToken(token))
          .catch(() => resetSlider())
          .finally(() => setCaptchaLoading(false));
        cleanup();
      }
    }

    function onEnd() {
      if (!dragging.current) { cleanup(); return; }
      dragging.current = false;
      setSliderPos(0);
      setSliderProgress(0);
      cleanup();
    }

    function cleanup() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onEnd);
  }

  // 发送验证码
  async function handleSendCode() {
    if (!email) {
      setError(t("loginErrorEmpty"));
      return;
    }
    if (!sliderDone || !captchaToken || captchaLoading) {
      setError(t("sliderCaptcha"));
      return;
    }
    setSendingCode(true);
    setError("");
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, captchaToken }),
      });
      const data = await res.json();
      if (data.ok) {
        setCodeCountdown(60);
        const timer = setInterval(() => {
          setCodeCountdown((c) => {
            if (c <= 1) { clearInterval(timer); return 0; }
            return c - 1;
          });
        }, 1000);
      } else {
        setError(data.error || "发送失败");
        resetSlider();
      }
    } catch {
      setError(t("loginErrorNetwork"));
      resetSlider();
    } finally {
      setSendingCode(false);
    }
  }

  // 登录
  async function handleLogin() {
    if (!account || !password) {
      setError(t("loginErrorEmpty"));
      return;
    }
    if (!sliderDone || !captchaToken || captchaLoading) {
      setError(t("sliderCaptcha"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: account, password, captchaToken }),
      });
      const data = await res.json();
      if (data.ok) {
        onLoginSuccess(data.email);
        onClose();
      } else {
        setError(data.error || t("loginErrorFailed"));
        resetSlider();
      }
    } catch {
      setError(t("loginErrorNetwork"));
      resetSlider();
    } finally {
      setLoading(false);
    }
  }

  // 注册
  async function handleRegister() {
    if (!email || !password || !code) {
      setError(t("loginErrorEmpty"));
      return;
    }
    if (!sliderDone || !captchaToken || captchaLoading) {
      setError(t("sliderCaptcha"));
      return;
    }
    if (password.length < 6) {
      setError(t("passwordMinLength"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, code, captchaToken }),
      });
      const data = await res.json();
      if (data.ok) {
        onLoginSuccess(data.email);
        onClose();
      } else {
        setError(data.error || "注册失败");
        resetSlider();
      }
    } catch {
      setError(t("loginErrorNetwork"));
      resetSlider();
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    if (mode === "login") handleLogin();
    else handleRegister();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !loading) {
      handleSubmit();
    }
  }

  function switchMode() {
    setMode(mode === "login" ? "register" : "login");
    setError("");
    setCode("");
    setCodeCountdown(0);
    resetSlider();
  }

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="login-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="login-dialog-header">
          <h3>{mode === "login" ? t("loginTitle") : t("registerTitle")}</h3>
          <button className="modal-close icon-btn" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="login-dialog-body">
          {error && (
            <div className="login-error">{error}</div>
          )}
          {mode === "login" ? (
            <>
              <div className="login-row">
                <div className="login-row-label">{t("loginAccount")}</div>
                <input
                  className="login-input"
                  type="text"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  onKeyDown={handleKeyDown}
                  autoComplete="username"
                />
              </div>
              <div className="login-row">
                <div className="login-row-label">{t("loginPassword")}</div>
                <input
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  onKeyDown={handleKeyDown}
                  autoComplete="current-password"
                />
              </div>
            </>
          ) : (
            <>
              <div className="login-row">
                <div className="login-row-label">{t("loginEmail")}</div>
                <input
                  className="login-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  onKeyDown={handleKeyDown}
                  autoComplete="email"
                />
              </div>
              <div className="login-row">
                <div className="login-row-label">{t("loginPassword")}</div>
                <input
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  onKeyDown={handleKeyDown}
                  autoComplete="new-password"
                />
              </div>
              <div className="login-row" style={{ flexWrap: "wrap" }}>
                <div className="login-row-label">{t("codePlaceholder")}</div>
                <div className="login-code-row">
                  <input
                    className="login-input"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={t("codePlaceholder")}
                    onKeyDown={handleKeyDown}
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={handleSendCode}
                    disabled={sendingCode || codeCountdown > 0 || !sliderDone || captchaLoading}
                    title={!sliderDone ? t("sliderCaptcha") : undefined}
                  >
                    {sendingCode ? t("sendingCode") : codeCountdown > 0 ? `${codeCountdown}s` : t("sendCode")}
                  </button>
                </div>
                {!sliderDone && (
                  <div className="login-code-hint">{t("sliderCaptcha")}</div>
                )}
              </div>
            </>
          )}
          {/* 滑块验证码 */}
          <div className="login-row">
            <div className="login-row-label">{t("sliderCaptcha")}</div>
            <div className="login-slider" ref={sliderRef}>
              <div className="login-slider-progress" style={{ width: `${sliderProgress}%` }} />
              <div
                className={`login-slider-thumb${sliderDone ? " done" : ""}`}
                style={{ left: `${SLIDER_PADDING + sliderPos}px` }}
                onMouseDown={sliderDone ? undefined : handleSliderStart}
                onTouchStart={sliderDone ? undefined : handleSliderStart}
              >
                {sliderDone ? "✓" : "→"}
              </div>
              <span className={`login-slider-text${sliderDone ? " done" : ""}`}>
                {captchaLoading ? "..." : sliderDone ? t("sliderOk") : t("sliderHint")}
              </span>
            </div>
          </div>
          <div className="login-actions">
            <button
              className="btn btn-sm btn-link"
              onClick={switchMode}
              type="button"
            >
              {mode === "login" ? t("loginOrRegister") : t("registerOrLogin")}
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (mode === "login" ? t("loggingIn") : t("registering")) : (mode === "login" ? t("loginBtn") : t("registerBtn"))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}