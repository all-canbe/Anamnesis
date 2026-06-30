export interface SkillPackage {
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  files: { path: string; content: string }[];
  images: { path: string; url: string }[];
}

export async function fetchSkillFromGitHub(repoUrl: string): Promise<SkillPackage> {
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error("Invalid GitHub URL");

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, "");

  const skill: SkillPackage = {
    name: repo,
    description: "",
    version: "1.0.0",
    author: owner,
    category: "reading",
    files: [],
    images: [],
  };

  // Fetch repo contents via GitHub API
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers: { Accept: "application/vnd.github.v3+json" }, signal: AbortSignal.timeout(15000) }
  );

  if (!treeRes.ok) throw new Error(`GitHub API error: ${treeRes.status}`);

  const tree = await treeRes.json();
  const items: { path: string; type: string }[] = tree.tree || [];

  // Find skill.json first for metadata
  const skillJsonItem = items.find((i) => i.path === "skill.json");
  if (skillJsonItem) {
    const content = await fetchGitHubFile(owner, repo, skillJsonItem.path);
    if (content) {
      try {
        const meta = JSON.parse(content);
        skill.name = meta.name || skill.name;
        skill.description = meta.description || "";
        skill.version = meta.version || "1.0.0";
        skill.author = meta.author || owner;
        skill.category = meta.category || "reading";
      } catch {}
    }
  }

  // Fetch .md files
  const mdItems = items.filter((i) => i.path.endsWith(".md") && !i.path.includes("node_modules"));
  for (const item of mdItems) {
    const content = await fetchGitHubFile(owner, repo, item.path);
    if (content) {
      skill.files.push({ path: item.path, content });
    }
  }

  // Fetch image files (placeholder - store URL for later R2 upload)
  const imgItems = items.filter((i) => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(i.path));
  for (const item of imgItems) {
    skill.images.push({
      path: item.path,
      url: `https://raw.githubusercontent.com/${owner}/${repo}/main/${item.path}`,
    });
  }

  return skill;
}

async function fetchGitHubFile(owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) return await res.text();
  } catch {}

  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/master/${path}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) return await res.text();
  } catch {}

  return null;
}

export async function importSkill(skill: SkillPackage): Promise<{
  ok: boolean;
  skillId?: string;
  recordIds: string[];
  errors: string[];
}> {
  const recordIds: string[] = [];
  const errors: string[] = [];

  for (const file of skill.files) {
    try {
      const title = parseTitle(file.path);
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);

      const summary = parseSummary(file.content);

      const res = await fetch("/api/cli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "publish",
          title,
          slug,
          category: skill.category,
          summary,
          content: file.content,
          format: "md",
        }),
      });

      const data = await res.json();
      if (res.ok && data.id) {
        recordIds.push(data.id);
      } else {
        errors.push(`${file.path}: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      errors.push(`${file.path}: ${err.message}`);
    }
  }

  return {
    ok: errors.length === 0,
    recordIds,
    errors,
  };
}

function parseTitle(filePath: string): string {
  const filename = filePath.split("/").pop() || filePath;
  let name = filename.replace(/\.md$/i, "");
  name = name.replace(/^\d+[\s\-_\.]+/, "");
  name = name.replace(/[-_]/g, " ");
  return name;
}

function parseSummary(content: string): string {
  const text = content
    .replace(/^---[\s\S]*?---\n?/, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/[#*`>\[\]]/g, "")
    .trim();
  return text.slice(0, 120).replace(/\n/g, " ").trim() + (text.length > 120 ? "..." : "");
}
