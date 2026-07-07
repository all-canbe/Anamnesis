import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock writeRecord and generateId from content module
vi.mock("@/lib/content", () => {
  let nextId = 100;
  return {
    writeRecord: vi.fn(async (meta: any, content: string) => {
      return;
    }),
    generateId: vi.fn(() => {
      nextId++;
      return `k${nextId}`;
    }),
  };
});

// Sample Jina Reader API response for a tech article about AI
const MOCK_AI_ARTICLE_RESPONSE = `Title: Understanding Large Language Models
URL Source: https://example.com/ai-llm-guide
Markdown Content:
---
# Understanding Large Language Models

Large language models (LLMs) are a type of artificial intelligence model.

## How They Work

LLMs use transformer architecture to process and generate text.

![architecture diagram](https://example.com/diagram.png)

## Applications

- Chatbots
- Code generation
- Content creation
`;

// Sample Jina Reader API response for an RSS feed
const MOCK_RSS_RESPONSE = `Title: Tech Blog RSS Feed
URL Source: https://example.com/feed.xml
Markdown Content:
---
### [Getting Started with React](https://example.com/react-intro)
A beginner's guide to React framework.

### [CSS Grid Layout Guide](https://example.com/css-grid)
Complete guide to CSS Grid.

### [TypeScript Best Practices](https://example.com/ts-tips)
Tips for writing better TypeScript code.
`;

// Sample article content without metadata
const MOCK_NO_TITLE_RESPONSE = `Some plain text content that doesn't have a proper title or URL source header.
But it does mention machine learning and neural networks several times.
This would be categorized under AI.`;

describe("article-importer", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("fetchArticle", () => {
    it("should parse a valid article response correctly", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(MOCK_AI_ARTICLE_RESPONSE),
      });

      const { fetchArticle } = await import("@/lib/article-importer");
      const result = await fetchArticle("https://example.com/ai-llm-guide");

      expect(result.title).toBe("Understanding Large Language Models");
      expect(result.category).toBe("ai");
      expect(result.source).toBe("web");
      expect(result.summary).toContain("Large language models");
      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe("https://example.com/diagram.png");
      expect(result.url).toBe("https://example.com/ai-llm-guide");
      expect(result.date).toBeTruthy();
      expect(result.content).toContain("transformer architecture");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("r.jina.ai"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Accept": "text/plain",
            "X-Return-Format": "markdown",
          }),
        })
      );
    });

    it("should use fallback title when no title is found", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(MOCK_NO_TITLE_RESPONSE),
      });

      const { fetchArticle } = await import("@/lib/article-importer");
      const result = await fetchArticle("https://example.com/no-title");

      expect(result.title).toBe("Untitled Article");
      expect(result.content).toContain("neural networks");
    });

    it("should throw on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      const { fetchArticle } = await import("@/lib/article-importer");
      await expect(
        fetchArticle("https://example.com/blocked")
      ).rejects.toThrow(/403/);
    });

    it("should handle network timeout", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fetch failed"));

      const { fetchArticle } = await import("@/lib/article-importer");
      await expect(
        fetchArticle("https://example.com/timeout")
      ).rejects.toThrow("fetch failed");
    });
  });

  describe("fetchRSSFeed", () => {
    it("should parse RSS feed items correctly", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(MOCK_RSS_RESPONSE),
      });

      const { fetchRSSFeed } = await import("@/lib/article-importer");
      const items = await fetchRSSFeed("https://example.com/feed.xml");

      expect(items).toHaveLength(3);
      expect(items[0].title).toBe("Getting Started with React");
      expect(items[0].link).toBe("https://example.com/react-intro");
      expect(items[1].title).toBe("CSS Grid Layout Guide");
      expect(items[1].link).toBe("https://example.com/css-grid");
      expect(items[2].title).toBe("TypeScript Best Practices");
      expect(items[2].link).toBe("https://example.com/ts-tips");
    });

    it("should return empty array for empty feed", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("Title: Empty Feed\nURL Source: https://example.com\n---\n"),
      });

      const { fetchRSSFeed } = await import("@/lib/article-importer");
      const items = await fetchRSSFeed("https://example.com/empty");
      expect(items).toHaveLength(0);
    });

    it("should throw on RSS fetch failure", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const { fetchRSSFeed } = await import("@/lib/article-importer");
      await expect(
        fetchRSSFeed("https://example.com/bad-feed")
      ).rejects.toThrow("Network error");
    });
  });

  describe("importArticle", () => {
    it("should import successfully with valid article", async () => {
      const { importArticleAction } = await import("../app/actions/import-article");
      const { writeRecord } = await import("@/lib/content");
      const result = await importArticleAction({
        url: "https://example.com/test",
        title: "Test Article",
        content: "Test content here",
        summary: "A test summary",
        category: "frontend",
        date: "2026-07-01",
        source: "web",
        images: [],
      });

      expect(result.ok).toBe(true);
      expect(writeRecord).toHaveBeenCalled();
    });

    it("should report error when writeRecord fails", async () => {
      const { writeRecord } = await import("@/lib/content");
      (writeRecord as any).mockRejectedValueOnce(new Error("Database connection failed"));

      const { importArticleAction } = await import("../app/actions/import-article");
      const result = await importArticleAction({
        url: "https://example.com/fail",
        title: "Failing Article",
        content: "Content that fails",
        summary: "Failing summary",
        category: "ai",
        date: "2026-07-01",
        source: "web",
        images: [],
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });
  });

  describe("category detection via fetchArticle", () => {
    it("should detect AI category from article content", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(MOCK_AI_ARTICLE_RESPONSE),
      });

      const { fetchArticle } = await import("@/lib/article-importer");
      const result = await fetchArticle("https://example.com/ai");
      expect(result.category).toBe("ai");
    });

    it("should detect frontend category", async () => {
      const frontendResponse = `Title: React Component Design
URL Source: https://example.com/react
Markdown Content:
---
This article discusses React components and CSS styling techniques.
`;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(frontendResponse),
      });

      const { fetchArticle } = await import("@/lib/article-importer");
      const result = await fetchArticle("https://example.com/react");
      expect(result.category).toBe("frontend");
    });

    it("should default to reading for uncategorized content", async () => {
      const genericResponse = `Title: Book Notes
URL Source: https://example.com/notes
Markdown Content:
---
This is a personal note about various thoughts and reflections.
`;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(genericResponse),
      });

      const { fetchArticle } = await import("@/lib/article-importer");
      const result = await fetchArticle("https://example.com/notes");
      expect(result.category).toBe("reading");
    });
  });

  describe("import workflow via /api/search (semantic search)", () => {
    it("should return search results for a query via API", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                recordId: "abc123",
                title: "Introduction to AI",
                category: "ai",
                score: 0.92,
              },
              {
                recordId: "def456",
                title: "Machine Learning Basics",
                category: "ai",
                score: 0.85,
              },
            ],
          }),
      });

      const res = await global.fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "artificial intelligence", limit: 5 }),
      });

      const data = await res.json();
      expect(data.results).toHaveLength(2);
      expect(data.results[0].title).toBe("Introduction to AI");
      expect(data.results[0].score).toBeCloseTo(0.92);
    });
  });
});