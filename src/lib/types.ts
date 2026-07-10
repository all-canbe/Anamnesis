export type Category = string;
export type ContentFormat = "md" | "html";
export type Visibility = "private" | "public";

export interface Attachment {
  path: string;
  content: string;
  type: string;
}

export interface RecordMeta {
  id: string;
  slug: string;
  title: string;
  date: string;
  category: Category;
  summary: string;
  format: ContentFormat;
  visibility: Visibility;
  attachments?: Attachment[];
}

export interface ContentRecord {
  meta: RecordMeta;
  content: string;
}

export const THUMB_COLORS = [
  "#fef2f2", "#fefce8", "#f0fdf4", "#eff6ff", "#faf5ff", "#fff7ed"
];
