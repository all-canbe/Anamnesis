/**
 * Turso Module Tests
 *
 * Tests isTursoConfigured, initTursoSchema, tursoGetRecords, tursoWriteRecord,
 * tursoDeleteRecord, tursoGetRecord, getSetting, setSetting, tursoGetTags,
 * tursoAddTag, tursoDeleteTag.
 * Mocks: global fetch for Turso HTTP API calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { RecordMeta } from "@/lib/types";

// ─── Helpers ───

function makeTursoResponse(rows: any[][] = []) {
  return [
    {
      results: {
        rows,
        columns: [],
      },
    },
  ];
}

function makeTursoError(status: number, statusText: string) {
  return new Response(JSON.stringify({ error: statusText }), { status, statusText });
}

// ─── Tests ───

describe("turso", () => {
  let originalFetch: typeof global.fetch;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
    process.env.TURSO_DB_URL = "https://test-db.turso.io";
    process.env.TURSO_DB_TOKEN = "test-token";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  describe("isTursoConfigured", () => {
    it("should return true when both env vars are set", async () => {
      const { isTursoConfigured } = await import("@/lib/turso");
      expect(isTursoConfigured()).toBe(true);
    });

    it("should return false when TURSO_DB_URL is missing", async () => {
      delete process.env.TURSO_DB_URL;
      const { isTursoConfigured } = await import("@/lib/turso");
      expect(isTursoConfigured()).toBe(false);
    });

    it("should return false when TURSO_DB_TOKEN is missing", async () => {
      delete process.env.TURSO_DB_TOKEN;
      const { isTursoConfigured } = await import("@/lib/turso");
      expect(isTursoConfigured()).toBe(false);
    });

    it("should return false when both are missing", async () => {
      delete process.env.TURSO_DB_URL;
      delete process.env.TURSO_DB_TOKEN;
      const { isTursoConfigured } = await import("@/lib/turso");
      expect(isTursoConfigured()).toBe(false);
    });

    it("should return false when env vars are empty strings", async () => {
      process.env.TURSO_DB_URL = "";
      process.env.TURSO_DB_TOKEN = "";
      const { isTursoConfigured } = await import("@/lib/turso");
      expect(isTursoConfigured()).toBe(false);
    });
  });

  describe("initTursoSchema", () => {
    it("should execute CREATE TABLE and ALTER TABLE statements", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify(makeTursoResponse()), { status: 200 }))
      ) as any;

      const { initTursoSchema } = await import("@/lib/turso");
      await initTursoSchema();

      expect(global.fetch).toHaveBeenCalledTimes(16);
    });

    it("should throw when Turso is not configured", async () => {
      delete process.env.TURSO_DB_URL;
      const { initTursoSchema } = await import("@/lib/turso");
      await expect(initTursoSchema()).rejects.toThrow("Turso not configured");
    });
  });

  describe("tursoGetRecords", () => {
    it("should return parsed records", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(makeTursoResponse([
          ["k1", "test", "Test Title", "2026-01-01", "ai", "summary", "md", "private", "[]"],
          ["k2", "test2", "Test 2", "2026-01-02", "reading", "summary2", "md", "private", "[]"],
        ])), { status: 200 })
      ) as any;

      const { tursoGetRecords } = await import("@/lib/turso");
      const records = await tursoGetRecords("test");

      expect(records).toHaveLength(2);
      expect(records[0].id).toBe("k1");
      expect(records[1].title).toBe("Test 2");
    });

    it("should return empty array when no records", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(makeTursoResponse([])), { status: 200 })
      ) as any;

      const { tursoGetRecords } = await import("@/lib/turso");
      const records = await tursoGetRecords("test");

      expect(records).toHaveLength(0);
    });

    it("should throw on HTTP error", async () => {
      global.fetch = vi.fn().mockResolvedValue(makeTursoError(500, "Internal Server Error")) as any;

      const { tursoGetRecords } = await import("@/lib/turso");
      await expect(tursoGetRecords("test")).rejects.toThrow("Turso query failed");
    });
  });

  describe("tursoGetRecord", () => {
    it("should return record when found", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(makeTursoResponse([
          ["k1", "test", "Test", "2026-01-01", "ai", "summary", "md", "Full content", "private", "[]"],
        ])), { status: 200 })
      ) as any;

      const { tursoGetRecord } = await import("@/lib/turso");
      const record = await tursoGetRecord("k1", "test");

      expect(record).not.toBeNull();
      expect(record!.meta.id).toBe("k1");
      expect(record!.content).toBe("Full content");
    });

    it("should return null when not found", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(makeTursoResponse([])), { status: 200 })
      ) as any;

      const { tursoGetRecord } = await import("@/lib/turso");
      const record = await tursoGetRecord("k999", "test");

      expect(record).toBeNull();
    });
  });

  describe("tursoWriteRecord", () => {
    it("should execute INSERT with upsert", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(makeTursoResponse()), { status: 200 })
      ) as any;

      const { tursoWriteRecord } = await import("@/lib/turso");
      const meta: RecordMeta = { id: "k1", slug: "test", title: "Test", date: "2026-01-01", category: "ai" as const, summary: "s", format: "md", visibility: "private" as const };
      await tursoWriteRecord(meta, "content", "test");

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      const sql = body.statements[0].q;
      expect(sql).toContain("INSERT INTO records");
      expect(sql).toContain("ON CONFLICT");
    });
  });

  describe("tursoDeleteRecord", () => {
    it("should execute DELETE statement", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(makeTursoResponse()), { status: 200 })
      ) as any;

      const { tursoDeleteRecord } = await import("@/lib/turso");
      await tursoDeleteRecord("k1", "test");

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.statements[0].q).toContain("DELETE FROM records");
    });
  });

  describe("getSetting", () => {
    it("should return setting value when found", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(makeTursoResponse([["my-value"]])), { status: 200 })
      ) as any;

      const { getSetting } = await import("@/lib/turso");
      const value = await getSetting("my-key");

      expect(value).toBe("my-value");
    });

    it("should return null when setting not found", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(makeTursoResponse([])), { status: 200 })
      ) as any;

      const { getSetting } = await import("@/lib/turso");
      const value = await getSetting("nonexistent");

      expect(value).toBeNull();
    });
  });

  describe("setSetting", () => {
    it("should execute INSERT with upsert for settings", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(makeTursoResponse()), { status: 200 })
      ) as any;

      const { setSetting } = await import("@/lib/turso");
      await setSetting("test-key", "test-value");

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.statements[0].q).toContain("INSERT INTO settings");
      expect(body.statements[0].q).toContain("ON CONFLICT");
    });
  });

  describe("tursoGetTags", () => {
    it("should return merged categories and custom tags", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(makeTursoResponse([
          ["custom", "Custom Tag", "star", "#3b82f6", 1],
        ])), { status: 200 })
      ) as any;

      const { tursoGetTags } = await import("@/lib/turso");
      const tags = await tursoGetTags();

      expect(tags).toHaveProperty("frontend");
      expect(tags).toHaveProperty("custom");
      expect(tags.custom.label).toBe("Custom Tag");
    });
  });

  describe("tursoAddTag", () => {
    it("should execute INSERT with upsert for tags", async () => {
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(makeTursoResponse([])), { status: 200 }))
      ) as any;

      const { tursoAddTag } = await import("@/lib/turso");
      await tursoAddTag("new-tag", "New Tag", "star");

      // tursoAddTag 先 SELECT 检查冲突，再 INSERT
      const insertCall = (global.fetch as any).mock.calls.find((c: any) => {
        const body = JSON.parse(c[1].body);
        return body.statements[0].q.includes("INSERT INTO tags");
      });
      expect(insertCall).toBeDefined();
    });
  });

  describe("tursoDeleteTag", () => {
    it("should execute DELETE for tags", async () => {
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(makeTursoResponse([[0, 0]])), { status: 200 }))
      ) as any;

      const { tursoDeleteTag } = await import("@/lib/turso");
      await tursoDeleteTag("custom");

      const deleteCall = (global.fetch as any).mock.calls.find((c: any) => {
        const body = JSON.parse(c[1].body);
        return body.statements[0].q.includes("DELETE FROM tags");
      });
      expect(deleteCall).toBeDefined();
    });

    it("should not delete built-in category tags", async () => {
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(makeTursoResponse([[1, 1]])), { status: 200 }))
      ) as any;

      const { tursoDeleteTag } = await import("@/lib/turso");
      await tursoDeleteTag("frontend");

      // SELECT was called to check is_public, but no DELETE should be issued
      const calls = (global.fetch as any).mock.calls;
      const deleteCall = calls.find((c: any) => {
        const body = JSON.parse(c[1].body);
        return body.statements[0].q.includes("DELETE FROM tags");
      });
      expect(deleteCall).toBeUndefined();
    });
  });
});