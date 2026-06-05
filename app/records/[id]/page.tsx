import { getRecord, getFilteredRecords } from "@/lib/content";
import { CATEGORIES, THUMB_COLORS } from "@/lib/types";
import { mdToHtml } from "@/lib/md-to-html";
import { notFound } from "next/navigation";
import type { RecordMeta } from "@/lib/types";
import { DetailClient } from "./client";

export default async function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = getRecord(id);
  if (!record) notFound();

  const cat = CATEGORIES[record.meta.category as keyof typeof CATEGORIES] || {};
  const allRecords = getFilteredRecords();
  const idx = allRecords.findIndex((r: RecordMeta) => r.id === id);
  const prev = idx > 0 ? allRecords[idx - 1] : null;
  const next = idx < allRecords.length - 1 ? allRecords[idx + 1] : null;

  const contentHtml = record.meta.format === "md" ? mdToHtml(record.content) : record.content;

  const colorIdx = Object.keys(CATEGORIES).indexOf(record.meta.category);
  const color = THUMB_COLORS[colorIdx >= 0 ? colorIdx : 0];

  return (
    <div className="detail-view">
      <a href={`/?category=${record.meta.category}`} className="breadcrumb-link">
        {cat.label || record.meta.category}
      </a>
      <div className="detail-meta">
        <span className="detail-date">{record.meta.date}</span>
        <span className="category-badge">{cat.label || record.meta.category}</span>
        <span className="detail-format-badge">{record.meta.format === "md" ? "MD" : "HTML"}</span>
      </div>
      <h1 className="detail-title">{record.meta.title}</h1>
      <div className="detail-thumbnail" style={{ background: color }}>
        <span style={{ fontSize: 48, position: "relative", zIndex: 1 }}>{cat.emoji || "📄"}</span>
      </div>
      <div className="detail-content" dangerouslySetInnerHTML={{ __html: contentHtml }} />
      <DetailClient prev={prev} next={next} />
    </div>
  );
}