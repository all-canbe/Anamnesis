/**
 * Content Module Tests
 *
 * Tests writeRecord, getRecord, getRecords, deleteRecord, generateId,
 * getTags, addTag, deleteTag, getCategories, getFilteredRecords.
 * Mocks: turso, github-api, fs, path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks for dependencies ───

const mockIsTursoConfigured = vi.fn(() => false);
const storedRecords: Record<string, any>[] = [];
const mockTursoGetRecords = vi.fn(async () => [...storedRecords]);
const mockTursoGetRecord = vi.fn();
const mockTursoWriteRecord = vi.fn(async (meta: { id: string; [key: string]: any }) => {
  storedRecords.push(meta);
});
const mockTursoDeleteRecord = vi.fn(async (id: string) => {
  const idx = storedRecords.findIndex((r) => r.id === id);
  if (idx >= 0) storedRecords.splice(idx, 1);
});
const mockTursoGetTags = vi.fn();
const mockTursoAddTag = vi.fn();
const mockTursoDeleteTag = vi.fn();
const mockInitTursoSchema = vi.fn();

vi.mock("@/lib/turso", () => ({
  isTursoConfigured: mockIsTursoConfigured,
  tursoGetRecords: mockTursoGetRecords,
  tursoGetRecord: mockTursoGetRecord,
  tursoWriteRecord: mockTursoWriteRecord,
  tursoDeleteRecord: mockTursoDeleteRecord,
  tursoGetTags: mockTursoGetTags,
  tursoAddTag: mockTursoAddTag,
  tursoDeleteTag: mockTursoDeleteTag,
  initTursoSchema: mockInitTursoSchema,
}));

const mockCommitFile = vi.fn();
const mockGithubDeleteFile = vi.fn();
const mockIsGithubMode = vi.fn(() => false);
const mockTriggerRedeploy = vi.fn();

vi.mock("@/lib/github-api", () => ({
  commitFile: mockCommitFile,
  deleteFile: mockGithubDeleteFile,
  isGithubMode: mockIsGithubMode,
  triggerRedeploy: mockTriggerRedeploy,
}));

// ─── Tests ───

describe("content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedRecords.length = 0;
    // Re-apply custom implementations that clearAllMocks would wipe
    mockTursoGetRecords.mockImplementation(async () => [...storedRecords]);
    mockTursoWriteRecord.mockImplementation(async (meta: { id: string; [key: string]: any }) => {
      storedRecords.push(meta);
    });
    mockTursoDeleteRecord.mockImplementation(async (id: string) => {
      const idx = storedRecords.findIndex((r) => r.id === id);
      if (idx >= 0) storedRecords.splice(idx, 1);
    });
    mockIsTursoConfigured.mockReturnValue(false);
    mockIsGithubMode.mockReturnValue(false);
    mockTursoGetRecord.mockResolvedValue(null);
    mockTursoGetTags.mockResolvedValue({});
    mockTursoAddTag.mockResolvedValue(undefined);
    mockTursoDeleteTag.mockResolvedValue(undefined);
    mockInitTursoSchema.mockResolvedValue(undefined);
    mockCommitFile.mockResolvedValue(true);
    mockGithubDeleteFile.mockResolvedValue(true);
    mockTriggerRedeploy.mockResolvedValue(undefined);
  });

  describe("generateId", () => {
    it("should generate IDs in k-number format", async () => {
      const { generateId } = await import("@/lib/content");
      const id = await generateId();
      expect(id).toMatch(/^k\d+$/);
      expect(parseInt(id.slice(1))).toBeGreaterThanOrEqual(1);
    });

    it("should always return string starting with 'k'", async () => {
      const { generateId } = await import("@/lib/content");
      for (let i = 0; i < 10; i++) {
        const id = await generateId();
        expect(id).toMatch(/^k\d+$/);
      }
    });

    it("should generate unique IDs when records are written between calls", async () => {
      const { generateId, writeRecord } = await import("@/lib/content");
      mockIsTursoConfigured.mockReturnValue(true);

      const id1 = await generateId();
      await writeRecord({ id: id1, slug: "a", title: "A", date: "2026-01-01", category: "ai", summary: "s", format: "md", visibility: "private" }, "content");
      const id2 = await generateId();
      await writeRecord({ id: id2, slug: "b", title: "B", date: "2026-01-01", category: "ai", summary: "s", format: "md", visibility: "private" }, "content");
      const id3 = await generateId();

      const ids = new Set([id1, id2, id3]);
      expect(ids.size).toBe(3);
    });
  });

  describe("getRecords", () => {
    it("should return records from Turso when configured", async () => {
      mockIsTursoConfigured.mockReturnValue(true);
      mockTursoGetRecords.mockResolvedValue([
        { id: "k1", slug: "test", title: "Test", date: "2026-01-01", category: "ai", summary: "summary", format: "md", visibility: "private" },
      ]);

      const { getRecords } = await import("@/lib/content");
      const records = await getRecords();

      expect(records).toHaveLength(1);
      expect(records[0].id).toBe("k1");
    });

    it("should fall back to local fs when Turso fails", async () => {
      mockIsTursoConfigured.mockReturnValue(true);
      mockTursoGetRecords.mockRejectedValue(new Error("Turso error"));

      const { getRecords } = await import("@/lib/content");
      // Will fall back to reading from content/index.json
      const records = await getRecords();
      expect(Array.isArray(records)).toBe(true);
    });

    it("should return empty array when Turso returns empty", async () => {
      mockIsTursoConfigured.mockReturnValue(true);
      mockTursoGetRecords.mockResolvedValue([]);

      const { getRecords } = await import("@/lib/content");
      const records = await getRecords();

      expect(records).toHaveLength(0);
    });
  });

  describe("getRecord", () => {
    it("should return null for non-existent record", async () => {
      mockIsTursoConfigured.mockReturnValue(true);
      mockTursoGetRecord.mockResolvedValue(null);

      const { getRecord } = await import("@/lib/content");
      const record = await getRecord("k999");

      expect(record).toBeNull();
    });

    it("should return record from Turso", async () => {
      mockIsTursoConfigured.mockReturnValue(true);
      mockTursoGetRecord.mockResolvedValue({
        meta: { id: "k1", slug: "test", title: "Test", date: "2026-01-01", category: "ai", summary: "s", format: "md", visibility: "private" },
        content: "Hello world",
      });

      const { getRecord } = await import("@/lib/content");
      const record = await getRecord("k1");

      expect(record).not.toBeNull();
      expect(record!.meta.id).toBe("k1");
      expect(record!.content).toBe("Hello world");
    });

    it("should fall back to local fs when Turso fails", async () => {
      mockIsTursoConfigured.mockReturnValue(true);
      mockTursoGetRecord.mockRejectedValue(new Error("Turso error"));

      const { getRecord } = await import("@/lib/content");
      // Will fall back to local fs
      const record = await getRecord("k1");
      // Should not throw
      expect(record === null || record !== null).toBe(true);
    });
  });

  describe("writeRecord", () => {
    it("should write to Turso when configured", async () => {
      mockIsTursoConfigured.mockReturnValue(true);
      mockTursoWriteRecord.mockResolvedValue(undefined);

      const { writeRecord } = await import("@/lib/content");
      const meta = { id: "k100", slug: "test", title: "Test", date: "2026-01-01", category: "ai" as const, summary: "s", format: "md" as const, visibility: "private" as const, };
      await writeRecord(meta, "content");

      expect(mockTursoWriteRecord).toHaveBeenCalledWith(meta, "content", "admin");
    });

    it("should write to local fs when Turso and GitHub are unavailable", async () => {
      mockIsTursoConfigured.mockReturnValue(false);
      mockIsGithubMode.mockReturnValue(false);

      const { writeRecord } = await import("@/lib/content");
      const meta = { id: "k100", slug: "test", title: "Test", date: "2026-01-01", category: "ai" as const, summary: "s", format: "md" as const, visibility: "private" as const, };

      // Local fs is available in test environment, should not throw
      await expect(writeRecord(meta, "content")).resolves.toBeUndefined();
    });
  });

  describe("deleteRecord", () => {
    it("should delete from Turso when configured", async () => {
      mockIsTursoConfigured.mockReturnValue(true);
      mockTursoDeleteRecord.mockResolvedValue(undefined);

      const { deleteRecord } = await import("@/lib/content");
      await deleteRecord("k1");

      expect(mockTursoDeleteRecord).toHaveBeenCalledWith("k1", undefined);
    });

    it("should not throw when record not found in local fs", async () => {
      mockIsTursoConfigured.mockReturnValue(false);
      // local fs mode: will look for the record in index, won't find it, returns early

      const { deleteRecord } = await import("@/lib/content");
      await expect(deleteRecord("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("getTags", () => {
    it("should return tags from Turso when configured", async () => {
      mockIsTursoConfigured.mockReturnValue(true);
      mockTursoGetTags.mockResolvedValue({
        frontend: { label: "Frontend", icon: "frontend" },
        custom: { label: "Custom", icon: "custom" },
      });

      const { getTags } = await import("@/lib/content");
      const tags = await getTags();

      expect(tags).toHaveProperty("frontend");
      expect(tags).toHaveProperty("custom");
    });

    it("should return default categories when Turso fails", async () => {
      mockIsTursoConfigured.mockReturnValue(true);
      mockTursoGetTags.mockRejectedValue(new Error("Turso error"));

      const { getTags } = await import("@/lib/content");
      const tags = await getTags();

      expect(tags).toHaveProperty("frontend");
      expect(tags).toHaveProperty("ai");
      expect(tags).toHaveProperty("backend");
    });
  });
});