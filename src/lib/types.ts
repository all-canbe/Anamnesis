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

export const CATEGORIES: Record<Category, { label: string; icon: string }> = {
  frontend: { label: "Frontend", icon: "frontend" },
  backend: { label: "Backend", icon: "backend" },
  ai: { label: "AI/ML", icon: "ai" },
  reading: { label: "Reading", icon: "reading" },
  devops: { label: "DevOps", icon: "devops" },
  design: { label: "Design", icon: "design" }
};

export const THUMB_COLORS = [
  "#fef2f2", "#fefce8", "#f0fdf4", "#eff6ff", "#faf5ff", "#fff7ed"
];
