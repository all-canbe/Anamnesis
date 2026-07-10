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

function validateArticle(url: string, title: string, content: string, text: string): void {
  const errorPatterns = [
    /环境异常/,
    /完成验证/,
    /去验证/,
    /CAPTCHA/i,
    /captcha/i,
    /authorized to access/i,
    /please make sure you are authorized/i,
    /Weixin Official Accounts Platform/i,
    /Please enable JavaScript/i,
    /Access Denied/i,
    /403 Forbidden/i,
    /需要验证码/,
    /安全验证/,
    /环境检查/,
    /访问被拦截/,
  ];

  for (const pattern of errorPatterns) {
    if (pattern.test(text)) {
      throw new Error(`无法抓取该页面，触发反爬验证或访问限制：${url}`);
    }
  }

  // 标题是常见错误页标题
  const genericErrorTitles = [
    "Weixin Official Accounts Platform",
    "Access Denied",
    "403 Forbidden",
    "Just a moment",
    "Attention Required",
    "Cloudflare",
    "验证码",
    "安全验证",
  ];
  for (const errTitle of genericErrorTitles) {
    if (title.toLowerCase().includes(errTitle.toLowerCase())) {
      throw new Error(`页面标题异常，可能已被拦截：${title}`);
    }
  }

  // 内容过短
  const plainText = content.replace(/[#*`>\[\]\(\)!\n\r]/g, " ").replace(/\s+/g, " ").trim();
  if (plainText.length < 80) {
    throw new Error(`文章内容过短，抓取失败：${plainText.slice(0, 40)}...`);
  }
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

  // 质量校验：拦截反爬/异常页面
  validateArticle(articleUrl, title, content, text);

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