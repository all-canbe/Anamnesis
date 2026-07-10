/**
 * GitHub API Tests
 *
 * Tests commitFile, deleteFile, triggerRedeploy, isGithubMode.
 * Mocks: global fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Tests ───

describe("github-api", () => {
  let originalFetch: typeof global.fetch;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.resetModules();
    originalFetch = global.fetch;
    originalEnv = { ...process.env };
    process.env.GITHUB_TOKEN = "ghp_test-token";
    process.env.GITHUB_OWNER = "test-owner";
    process.env.GITHUB_REPO = "test-repo";
    process.env.GITHUB_BRANCH = "main";
    delete process.env.VERCEL_DEPLOY_HOOK;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  describe("isGithubMode", () => {
    it("should return true when GITHUB_TOKEN is set", async () => {
      const { isGithubMode } = await import("@/lib/github-api");
      expect(isGithubMode()).toBe(true);
    });

    it("should return false when GITHUB_TOKEN is empty", async () => {
      delete process.env.GITHUB_TOKEN;
      const { isGithubMode } = await import("@/lib/github-api");
      expect(isGithubMode()).toBe(false);
    });

    it("should return false when GITHUB_TOKEN is empty string", async () => {
      process.env.GITHUB_TOKEN = "";
      const { isGithubMode } = await import("@/lib/github-api");
      expect(isGithubMode()).toBe(false);
    });
  });

  describe("commitFile", () => {
    it("should return false when no GITHUB_TOKEN", async () => {
      vi.resetModules();
      delete process.env.GITHUB_TOKEN;
      const { commitFile } = await import("@/lib/github-api");
      const result = await commitFile("test.txt", "content", "commit message");
      expect(result).toBe(false);
    });

    it("should commit a new file successfully", async () => {
      global.fetch = vi.fn()
        // getSha call - file not found
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        // PUT call - success
        .mockResolvedValueOnce(new Response(JSON.stringify({ content: { sha: "abc123" } }), { status: 201 })) as any;

      const { commitFile } = await import("@/lib/github-api");
      const result = await commitFile("content/test.md", "# Hello", "Add test.md");

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should update an existing file with sha", async () => {
      global.fetch = vi.fn()
        // getSha call - file found
        .mockResolvedValueOnce(new Response(JSON.stringify({ sha: "existing-sha" }), { status: 200 }))
        // PUT call - success
        .mockResolvedValueOnce(new Response(JSON.stringify({ content: { sha: "new-sha" } }), { status: 200 })) as any;

      const { commitFile } = await import("@/lib/github-api");
      const result = await commitFile("content/existing.md", "# Updated", "Update existing.md");

      expect(result).toBe(true);
      // Second call should include sha
      const putBody = JSON.parse((global.fetch as any).mock.calls[1][1].body);
      expect(putBody.sha).toBe("existing-sha");
    });

    it("should return false on network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error")) as any;

      const { commitFile } = await import("@/lib/github-api");
      const result = await commitFile("test.txt", "content", "msg");

      expect(result).toBe(false);
    });

    it("should return false on HTTP error during PUT", async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Bad request" }), { status: 422 })) as any;

      const { commitFile } = await import("@/lib/github-api");
      const result = await commitFile("test.txt", "content", "msg");

      expect(result).toBe(false);
    });
  });

  describe("deleteFile", () => {
    it("should return false when no GITHUB_TOKEN", async () => {
      vi.resetModules();
      delete process.env.GITHUB_TOKEN;
      const { deleteFile } = await import("@/lib/github-api");
      const result = await deleteFile("test.txt", "delete message");
      expect(result).toBe(false);
    });

    it("should delete a file successfully", async () => {
      global.fetch = vi.fn()
        // getSha call
        .mockResolvedValueOnce(new Response(JSON.stringify({ sha: "existing-sha" }), { status: 200 }))
        // DELETE call
        .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 })) as any;

      const { deleteFile } = await import("@/lib/github-api");
      const result = await deleteFile("content/old.md", "Delete old.md");

      expect(result).toBe(true);
    });

    it("should return true when file does not exist (sha is null)", async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce(new Response(null, { status: 404 })) as any;

      const { deleteFile } = await import("@/lib/github-api");
      const result = await deleteFile("nonexistent.md", "Delete");

      expect(result).toBe(true);
    });

    it("should return false on network error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error")) as any;

      const { deleteFile } = await import("@/lib/github-api");
      const result = await deleteFile("test.txt", "msg");

      expect(result).toBe(false);
    });
  });

  describe("triggerRedeploy", () => {
    it("should not call fetch when VERCEL_DEPLOY_HOOK is not set", async () => {
      vi.resetModules();
      global.fetch = vi.fn() as any;

      const { triggerRedeploy } = await import("@/lib/github-api");
      await triggerRedeploy();

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should call Vercel deploy hook when configured", async () => {
      vi.resetModules();
      process.env.VERCEL_DEPLOY_HOOK = "https://api.vercel.com/v1/integrations/deploy/hook";
      global.fetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 })) as any;

      const { triggerRedeploy } = await import("@/lib/github-api");
      await triggerRedeploy();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.vercel.com/v1/integrations/deploy/hook",
        { method: "POST" }
      );
    });

    it("should not throw on deploy hook failure", async () => {
      vi.resetModules();
      process.env.VERCEL_DEPLOY_HOOK = "https://api.vercel.com/v1/integrations/deploy/hook";
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error")) as any;

      const { triggerRedeploy } = await import("@/lib/github-api");
      // Should not throw
      await expect(triggerRedeploy()).resolves.toBeUndefined();
    });
  });
});