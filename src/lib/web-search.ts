export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: "web" | "github";
}

function getEnv(key: string): string {
  return (typeof process !== "undefined" ? process.env[key] : "") || "";
}

// ─── 多级搜索 fallback ───

async function tryTavily(query: string, limit: number): Promise<SearchResult[]> {
  const apiKey = getEnv("TAVILY_API_KEY");
  if (!apiKey || apiKey === "${TAVILY_API_KEY}") return [];
  try {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, search_depth: "basic", max_results: limit }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const raw = data.results || [];
    return raw.slice(0, limit).map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.content || "",
      source: "web" as const,
    }));
  } catch {
    return [];
  }
}

async function trySerper(query: string, limit: number): Promise<SearchResult[]> {
  const apiKey = getEnv("SERPER_API_KEY");
  if (!apiKey || apiKey === "${SERPER_API_KEY}") return [];
  try {
    const resp = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: limit }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const organic = data.organic || [];
    return organic.slice(0, limit).map((r: any) => ({
      title: r.title || "",
      url: r.link || "",
      snippet: r.snippet || "",
      source: "web" as const,
    }));
  } catch {
    return [];
  }
}

async function tryBocha(query: string, limit: number): Promise<SearchResult[]> {
  const apiKey = getEnv("BOCHA_API_KEY");
  if (!apiKey || apiKey === "${BOCHA_API_KEY}") return [];
  try {
    const resp = await fetch("https://api.bochaai.com/v1/web-search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, count: limit }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const webPages = data.data?.webPages?.value || data.results || data.value || [];
    return webPages.slice(0, limit).map((r: any) => ({
      title: r.name || r.title || "",
      url: r.url || r.href || "",
      snippet: r.snippet || r.summary || r.body || "",
      source: "web" as const,
    }));
  } catch {
    return [];
  }
}

async function tryJinaSearch(query: string, limit: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    const res = await fetch(
      `https://s.jina.ai/${encodeURIComponent(query)}`,
      { headers: { "Accept": "text/plain" }, signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const text = await res.text();
      const lines = text.split("\n").filter(Boolean);
      for (const line of lines.slice(0, limit * 3)) {
        const urlMatch = line.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          results.push({
            title: line.replace(urlMatch[0], "").trim().slice(0, 80) || urlMatch[0],
            url: urlMatch[0],
            snippet: line.slice(0, 150),
            source: "web",
          });
        }
      }
    }
  } catch {}
  return results.slice(0, limit);
}

export async function searchWeb(query: string, limit = 5): Promise<SearchResult[]> {
  const results = await tryTavily(query, limit);
  if (results.length > 0) return results;

  const results2 = await trySerper(query, limit);
  if (results2.length > 0) return results2;

  const results3 = await tryBocha(query, limit);
  if (results3.length > 0) return results3;

  return tryJinaSearch(query, limit);
}

export async function searchGitHub(query: string, limit = 5): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+in:name,description&sort=stars&per_page=${limit}`,
      { headers: { "Accept": "application/vnd.github.v3+json" }, signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = await res.json();
      for (const item of (data.items || []).slice(0, limit)) {
        results.push({
          title: item.full_name,
          url: item.html_url,
          snippet: item.description || "No description",
          source: "github",
        });
      }
    }
  } catch {}

  return results;
}

export async function searchSkills(query: string, limit = 5): Promise<SearchResult[]> {
  const [web, github] = await Promise.all([
    searchWeb(`${query} skill tutorial guide`, limit),
    searchGitHub(`${query} skill`, limit),
  ]);

  const seen = new Set<string>();
  const merged = [...github, ...web].filter((r) => {
    const key = r.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return merged.slice(0, limit);
}
