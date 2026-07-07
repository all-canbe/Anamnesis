/**
 * Skill Importer Tests
 *
 * Tests fetchSkillFromGitHub and importSkill.
 * importSkill now uses writeRecord directly instead of /api/cli fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock writeRecord and generateId from content module
vi.mock("@/lib/content", () => {
  let nextId = 100;
  return {
    writeRecord: vi.fn(async (meta: any, content: string) => {
      if (content.includes("TRIGGER_FAIL")) {
        throw new Error("DB error");
      }
      return;
    }),
    generateId: vi.fn(() => {
      nextId++;
      return `k${nextId}`;
    }),
  };
});

// ─── Mock Data ───

const MOCK_GITHUB_TREE = {
  tree: [
    { path: "skill.json", type: "blob" },
    { path: "README.md", type: "blob" },
    { path: "guide.md", type: "blob" },
    { path: "node_modules/lib/index.js", type: "blob" },
    { path: "images/logo.png", type: "blob" },
  ],
};

const MOCK_SKILL_JSON = JSON.stringify({
  name: "test-skill",
  description: "A test skill package",
  version: "2.0.0",
  author: "testuser",
  category: "frontend",
});

const MOCK_README = "# Test Skill\n\nThis is a README file with content.";

const MOCK_GUIDE = "# Guide\n\nStep by step instructions.";

function mockFetchForGitHub(url: string): Response {
  if (url.includes("api.github.com/repos") && url.includes("git/trees")) {
    return new Response(JSON.stringify(MOCK_GITHUB_TREE), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (url.includes("raw.githubusercontent.com")) {
    if (url.includes("skill.json")) {
      return new Response(MOCK_SKILL_JSON, { status: 200 });
    }
    if (url.includes("README.md")) {
      return new Response(MOCK_README, { status: 200 });
    }
    if (url.includes("guide.md")) {
      return new Response(MOCK_GUIDE, { status: 200 });
    }
    if (url.includes("node_modules")) {
      return new Response("", { status: 404 });
    }
    return new Response("", { status: 404 });
  }
  return new Response("Not found", { status: 404 });
}

// ─── Tests ───

describe("skill-importer", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("fetchSkillFromGitHub", () => {
    it("should fetch and parse a valid GitHub repo", async () => {
      global.fetch = vi.fn((url: string) =>
        Promise.resolve(mockFetchForGitHub(url as string))
      ) as any;

      const { fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      const skill = await fetchSkillFromGitHub("https://github.com/testuser/test-repo");

      expect(skill.name).toBe("test-skill");
      expect(skill.description).toBe("A test skill package");
      expect(skill.version).toBe("2.0.0");
      expect(skill.author).toBe("testuser");
      expect(skill.category).toBe("frontend");
      expect(skill.files).toHaveLength(2);
      expect(skill.images).toHaveLength(1);
      expect(skill.images[0].path).toBe("images/logo.png");
    });

    it("should throw on invalid GitHub URL", async () => {
      global.fetch = vi.fn();

      const { fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      await expect(
        fetchSkillFromGitHub("https://gitlab.com/user/repo")
      ).rejects.toThrow("Invalid GitHub URL");
    });

    it("should throw on non-GitHub URL", async () => {
      global.fetch = vi.fn();

      const { fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      await expect(
        fetchSkillFromGitHub("https://example.com/some/page")
      ).rejects.toThrow("Invalid GitHub URL");
    });

    it("should throw on malformed URL", async () => {
      global.fetch = vi.fn();

      const { fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      await expect(
        fetchSkillFromGitHub("not-a-url")
      ).rejects.toThrow("Invalid GitHub URL");
    });

    it("should throw when GitHub API returns error", async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes("api.github.com")) {
          return Promise.resolve(
            new Response("Not Found", { status: 404 })
          );
        }
        return Promise.resolve(mockFetchForGitHub(url as string));
      }) as any;

      const { fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      await expect(
        fetchSkillFromGitHub("https://github.com/testuser/nonexistent")
      ).rejects.toThrow("GitHub API error: 404");
    });

    it("should handle GitHub API timeout", async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error("The operation was aborted due to timeout"))
      ) as any;

      const { fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      await expect(
        fetchSkillFromGitHub("https://github.com/testuser/test-repo")
      ).rejects.toThrow();
    });

    it("should handle repo with no .md files", async () => {
      const emptyTree = { tree: [{ path: "code.js", type: "blob" }] };
      global.fetch = vi.fn((url: string) => {
        if (url.includes("api.github.com")) {
          return Promise.resolve(
            new Response(JSON.stringify(emptyTree), { status: 200 })
          );
        }
        return Promise.resolve(mockFetchForGitHub(url as string));
      }) as any;

      const { fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      const skill = await fetchSkillFromGitHub("https://github.com/testuser/empty");
      expect(skill.files).toHaveLength(0);
      expect(skill.name).toBe("empty");
    });

    it("should handle .git suffix in URL", async () => {
      global.fetch = vi.fn((url: string) =>
        Promise.resolve(mockFetchForGitHub(url as string))
      ) as any;

      const { fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      const skill = await fetchSkillFromGitHub("https://github.com/testuser/test-repo.git");
      expect(skill.name).toBe("test-skill");
    });

    it("should exclude node_modules paths", async () => {
      global.fetch = vi.fn((url: string) =>
        Promise.resolve(mockFetchForGitHub(url as string))
      ) as any;

      const { fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      const skill = await fetchSkillFromGitHub("https://github.com/testuser/test-repo");
      const hasNodeModules = skill.files.some((f) => f.path.includes("node_modules"));
      expect(hasNodeModules).toBe(false);
    });

    it("should handle skill.json parse failure gracefully", async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes("skill.json")) {
          return Promise.resolve(new Response("not valid json {{{", { status: 200 }));
        }
        return Promise.resolve(mockFetchForGitHub(url as string));
      }) as any;

      const { fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      const skill = await fetchSkillFromGitHub("https://github.com/testuser/test-repo");
      expect(skill.name).toBe("test-repo");
      expect(skill.version).toBe("1.0.0");
    });
  });

  describe("importSkill", () => {
    it("should import all files successfully as attachments to one record", async () => {
      global.fetch = vi.fn((url: string) =>
        Promise.resolve(mockFetchForGitHub(url as string))
      ) as any;

      const { importSkill, fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      const skill = await fetchSkillFromGitHub("https://github.com/testuser/test-repo");
      const result = await importSkill(skill);

      expect(result.ok).toBe(true);
      expect(result.recordIds).toHaveLength(1);
      expect(result.attachmentCount).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle writeRecord failure gracefully", async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes("raw.githubusercontent.com")) {
          if (url.includes("README.md")) {
            return Promise.resolve(new Response("# Header\n\nTRIGGER_FAIL Content", { status: 200 }));
          }
          return Promise.resolve(mockFetchForGitHub(url as string));
        }
        return Promise.resolve(mockFetchForGitHub(url as string));
      }) as any;

      const { importSkill, fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      const skill = await fetchSkillFromGitHub("https://github.com/testuser/test-repo");
      const result = await importSkill(skill);

      // First file content triggers writeRecord error, entire import fails
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.recordIds).toHaveLength(0);
    });

    it("should handle partial import failure (all-or-nothing with attachments)", async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes("raw.githubusercontent.com")) {
          if (url.includes("README.md")) {
            return Promise.resolve(new Response("# Header\n\nTRIGGER_FAIL Content", { status: 200 }));
          }
          return Promise.resolve(mockFetchForGitHub(url as string));
        }
        return Promise.resolve(mockFetchForGitHub(url as string));
      }) as any;

      const { importSkill, fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      const skill = await fetchSkillFromGitHub("https://github.com/testuser/test-repo");
      const result = await importSkill(skill);

      // Single record import with all files as attachments, content from first file fails
      expect(result.ok).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.recordIds).toHaveLength(0);
    });
  });

  describe("parseTitle (via fetchSkillFromGitHub)", () => {
    it("should derive title from filename", async () => {
      const tree = { tree: [{ path: "01-introduction.md", type: "blob" }] };
      global.fetch = vi.fn((url: string) => {
        if (url.includes("api.github.com")) {
          return Promise.resolve(new Response(JSON.stringify(tree), { status: 200 }));
        }
        if (url.includes("01-introduction.md")) {
          return Promise.resolve(new Response("# Intro\n\nContent", { status: 200 }));
        }
        return Promise.resolve(new Response("", { status: 404 }));
      }) as any;

      const { fetchSkillFromGitHub } = await import("@/lib/skill-importer");
      const skill = await fetchSkillFromGitHub("https://github.com/user/repo");
      expect(skill.files).toHaveLength(1);
    });
  });
});