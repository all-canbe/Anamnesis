export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: "web" | "github";
}

export async function searchWeb(query: string, limit = 5): Promise<SearchResult[]> {
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
