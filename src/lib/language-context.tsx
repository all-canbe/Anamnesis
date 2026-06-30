"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const locales = {
  zh: {
    siteTitle: "知识库",
    records: "记录",
    detail: "详情",
    records_suffix: "records",
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
    settings: "设置",
    settingsDesc: "配置数据库连接，可切换 Turso 或自部署 sqld 服务器",
    settingsDb: "数据库",
    settingsDbUrl: "数据库地址",
    settingsDbToken: "认证 Token",
    settingsSave: "保存",
    settingsClear: "清除",
    settingsHint1: "💡 配置后刷新页面生效。未配置时使用默认存储（本地 fs / GitHub API）。",
    settingsHint2: "🔄 自部署 sqld 的用户，填入你的服务器地址和 token 即可切换。",
    settingsAbout: "关于架构",
    settingsArch: "当前架构：",
    settingsBackup: "版本备份",
    settingsNote: "知忆采用 Turso 主存储 + GitHub 备份的双层架构。Web 和 CLI 均直连 Turso，无需经过应用层中转。",
    leftPanelTitle: "文件树",
    leftPanelUpload: "上传文件夹",
    leftPanelFiles: "文件",
    leftPanelView: "视图",
    leftPanelViewList: "列表",
    leftPanelViewGrid: "网格",
    leftPanelViewCompact: "紧凑",
    leftPanelFilter: "筛选",
    leftPanelSearch: "搜索知识...",
    leftPanelClose: "收起面板",
    agentTitle: "AI 助手",
    agentCollapse: "收起",
    agentExpand: "展开",
    agentWelcome: "你好！我是你的知识助手。我可以帮你：",
    agentFeature1: "总结当前文章",
    agentFeature2: "回答知识库问题",
    agentFeature3: "推荐相关文章",
    agentFeature4: "生成综合报告",
    agentPlaceholder: "向知识库提问...",
    agentSend: "发送",
    agentHint: "Agent 功能开发中，敬请期待",
    agentSessions: "对话列表",
    uploadTitle: "上传文件夹",
    uploadSelectDesc: "选择包含 .md 文件的文件夹",
    uploadSelectHint: "文件夹名将自动识别为分类，.md 文件名将作为标题。支持嵌套文件夹。",
    uploadSelectBtn: "选择文件夹",
    uploadFound: "找到",
    uploadFiles: "个文件",
    uploadTitlePlaceholder: "标题",
    uploadImages: "张图片",
    uploadImport: "导入",
    uploadProgress: "导入中",
    uploadDone: "导入完成",
    uploadSuccess: "个成功",
    uploadFailed: "个失败",
    close: "关闭",
    footerCopyright: "© 2026 知忆",
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
    settings: "Settings",
    settingsDesc: "Configure database connection — switch between Turso and self-hosted sqld",
    settingsDb: "Database",
    settingsDbUrl: "Database URL",
    settingsDbToken: "Auth Token",
    settingsSave: "Save",
    settingsClear: "Clear",
    settingsHint1: "💡 Changes apply on next page load. Falls back to local fs / GitHub API when unset.",
    settingsHint2: "🔄 Self-host sqld users: point to your server address and token.",
    settingsAbout: "Architecture",
    settingsArch: "Current architecture:",
    settingsBackup: "version backup",
    settingsNote: "Zhiyi uses Turso as primary storage with GitHub backup. Both Web and CLI connect directly to Turso via HTTP.",
    leftPanelTitle: "File Tree",
    leftPanelUpload: "Upload Folder",
    leftPanelFiles: "Files",
    leftPanelView: "View",
    leftPanelViewList: "List",
    leftPanelViewGrid: "Grid",
    leftPanelViewCompact: "Compact",
    leftPanelFilter: "Filter",
    leftPanelSearch: "Search knowledge...",
    leftPanelClose: "Close Panel",
    agentTitle: "AI Assistant",
    agentCollapse: "Collapse",
    agentExpand: "Expand",
    agentWelcome: "Hi! I'm your knowledge assistant. I can help you:",
    agentFeature1: "Summarize current article",
    agentFeature2: "Answer knowledge base questions",
    agentFeature3: "Recommend related articles",
    agentFeature4: "Generate comprehensive reports",
    agentPlaceholder: "Ask your knowledge base...",
    agentSend: "Send",
    agentHint: "Agent features coming soon",
    agentSessions: "Sessions",
    uploadTitle: "Upload Folder",
    uploadSelectDesc: "Select a folder containing .md files",
    uploadSelectHint: "Folder name is auto-detected as category, .md filenames become titles. Nested folders supported.",
    uploadSelectBtn: "Select Folder",
    uploadFound: "Found",
    uploadFiles: "files",
    uploadTitlePlaceholder: "Title",
    uploadImages: "images",
    uploadImport: "Import",
    uploadProgress: "Importing",
    uploadDone: "Import complete",
    uploadSuccess: "succeeded",
    uploadFailed: "failed",
    close: "Close",
    footerCopyright: "© 2026 Zhiyi",
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