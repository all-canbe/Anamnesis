"use client";

import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/language-context";

export function NavBar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav className="site-nav">
      <a href="/" className={`nav-link${pathname === "/" ? " active" : ""}`} data-page="records">{t("records")}</a>
    </nav>
  );
}