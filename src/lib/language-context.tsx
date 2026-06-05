"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const locales = {
  zh: {
    siteTitle: "知识库",
    records: "记录",
    detail: "详情",
    records_suffix: "条记录",
    noRecords: "暂无记录",
    cancel: "取消",
    delete: "删除",
    preview: "预览",
    hidePreview: "隐藏预览",
    closePreview: "关闭预览",
    back: "返回",
    prevLabel: "前一篇",
    nextLabel: "后一篇",
    deleted: "已删除",
    updated: "已更新",
    published: "已发布",
    all: "全部",
    switchLang: "English",
    footerCopyright: "© 2026 知识库",
    category: {
      frontend: "前端",
      backend: "后端",
      ai: "AI/ML",
      reading: "阅读",
      devops: "DevOps",
      design: "设计",
    },
  },
  en: {
    siteTitle: "Knowledge Base",
    records: "Records",
    detail: "Detail",
    records_suffix: "records",
    noRecords: "No records yet",
    cancel: "Cancel",
    delete: "Delete",
    preview: "Preview",
    hidePreview: "Hide Preview",
    closePreview: "Close Preview",
    back: "BACK",
    prevLabel: "PREV",
    nextLabel: "NEXT",
    deleted: "Deleted",
    updated: "Updated",
    published: "Published",
    all: "All",
    switchLang: "中文",
    footerCopyright: "© 2026 Knowledge Base",
    category: {
      frontend: "Frontend",
      backend: "Backend",
      ai: "AI/ML",
      reading: "Reading",
      devops: "DevOps",
      design: "Design",
    },
  },
};

type Lang = "zh" | "en";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

function lookup(key: string, lang: Lang): string {
  const keys = key.split(".");
  let obj: Record<string, unknown> = locales[lang] || locales.zh;
  for (const k of keys) {
    if (obj && typeof obj === "object" && k in obj) {
      obj = obj[k] as Record<string, unknown>;
    } else {
      return key;
    }
  }
  return typeof obj === "string" ? obj : key;
}

const LangContext = createContext<LangContextValue>({
  lang: "zh",
  setLang: () => {},
  t: (key: string) => lookup(key, "zh"),
});

export function useLanguage() {
  return useContext(LangContext);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("kb-lang") as Lang | null;
    if (saved === "en" || saved === "zh") setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("kb-lang", l);
  }

  function t(key: string): string {
    return lookup(key, lang);
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}