"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/language-context";

export function NavBar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav className="site-nav">
      <a href="/" className={`nav-link${isActive("/") ? " active" : ""}`} data-page="records">{t("records")}</a>
      <a href="/tags" className={`nav-link${isActive("/tags") ? " active" : ""}`} data-page="tags">{t("tags")}</a>
      <a href="/orchestration" className={`nav-link${isActive("/orchestration") ? " active" : ""}`} data-page="orchestration">{t("orchestration")}</a>
    </nav>
  );
}