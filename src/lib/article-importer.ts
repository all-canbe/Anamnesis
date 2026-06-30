export interface ImportedArticle {
  url: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  date: string;
  source: "web" | "rss" | "file";
  images: string[];
}

export interface RSSFeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

function detectCategoryFromContent(text: string): string {
  const lower = text.toLowerCase();
  const catMap: Record<string, string> = {
    frontend: "frontend", react: "frontend", vue: "frontend", css: "frontend",
    javascript: "frontend", typescript: "frontend", html: "frontend",
    backend: "backend", api: "backend", database: "backend", server: "backend",
    ai: "ai", ml: "ai", "machine learning": "ai", "deep learning": "ai",
    neural: "ai", llm: "ai", gpt: "ai",
    reading: "reading", book: "reading", review: "reading",
    devops: "devops", docker: "devops", kubernetes: "devops", deploy: "devops",
    ci: "devops", cd: "devops",
    design: "design", ui: "design", ux: "design", figma: "design",
  };
  for (const [key, val] of Object.entries(catMap)) {
    if (lower.includes(key)) return val;
  }
  return "reading";
}

function parseSummary(text: string): string {
  const cleaned = text
    .replace(/^---[\s\S]*?---\n?/, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/[#*`>\[\]]/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return cleaned.slice(0, 150).replace(/\n/g, " ").trim() + (cleaned.length > 150 ? "..." : "");
}

function extractImages(text: string): string[] {
  const urls: string[] = [];
  const regex = /!\[.*?\]\((.*?)\)/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

export async function fetchArticle(url: string): Promise<ImportedArticle> {
  const res = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
    headers: {
      "Accept": "text/plain",
      "X-Return-Format": "markdown",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch article: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();

  const titleMatch = text.match(/^Title:\s*(.+)$/m);
  const urlMatch = text.match(/^URL Source:\s*(.+)$/m);
  const contentStart = text.indexOf("---") + 3;
  const content = text.slice(contentStart > 2 ? contentStart : 0).trim();

  const title = titleMatch ? titleMatch[1].trim() : "Untitled Article";
  const articleUrl = urlMatch ? urlMatch[1].trim() : url;
  const summary = parseSummary(content);
  const category = detectCategoryFromContent(title + " " + summary);
  const images = extractImages(content);

  return {
    url: articleUrl,
    title,
    content,
    summary,
    category,
    date: new Date().toISOString().split("T")[0],
    source: "web",
    images,
  };
}

export async function fetchRSSFeed(rssUrl: string): Promise<RSSFeedItem[]> {
  const res = await fetch(
    `https://r.jina.ai/${encodeURIComponent(rssUrl)}`,
    {
      headers: { "Accept": "text/plain" },
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch RSS feed: ${res.status}`);
  }

  const text = await res.text();
  const items: RSSFeedItem[] = [];

  const itemRegex = /###\s+\[([^\]]+)\]\(([^)]+)\)\s*\n([\s\S]*?)(?=\n###|$)/g;
  let m;
  while ((m = itemRegex.exec(text)) !== null) {
    items.push({
      title: m[1].trim(),
      link: m[2].trim(),
      description: m[3].trim().slice(0, 200),
      pubDate: new Date().toISOString(),
    });
  }

  return items.slice(0, 20);
}

export async function importArticle(article: ImportedArticle): Promise<{ ok: boolean; error?: string }> {
  const token = (() => {
    try {
      const raw = localStorage.getItem("zhiyi-turso-config");
      if (raw) {
        const cfg = JSON.parse(raw);
        return cfg.token || "";
      }
    } catch {}
    return "";
  })();

  const slug = article.title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  try {
    const res = await fetch("/api/cli", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        command: "publish",
        title: article.title,
        slug,
        category: article.category,
        summary: article.summary,
        content: article.content,
        format: "md",
      }),
    });

    const data = await res.json();
    if (res.ok) return { ok: true };
    return { ok: false, error: data.error || "Unknown error" };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
