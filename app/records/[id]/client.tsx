"use client";

import Link from "next/link";
import type { RecordMeta } from "@/lib/types";
import { useLanguage } from "@/lib/language-context";

export function DetailClient({ prev, next }: { prev: RecordMeta | null; next: RecordMeta | null }) {
  const { t } = useLanguage();

  return (
    <nav className="detail-nav">
      {prev ? (
        <Link href={`/records/${prev.id}`} className="nav-prev">
          <span className="nav-arrow">&larr;</span>
          <span className="nav-label">{t("prevLabel")}</span>
          <span className="nav-title">{prev.title}</span>
        </Link>
      ) : (
        <div style={{ visibility: "hidden" }} />
      )}
      <Link href="/" className="nav-back">{t("back")}</Link>
      {next ? (
        <Link href={`/records/${next.id}`} className="nav-next">
          <span className="nav-label">{t("nextLabel")}</span>
          <span className="nav-arrow">&rarr;</span>
          <span className="nav-title">{next.title}</span>
        </Link>
      ) : (
        <div style={{ visibility: "hidden" }} />
      )}
    </nav>
  );
}