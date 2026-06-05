"use client";

import { useLanguage } from "@/lib/language-context";

export function FooterBar() {
  const { t } = useLanguage();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <span>{t("footerCopyright")}</span>
      </div>
    </footer>
  );
}