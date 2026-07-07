/**
 * API Routes Tests
 *
 * Tests search, cli, tags, settings, record-counts, auth/login, and upload routes.
 * Mocks: dependencies for each route.
 *
 * Note: API routes are under app/ at project root, not src/.
 * The @ alias only maps to src/, so we use relative imports.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks for dependencies ───

vi.mock("@/lib/zvec", () => ({
  semanticSearch: vi.fn(async (query: string) => {
    if (query === "error") throw new Error("Search failed");
    return [
      { recordId: "k1", title: "Test", category: "ai", score: 0.9, snippet: "Found" },
    ];
  }),
  initIndex: vi.fn(async () => {}),
  hybridSearch: vi.fn(async () => []),
  addToIndex: vi.fn(),
  removeFromIndex: vi.fn(),
  findSimilar: vi.fn(async () => []),
}));

vi.mock("@/lib/auth", () => ({
  verifyToken: vi.fn(async (token: string) => {
    if (token === "valid-token") return true;
    return false;
  }),
  validateCredentials: vi.fn(async (username: string, password: string) => {
    return username === "admin" && password === "kb65";
  }),
  createToken: vi.fn(async () => "test-jwt-token-xyz"),
}));

vi.mock("@/lib/content", () => ({
  getRecords: vi.fn(async () => [
    { id: "k1", slug: "test", title: "Test", date: "2026-01-01", category: "ai", summary: "s", format: "md" },
    { id: "k2", slug: "test2", title: "Test 2", date: "2026-01-02", category: "reading", summary: "s2", format: "md" },
  ]),
  getRecord: vi.fn(async (id: string) => {
    if (id === "k1") {
      return {
        meta: { id: "k1", slug: "test", title: "Test", date: "2026-01-01", category: "ai", summary: "s", format: "md" },
        content: "Content of k1",
      };
    }
    return null;
  }),
  writeRecord: vi.fn(async () => {}),
  deleteRecord: vi.fn(async () => {}),
  getTags: vi.fn(async () => ({
    frontend: { label: "Frontend", icon: "frontend" },
    ai: { label: "AI/ML", icon: "ai" },
  })),
  addTag: vi.fn(async () => {}),
  deleteTag: vi.fn(async () => {}),
  generateId: vi.fn(async () => "k100"),
}));

vi.mock("@/lib/agent-config", () => ({
  getAgentConfig: vi.fn(async () => ({
    baseUrl: "https://api.test.com/v1",
    apiKey: "sk-test-key",
    model: "test-model",
  })),
  saveAgentConfig: vi.fn(async (cfg: any, skipKey?: boolean) => ({
    savedTo: "db" as const,
  })),
  hasAgentConfig: vi.fn(async () => ({
    configured: true,
    baseUrl: "https://api.test.com/v1",
    model: "test-model",
    keyPreview: "sk-t****test",
    savedTo: "db" as const,
  })),
}));

vi.mock("@/lib/api-auth", () => ({
  verifyRequestAuth: vi.fn(async (request: Request) => {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    return token === "valid-token";
  }),
  unauthorizedResponse: vi.fn(() =>
    Response.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  ),
}));

vi.mock("@/lib/github-api", () => ({
  commitFile: vi.fn(async () => true),
  deleteFile: vi.fn(async () => true),
  isGithubMode: vi.fn(() => false),
  triggerRedeploy: vi.fn(async () => {}),
}));

// ─── Helper ───

function createRequest(method: string, url: string, body?: any, headers?: Record<string, string>): Request {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

// ─── Tests ───

describe("API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/search", () => {
    it("should return search results for valid query", async () => {
      const { POST } = await import("../app/api/search/route");
      const req = createRequest("POST", "http://localhost/api/search", {
        query: "AI",
        limit: 5,
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.results).toBeDefined();
      expect(Array.isArray(json.results)).toBe(true);
    });

    it("should return 400 when query is missing", async () => {
      const { POST } = await import("../app/api/search/route");
      const req = createRequest("POST", "http://localhost/api/search", {
        limit: 5,
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
    });

    it("should return 400 when query is not a string", async () => {
      const { POST } = await import("../app/api/search/route");
      const req = createRequest("POST", "http://localhost/api/search", {
        query: 123,
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(res.status).toBe(400);
    });

    it("should return 500 when search throws", async () => {
      const { POST } = await import("../app/api/search/route");
      const req = createRequest("POST", "http://localhost/api/search", {
        query: "error",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(res.status).toBe(500);
    });

    it("should use default limit of 10 when not specified", async () => {
      const { semanticSearch } = await import("@/lib/zvec");
      const { POST } = await import("../app/api/search/route");
      const req = createRequest("POST", "http://localhost/api/search", {
        query: "test",
      });

      await POST(req as any);
      expect(semanticSearch).toHaveBeenCalledWith("test", 10);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should return token for valid credentials", async () => {
      const { POST } = await import("../app/api/auth/login/route");
      const req = createRequest("POST", "http://localhost/api/auth/login", {
        username: "admin",
        password: "kb65",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.token).toBe("test-jwt-token-xyz");
    });

    it("should return 401 for invalid credentials", async () => {
      const { POST } = await import("../app/api/auth/login/route");
      const req = createRequest("POST", "http://localhost/api/auth/login", {
        username: "admin",
        password: "wrong",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.ok).toBe(false);
    });

    it("should return 400 when username is missing", async () => {
      const { POST } = await import("../app/api/auth/login/route");
      const req = createRequest("POST", "http://localhost/api/auth/login", {
        password: "kb65",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(res.status).toBe(400);
    });

    it("should return 400 when password is missing", async () => {
      const { POST } = await import("../app/api/auth/login/route");
      const req = createRequest("POST", "http://localhost/api/auth/login", {
        username: "admin",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(res.status).toBe(400);
    });

    it("should set cookie on successful login", async () => {
      const { POST } = await import("../app/api/auth/login/route");
      const req = createRequest("POST", "http://localhost/api/auth/login", {
        username: "admin",
        password: "kb65",
      });

      const res = await POST(req as any);
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toContain("zhiyi_token");
    });
  });

  describe("GET /api/settings", () => {
    it("should return 401 without auth", async () => {
      const { GET } = await import("../app/api/settings/route");
      const req = createRequest("GET", "http://localhost/api/settings");

      const res = await GET(req as any);
      expect(res.status).toBe(401);
    });

    it("should return agent config with valid auth", async () => {
      const { GET } = await import("../app/api/settings/route");
      const req = createRequest("GET", "http://localhost/api/settings", undefined, {
        Authorization: "Bearer valid-token",
      });

      const res = await GET(req as any);
      const json = await res.json();

      expect(json.configured).toBe(true);
      expect(json.keyPreview).toBeDefined();
    });
  });

  describe("POST /api/settings", () => {
    it("should return 401 without auth", async () => {
      const { POST } = await import("../app/api/settings/route");
      const req = createRequest("POST", "http://localhost/api/settings", {
        baseUrl: "https://api.test.com/v1",
        model: "test-model",
      });

      const res = await POST(req as any);
      expect(res.status).toBe(401);
    });

    it("should save agent config with valid auth", async () => {
      const { POST } = await import("../app/api/settings/route");
      const req = createRequest("POST", "http://localhost/api/settings", {
        baseUrl: "https://api.test.com/v1",
        apiKey: "sk-test",
        model: "test-model",
      }, {
        Authorization: "Bearer valid-token",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.savedTo).toBe("db");
    });

    it("should return 400 when baseUrl is missing", async () => {
      const { POST } = await import("../app/api/settings/route");
      const req = createRequest("POST", "http://localhost/api/settings", {
        model: "test-model",
      }, {
        Authorization: "Bearer valid-token",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
    });
  });

  describe("POST /api/cli", () => {
    it("should return 401 without auth", async () => {
      const { POST } = await import("../app/api/cli/route");
      const req = createRequest("POST", "http://localhost/api/cli", {
        command: "list",
      });

      const res = await POST(req as any);
      expect(res.status).toBe(401);
    });

    it("should return 400 when command is missing", async () => {
      const { POST } = await import("../app/api/cli/route");
      const req = createRequest("POST", "http://localhost/api/cli", {}, {
        Authorization: "Bearer valid-token",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.ok).toBe(false);
    });

    it("should list records with valid auth", async () => {
      const { POST } = await import("../app/api/cli/route");
      const req = createRequest("POST", "http://localhost/api/cli", {
        command: "list",
      }, {
        Authorization: "Bearer valid-token",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.records).toBeDefined();
      expect(Array.isArray(json.records)).toBe(true);
    });

    it("should get a record by id", async () => {
      const { POST } = await import("../app/api/cli/route");
      const req = createRequest("POST", "http://localhost/api/cli", {
        command: "get",
        args: { id: "k1" },
      }, {
        Authorization: "Bearer valid-token",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.record).toBeDefined();
    });

    it("should return error for non-existent record", async () => {
      const { POST } = await import("../app/api/cli/route");
      const req = createRequest("POST", "http://localhost/api/cli", {
        command: "get",
        args: { id: "k999" },
      }, {
        Authorization: "Bearer valid-token",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(json.ok).toBe(false);
      expect(json.error).toContain("not found");
    });

    it("should return status with stats", async () => {
      const { POST } = await import("../app/api/cli/route");
      const req = createRequest("POST", "http://localhost/api/cli", {
        command: "status",
      }, {
        Authorization: "Bearer valid-token",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.total).toBe(2);
      expect(json.categories).toBeDefined();
      expect(json.latest).toBeDefined();
    });

    it("should return error for unknown command", async () => {
      const { POST } = await import("../app/api/cli/route");
      const req = createRequest("POST", "http://localhost/api/cli", {
        command: "unknown-command",
      }, {
        Authorization: "Bearer valid-token",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.ok).toBe(false);
      expect(json.error).toContain("Unknown command");
    });

    it("should return tags", async () => {
      const { POST } = await import("../app/api/cli/route");
      const req = createRequest("POST", "http://localhost/api/cli", {
        command: "tags",
      }, {
        Authorization: "Bearer valid-token",
      });

      const res = await POST(req as any);
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.tags).toBeDefined();
    });
  });
});