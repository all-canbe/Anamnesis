import { getRecord, getFilteredRecords, getCategories, getPublicRecords } from "@/lib/content";
import { findSimilar } from "@/lib/zvec";
import { THUMB_COLORS } from "@/lib/types";
import { mdToHtml } from "@/lib/md-to-html";
import { notFound } from "next/navigation";
import type { RecordMeta } from "@/lib/types";
import { DetailClient } from "./client";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

async function getUsernameFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("zhiyi_token")?.value;
  if (!token) return null;
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    return (payload.sub as string) || null;
  } catch { return null; }
}

export default async function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const username = await getUsernameFromCookie();
  let record = await getRecord(id, username || undefined);
  // 已登录用户查看他人公开文章时，回退到公开查询（不传 userId）
  let viewingOthersPublic = false;
  if (!record && username) {
    record = await getRecord(id, undefined);
    viewingOthersPublic = !!record;
  }
  if (!record) notFound();

  // 权限隔离：未登录用户只能看公开记录
  if (!username && record.meta.visibility !== "public") {
    notFound();
  }

  const categories = await getCategories(username || undefined);
  const catInfo = categories.find(c => c.key === record.meta.category);
  // 未登录用户只看公开记录列表，登录用户看自己的记录
  // 登录用户查看他人公开文章时，用公开记录列表做上下篇导航
  const allRecords = (username && !viewingOthersPublic)
    ? await getFilteredRecords(undefined, username)
    : await getPublicRecords();
  const idx = allRecords.findIndex((r: RecordMeta) => r.id === id);
  const prev = idx > 0 ? allRecords[idx - 1] : null;
  const next = idx < allRecords.length - 1 ? allRecords[idx + 1] : null;

  const contentHtml = record.meta.format === "md" ? mdToHtml(record.content) : record.content;

  const colorIdx = categories.findIndex(c => c.key === record.meta.category);
  const color = THUMB_COLORS[colorIdx >= 0 ? colorIdx : 0];

  const similarResults = await findSimilar(id, username || undefined, 3);
  const similar = similarResults
    .map((sr) => allRecords.find((r: RecordMeta) => r.id === sr.recordId))
    .filter(Boolean) as RecordMeta[];

  const attachments = record.meta.attachments || [];

  return (
    <div className="detail-view">
      <a href="/" className="detail-back-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back
      </a>
      <div className="detail-meta">
        <span className="detail-date">{record.meta.date}</span>
        <a href={`/?category=${record.meta.category}`} className="category-badge">{catInfo?.label || record.meta.category}</a>
        <span className="format-badge">{record.meta.format === "md" ? "MD" : "HTML"}</span>
        <span className={`visibility-badge ${record.meta.visibility}`}>{record.meta.visibility === "public" ? "Public" : "Private"}</span>
      </div>
      <h1 className="detail-title">{record.meta.title}</h1>
      <div className="detail-thumbnail" style={{ background: color }}>
        <span style={{ fontSize: 48, position: "relative", zIndex: 1 }}>
        </span>
      </div>

      {attachments.length > 0 && (
        <div className="detail-attachments">
          <div className="detail-attachments-title">Attachments ({attachments.length})</div>
          {attachments.map((att, i) => {
            const isUrl = att.type === "url" || att.type === "image";
            const href = isUrl ? att.content : `/api/records/${id}/attachments/${i}`;
            return (
              <a
                key={i}
                href={href}
                className="detail-attachment-item"
                target={isUrl ? "_blank" : undefined}
                rel={isUrl ? "noopener noreferrer" : undefined}
                download={!isUrl ? att.path : undefined}
              >
                <span className="detail-attachment-path">{att.path}</span>
                <span className="detail-attachment-type">{att.type}</span>
                <span className="detail-attachment-action">{isUrl ? "↗" : "↓"}</span>
              </a>
            );
          })}
        </div>
      )}

      <div className="detail-content" dangerouslySetInnerHTML={{ __html: contentHtml }} />

      <DetailClient
        prev={prev}
        next={next}
        recordId={id}
        similar={similar}
        contentHtml={contentHtml}
        category={record.meta.category}
        categories={categories}
      />
    </div>
  );
}
