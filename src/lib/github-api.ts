const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const OWNER = process.env.GITHUB_OWNER || "all-canbe";
const REPO = process.env.GITHUB_REPO || "mykb";
const BRANCH = process.env.GITHUB_BRANCH || "main";

const API = "https://api.github.com";

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "mykb-github-bridge",
  };
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

async function getSha(path: string): Promise<string | null> {
  const url = `${API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.sha || null;
}

export async function commitFile(
  path: string,
  content: string,
  message: string
): Promise<boolean> {
  if (!GITHUB_TOKEN) return false;
  try {
    const sha = await getSha(path);
    const body: Record<string, unknown> = {
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch: BRANCH,
    };
    if (sha) body.sha = sha;

    const url = `${API}/repos/${OWNER}/${REPO}/contents/${path}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteFile(
  path: string,
  message: string
): Promise<boolean> {
  if (!GITHUB_TOKEN) return false;
  try {
    const sha = await getSha(path);
    if (!sha) return true;

    const url = `${API}/repos/${OWNER}/${REPO}/contents/${path}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: headers(),
      body: JSON.stringify({ message, sha, branch: BRANCH }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function isGithubMode(): boolean {
  return !!GITHUB_TOKEN;
}