import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knowledge Base",
  description: "个人知识记录浏览系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header" id="site-header">
          <div className="header-inner">
            <a href="/" className="site-logo">Knowledge Base</a>
            <nav className="site-nav">
              <a href="/" className="nav-link active" data-page="records">Records</a>
              <a href="/tags" className="nav-link" data-page="tags">Tags</a>
              <a href="/orchestration" className="nav-link" data-page="orchestration">Orchestration</a>
            </nav>
          </div>
        </header>
        <div className="toast-container" id="toast-container"></div>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <div className="footer-inner">
            <span>&copy; 2026 Knowledge Base</span>
          </div>
        </footer>
      </body>
    </html>
  );
}