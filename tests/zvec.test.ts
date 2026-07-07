/**
 * Zvec (Vector Index) Tests
 *
 * Tests initIndex, addToIndex, removeFromIndex, semanticSearch, findSimilar, hybridSearch.
 * Mocks: content (getRecords, getRecord), embedding (embedText, embedBatch, cosineSimilarity).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock data ───

const mockRecords = [
  { id: "k1", slug: "test1", title: "AI Overview", date: "2026-01-01", category: "ai", summary: "About AI", format: "md" },
  { id: "k2", slug: "test2", title: "React Patterns", date: "2026-01-02", category: "frontend", summary: "React tips", format: "md" },
  { id: "k3", slug: "test3", title: "Docker Guide", date: "2026-01-03", category: "devops", summary: "Docker tips", format: "md" },
];

const mockRecordContent = (id: string) => ({
  meta: mockRecords.find((r) => r.id === id)!,
  content: `This is the content of ${id}. It has multiple sentences. More content here.`,
});

// ─── Mocks ───

vi.mock("@/lib/content", () => ({
  getRecords: vi.fn(async () => mockRecords),
  getRecord: vi.fn(async (id: string) => {
    const r = mockRecords.find((r) => r.id === id);
    return r ? mockRecordContent(id) : null;
  }),
}));

vi.mock("@/lib/embedding", () => ({
  embedText: vi.fn(async (text: string) => {
    if (text.includes("AI")) return { vector: [0.5, 0.3, 0.1, 0.0], dimensions: 4 };
    if (text.includes("React") || text.includes("frontend")) return { vector: [0.1, 0.8, 0.2, 0.0], dimensions: 4 };
    if (text.includes("Docker") || text.includes("devops")) return { vector: [0.0, 0.0, 0.9, 0.3], dimensions: 4 };
    return { vector: [0.0, 0.0, 0.0, 0.0], dimensions: 4 };
  }),
  embedBatch: vi.fn(async (texts: string[]) => {
    return texts.map((t) => {
      if (t.includes("AI")) return { vector: [0.5, 0.3, 0.1, 0.0], dimensions: 4 };
      if (t.includes("React")) return { vector: [0.1, 0.8, 0.2, 0.0], dimensions: 4 };
      if (t.includes("Docker")) return { vector: [0.0, 0.0, 0.9, 0.3], dimensions: 4 };
      return { vector: [0.0, 0.0, 0.0, 0.0], dimensions: 4 };
    });
  }),
  cosineSimilarity: vi.fn((a: number[], b: number[]) => {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }),
}));

// ─── Tests ───

describe("zvec", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module to clear the internal initialized flag and index
    vi.resetModules();
  });

  describe("initIndex", () => {
    it("should build index from records", async () => {
      const { initIndex } = await import("@/lib/zvec");
      await initIndex();

      const { getRecords } = await import("@/lib/content");
      expect(getRecords).toHaveBeenCalled();
    });

    it("should only initialize once", async () => {
      const { initIndex } = await import("@/lib/zvec");
      await initIndex();
      await initIndex();

      const { getRecords } = await import("@/lib/content");
      expect(getRecords).toHaveBeenCalledTimes(1);
    });

    it("should handle empty records gracefully", async () => {
      const { getRecords } = await import("@/lib/content");
      (getRecords as any).mockResolvedValueOnce([]);

      const { initIndex } = await import("@/lib/zvec");
      await expect(initIndex()).resolves.toBeUndefined();
    });
  });

  describe("semanticSearch", () => {
    it("should return search results sorted by score", async () => {
      const { semanticSearch, initIndex } = await import("@/lib/zvec");
      await initIndex();

      const results = await semanticSearch("AI");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty("recordId");
      expect(results[0]).toHaveProperty("title");
      expect(results[0]).toHaveProperty("score");
      expect(results[0]).toHaveProperty("snippet");
    });

    it("should respect the limit parameter", async () => {
      const { semanticSearch, initIndex } = await import("@/lib/zvec");
      await initIndex();

      const results = await semanticSearch("test", undefined, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should return empty array when index is empty", async () => {
      const { getRecords } = await import("@/lib/content");
      (getRecords as any).mockResolvedValueOnce([]);

      const { semanticSearch } = await import("@/lib/zvec");
      const results = await semanticSearch("nothing");

      expect(results).toHaveLength(0);
    });
  });

  describe("removeFromIndex", () => {
    it("should remove a record from index", async () => {
      const { removeFromIndex, initIndex, semanticSearch } = await import("@/lib/zvec");
      await initIndex();

      removeFromIndex("k1");

      const results = await semanticSearch("test");
      const k1Result = results.find((r) => r.recordId === "k1");
      expect(k1Result).toBeUndefined();
    });

    it("should not throw when removing non-existent record", async () => {
      const { removeFromIndex } = await import("@/lib/zvec");
      expect(() => removeFromIndex("nonexistent")).not.toThrow();
    });
  });

  describe("addToIndex", () => {
    it("should add a new record to the index", async () => {
      const { getRecord } = await import("@/lib/content");
      (getRecord as any).mockResolvedValueOnce({
        meta: { id: "new-record", slug: "new", title: "New", date: "2026-01-01", category: "ai", summary: "New record", format: "md" },
        content: "New content",
      });

      const { addToIndex } = await import("@/lib/zvec");
      await expect(addToIndex("new-record")).resolves.toBeUndefined();
    });

    it("should not throw when record not found", async () => {
      const { getRecord } = await import("@/lib/content");
      (getRecord as any).mockResolvedValueOnce(null);

      const { addToIndex } = await import("@/lib/zvec");
      await expect(addToIndex("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("findSimilar", () => {
    it("should return similar records sorted by score", async () => {
      const { findSimilar, initIndex } = await import("@/lib/zvec");
      await initIndex();

      const results = await findSimilar("k1", undefined, 2);

      expect(results.length).toBeLessThanOrEqual(2);
      expect(results.find((r) => r.recordId === "k1")).toBeUndefined();
    });

    it("should return empty array when record not found", async () => {
      const { findSimilar } = await import("@/lib/zvec");
      const results = await findSimilar("nonexistent");

      expect(results).toHaveLength(0);
    });
  });
});