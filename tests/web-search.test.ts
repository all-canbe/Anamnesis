/**
 * Web Search Tests
 *
 * Tests searchWeb, searchGitHub, searchSkills.
 * Mocks: global fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Tests ───

describe("web-search", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("searchWeb", () => {
    it("should return search results from Jina AI", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          "Title: AI Trends 2026\nhttps://example.com/ai-trends\nSome snippet\n" +
          "Title: Machine Learning Advances\nhttps://example.com/ml\nAnother snippet",
          { status: 200 }
        )
      ) as any;

      const { searchWeb } = await import("@/lib/web-search");
      const results = await searchWeb("AI trends");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("title");
      expect(results[0]).toHaveProperty("url");
      expect(results[0]).toHaveProperty("snippet");
      expect(results[0].source).toBe("web");
    });

    it("should respect the limit parameter", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          Array.from({ length: 20 }, (_, i) =>
            `Result ${i}\nhttps://example.com/${i}\nSnippet ${i}`
          ).join("\n"),
          { status: 200 }
        )
      ) as any;

      const { searchWeb } = await import("@/lib/web-search");
      const results = await searchWeb("test", 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("should return empty array on fetch error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error")) as any;

      const { searchWeb } = await import("@/lib/web-search");
      const results = await searchWeb("test");

      expect(results).toHaveLength(0);
    });

    it("should return empty array on HTTP error", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response("Error", { status: 500 })
      ) as any;

      const { searchWeb } = await import("@/lib/web-search");
      const results = await searchWeb("test");

      expect(results).toHaveLength(0);
    });

    it("should handle empty response body", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response("", { status: 200 })
      ) as any;

      const { searchWeb } = await import("@/lib/web-search");
      const results = await searchWeb("test");

      expect(results).toHaveLength(0);
    });
  });

  describe("searchGitHub", () => {
    it("should return GitHub repository results", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          items: [
            {
              full_name: "user/repo",
              html_url: "https://github.com/user/repo",
              description: "A great repository",
            },
            {
              full_name: "user/repo2",
              html_url: "https://github.com/user/repo2",
              description: "Another repository",
            },
          ],
        }), { status: 200 })
      ) as any;

      const { searchGitHub } = await import("@/lib/web-search");
      const results = await searchGitHub("react");

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("user/repo");
      expect(results[0].source).toBe("github");
      expect(results[0].url).toBe("https://github.com/user/repo");
    });

    it("should handle missing description", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          items: [
            {
              full_name: "user/repo",
              html_url: "https://github.com/user/repo",
              description: null,
            },
          ],
        }), { status: 200 })
      ) as any;

      const { searchGitHub } = await import("@/lib/web-search");
      const results = await searchGitHub("test");

      expect(results).toHaveLength(1);
      expect(results[0].snippet).toBe("No description");
    });

    it("should return empty array on fetch error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Rate limited")) as any;

      const { searchGitHub } = await import("@/lib/web-search");
      const results = await searchGitHub("test");

      expect(results).toHaveLength(0);
    });

    it("should handle empty items array", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 })
      ) as any;

      const { searchGitHub } = await import("@/lib/web-search");
      const results = await searchGitHub("nonexistent-repo-xyz");

      expect(results).toHaveLength(0);
    });
  });

  describe("searchSkills", () => {
    it("should merge web and GitHub results", async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("api.github.com")) {
          return new Response(JSON.stringify({
            items: [
              {
                full_name: "user/skill",
                html_url: "https://github.com/user/skill",
                description: "A skill",
              },
            ],
          }), { status: 200 });
        }
        return new Response(
          "Title: Web Result\nhttps://example.com/web\nSnippet",
          { status: 200 }
        );
      }) as any;

      const { searchSkills } = await import("@/lib/web-search");
      const results = await searchSkills("react skill", 5);

      expect(results.length).toBeGreaterThan(0);
      // GitHub results come first
      const sources = results.map((r) => r.source);
      expect(sources).toContain("github");
      expect(sources).toContain("web");
    });

    it("should deduplicate results by URL", async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("api.github.com")) {
          return new Response(JSON.stringify({
            items: [
              {
                full_name: "user/repo",
                html_url: "https://same-url.com",
                description: "Same URL",
              },
            ],
          }), { status: 200 });
        }
        return new Response(
          "Result\nhttps://same-url.com\nSnippet",
          { status: 200 }
        );
      }) as any;

      const { searchSkills } = await import("@/lib/web-search");
      const results = await searchSkills("test");

      // Should not have duplicate URLs
      const urls = results.map((r) => r.url.toLowerCase());
      expect(new Set(urls).size).toBe(urls.length);
    });

    it("should respect the limit parameter", async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("api.github.com")) {
          return new Response(JSON.stringify({
            items: Array.from({ length: 10 }, (_, i) => ({
              full_name: `user/repo${i}`,
              html_url: `https://github.com/user/repo${i}`,
              description: `Repo ${i}`,
            })),
          }), { status: 200 });
        }
        return new Response(
          Array.from({ length: 10 }, (_, i) =>
            `Result ${i}\nhttps://example.com/${i}\nSnippet`
          ).join("\n"),
          { status: 200 }
        );
      }) as any;

      const { searchSkills } = await import("@/lib/web-search");
      const results = await searchSkills("test", 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });
});
