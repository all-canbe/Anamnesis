"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const locales = {
  zh: {
    siteTitle: "知识库",
    records: "记录",
    tags: "标签",
    orchestration: "编排",
    detail: "详情",
    records_suffix: "条记录",
    noRecords: "暂无记录",
    tagHeaderTitle: "标签",
    tagHeaderDesc: "浏览所有知识分类标签，点击查看该分类下的全部记录。",
    tagAddKey: "标识 (如 mobile)",
    tagAddLabel: "名称 (如 Mobile)",
    tagAddEmoji: "表情 (如 📱)",
    addTag: "+ 添加",
    orchestrationTitle: "编排",
    newRecord: "+ 新记录",
    createFirst: "+ 创建第一条记录",
    noRecordsYet: "还没有知识记录",
    thTitle: "标题",
    thCategory: "分类",
    thDate: "日期",
    thFormat: "格式",
    editRecord: "编辑记录",
    newRecordTitle: "新记录",
    cancel: "取消",
    save: "保存",
    update: "更新",
    publish: "发布",
    delete: "删除",
    preview: "预览",
    hidePreview: "隐藏预览",
    closePreview: "关闭预览",
    prevLabel: "前一篇",
    nextLabel: "后一篇",
    prev: "上一篇",
    next: "下一篇",
    back: "返回",
    deleted: "已删除",
    updated: "已更新",
    published: "已发布",
    titlePlaceholder: "输入标题...",
    summaryPlaceholder: "简要描述（显示在列表卡片中）...",
    mdPlaceholder: "输入 Markdown 内容...",
    htmlPlaceholder: '<p>输入 HTML 内容...</p>',
    mdHint: "支持 Markdown：##标题 **粗体** *斜体* `代码` >引用 -列表",
    htmlHint: "支持 HTML 标签：p, h2, h3, ul, ol, li, pre, code, blockquote",
    bold: "粗体",
    italic: "斜体",
    code: "行内代码",
    heading2: "标题 2",
    heading3: "标题 3",
    unorderedList: "无序列表",
    orderedList: "有序列表",
    blockquote: "引用",
    link: "链接",
    codeBlock: "代码块",
    horizontalRule: "分隔线",
    switchLang: "English",
    footerCopyright: "© 2026 知识库",
    deleteConfirmTitle: "删除记录",
    deleteConfirmText: "此操作不可撤销。",
    confirmDelete: "确定删除",
    summary: "摘要",
    content: "内容",
    all: "全部",
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
    tags: "Tags",
    orchestration: "Orchestration",
    detail: "Detail",
    records_suffix: "records",
    noRecords: "No records yet",
    tagHeaderTitle: "Tags",
    tagHeaderDesc: "Browse all tags. Click a tag to view its records.",
    tagAddKey: "Key (e.g. mobile)",
    tagAddLabel: "Label (e.g. Mobile)",
    tagAddEmoji: "Emoji (e.g. 📱)",
    addTag: "+ Add",
    orchestrationTitle: "Orchestration",
    newRecord: "+ New Record",
    createFirst: "+ Create First Record",
    noRecordsYet: "No records yet.",
    thTitle: "Title",
    thCategory: "Category",
    thDate: "Date",
    thFormat: "Format",
    editRecord: "Edit Record",
    newRecordTitle: "New Record",
    cancel: "Cancel",
    save: "Save",
    update: "Update",
    publish: "Publish",
    delete: "Delete",
    preview: "Preview",
    hidePreview: "Hide Preview",
    closePreview: "Close Preview",
    prevLabel: "PREV",
    nextLabel: "NEXT",
    prev: "Prev",
    next: "Next",
    back: "BACK",
    deleted: "Deleted",
    updated: "Updated",
    published: "Published",
    titlePlaceholder: "Enter title...",
    summaryPlaceholder: "Brief summary (shown in list)...",
    mdPlaceholder: "Enter Markdown content...",
    htmlPlaceholder: "<p>Enter HTML content...</p>",
    mdHint: "Markdown: ##Heading **bold** *italic* `code` >quote -list",
    htmlHint: "Supports: p, h2, h3, ul, ol, li, pre, code, blockquote",
    bold: "Bold",
    italic: "Italic",
    code: "Code",
    heading2: "Heading 2",
    heading3: "Heading 3",
    unorderedList: "Unordered list",
    orderedList: "Ordered list",
    blockquote: "Blockquote",
    link: "Link",
    codeBlock: "Code block",
    horizontalRule: "Horizontal rule",
    switchLang: "中文",
    footerCopyright: "© 2026 Knowledge Base",
    deleteConfirmTitle: "Delete Record",
    deleteConfirmText: "This action cannot be undone.",
    confirmDelete: "Delete",
    summary: "Summary",
    content: "Content",
    all: "All",
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