export type Category = "frontend" | "backend" | "ai" | "reading" | "devops" | "design";
export type ContentFormat = "md" | "html";

export interface RecordMeta {
  id: string;
  slug: string;
  title: string;
  date: string;
  category: Category;
  summary: string;
  format: ContentFormat;
}

export interface ContentRecord {
  meta: RecordMeta;
  content: string;
}

export const CATEGORIES: Record<Category, { label: string; emoji: string }> = {
  frontend: { label: "Frontend", emoji: "🎨" },
  backend: { label: "Backend", emoji: "⚙️" },
  ai: { label: "AI/ML", emoji: "🤖" },
  reading: { label: "Reading", emoji: "📚" },
  devops: { label: "DevOps", emoji: "🚀" },
  design: { label: "Design", emoji: "🎯" }
};

export const THUMB_COLORS = [
  "#fef2f2", "#fefce8", "#f0fdf4", "#eff6ff", "#faf5ff", "#fff7ed"
];