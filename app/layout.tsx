import type { Metadata, Viewport } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/lib/language-context";
import { Shell } from "./shell";

export const metadata: Metadata = {
  title: "知忆 - Anamnesis",
  description: "个人知识记录浏览系统",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "知忆",
  },
  icons: {
    icon: [
      { url: "/icon-192.svg", type: "image/svg+xml" },
      { url: "/icon-512.svg", type: "image/svg+xml" },
    ],
    apple: { url: "/icon-512.svg" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

type ViewMode = "list" | "grid" | "compact";

function parseViewMode(value: string | undefined): ViewMode {
  if (value === "grid" || value === "compact") return value;
  return "list";
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const initialLang = cookieStore.get("kb-lang")?.value === "en" ? "en" : "zh";
  const initialViewMode = parseViewMode(cookieStore.get("zhiyi-view-mode")?.value);

  return (
    <html lang={initialLang === "en" ? "en" : "zh-CN"} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="知忆" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#1a1a1a" />
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem("zhiyi-theme");if(t==="dark"){document.documentElement.setAttribute("data-theme","dark")}else if(t==="system"){var d=window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.setAttribute("data-theme","dark")}}catch(e){}})()`
        }} />
      </head>
      <body>
        <LanguageProvider initialLang={initialLang}>
          <Shell initialViewMode={initialViewMode}>{children}</Shell>
        </LanguageProvider>
      </body>
    </html>
  );
}
