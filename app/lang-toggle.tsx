"use client";

import { useLanguage } from "@/lib/language-context";

export function LangToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      className="lang-toggle"
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      title={lang === "zh" ? "Switch to English" : "切换到中文"}
    >
      {lang === "zh" ? "EN" : "CN"}
    </button>
  );
}