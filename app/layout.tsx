import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "./nav-bar";
import { LanguageProvider } from "@/lib/language-context";
import { FooterBar } from "./footer-bar";
import { LangToggle } from "./lang-toggle";

export const metadata: Metadata = {
  title: "Knowledge Base",
  description: "个人知识记录浏览系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <LanguageProvider>
          <header className="site-header" id="site-header">
            <div className="header-inner">
              <a href="/" className="site-logo">Knowledge Base</a>
              <div className="header-right">
                <NavBar />
                <LangToggle />
              </div>
            </div>
          </header>
          <div className="toast-container" id="toast-container"></div>
          <main className="site-main">{children}</main>
          <FooterBar />
        </LanguageProvider>
      </body>
    </html>
  );
}