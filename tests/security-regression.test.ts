/**
 * Security Regression Tests
 *
 * Tests for security vulnerabilities identified by QA + Security audit.
 * These tests document EXPECTED secure behavior. Before fixes are applied,
 * many will FAIL (correctly reflecting the vulnerability). After fixes,
 * they should PASS, serving as regression protection.
 *
 * Test categories:
 * 1. Unauthenticated API access (C3, C4, M1) — should return 401
 * 2. SSRF via web_fetch (F-006) — should reject internal IPs
 * 3. Doom loop bypass via semantic equivalence — should detect reordered args
 * 4. safeError edge cases — path-based API key leakage
 * 5. Login brute-force protection (M2) — should rate-limit after N failures
 * 6. Upload file validation — should reject dangerous file types/sizes
 *
 * VULNERABILITY STATUS (as of 2026-07-01):
 * - Tests 1.x: FAIL (no auth on these endpoints — this is the bug)
 * - Tests 2.x: FAIL (no SSRF protection in web_fetch)
 * - Tests 3.x: FAIL (doom loop uses exact string match, not semantic)
 * - Tests 4.x: PASS (safeError doesn't use URLs)
 * - Tests 5.x: FAIL (no rate limiting on login)
 * - Tests 6.x: FAIL (no file validation on upload)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ═══════════════════════════════════════════════════════════════
// Module-level mock state (vi.mock is hoisted, so must use module-level vars)
// ═══════════════════════════════════════════════════════════════

let _mockToolExecute: ((args: Record<string, any>) => Promise<any>) | null = null;
let _mockLLMResult: any = { finishReason: "stop", content: "Done!", toolCalls: [] };
let _mockLLMSequence: any[] | null = null;
let _mockLLMCallCount = 0;
let _mockLLMShouldThrow = false;

vi.mock("@/lib/agent-llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent-llm")>();
  return {
    ...actual,
    callLLM: vi.fn(async () => {
      _mockLLMCallCount++;
      if (_mockLLMShouldThrow) throw new Error("LLM error");
      if (_mockLLMSequence && _mockLLMCallCount <= _mockLLMSequence.length) {
        return _mockLLMSequence[_mockLLMCallCount - 1];
      }
      return _mockLLMResult;
    }),
  };
});

vi.mock("@/lib/agent-tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent-tools")>();
  return {
    ...actual,
    getTool: vi.fn((name: string) => {
      if (!_mockToolExecute) return actual.getTool(name);
      return {
        name,
        description: `mock ${name}`,
        parameters: { type: "object", properties: {}, required: [] },
        execute: _mockToolExecute,
      };
    }),
  };
});

vi.mock("@/lib/agent-config", () => ({
  getAgentConfig: vi.fn(async () => ({
    baseUrl: "https://api.test.com/v1",
    apiKey: "sk-test-key",
    model: "test-model",
  })),
  hasAgentConfig: vi.fn(async () => ({ configured: true, baseUrl: "https://api.test.com/v1", model: "test-model" })),
  saveAgentConfig: vi.fn(async () => ({ savedTo: "env" })),
}));

function resetMockState() {
  _mockToolExecute = null;
  _mockLLMResult = { finishReason: "stop", content: "Done!", toolCalls: [] };
  _mockLLMSequence = null;
  _mockLLMCallCount = 0;
  _mockLLMShouldThrow = false;
}

// ═══════════════════════════════════════════════════════════════
// 1. Unauthenticated API Access Tests
// ═══════════════════════════════════════════════════════════════

describe("Security: Unauthenticated API Access", () => {
  beforeEach(() => resetMockState());

  describe("POST /api/agent/chat — should require auth [C3]", () => {
    it("should return 401 when no Authorization header is provided", async () => {
      const { POST } = await import("../app/api/agent/chat/route");
      const req = new NextRequest("http://localhost/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      });
      const res = await POST(req);
      // EXPECTED after fix: 401
      // CURRENT (vulnerable): 200 with SSE stream
      expect(res.status).toBe(401);
    });

    it("should return 401 when Authorization header is empty", async () => {
      const { POST } = await import("../app/api/agent/chat/route");
      const req = new NextRequest("http://localhost/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "",
        },
        body: JSON.stringify({ message: "hello" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("should return 401 when Bearer token is invalid", async () => {
      const { POST } = await import("../app/api/agent/chat/route");
      const req = new NextRequest("http://localhost/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer fake-invalid-token",
        },
        body: JSON.stringify({ message: "hello" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/settings — should require auth [C4]", () => {
    it("should return 401 when no Authorization header is provided", async () => {
      const { GET } = await import("../app/api/settings/route");
      const req = new NextRequest("http://localhost/api/settings");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/settings — should require auth [C4]", () => {
    it("should return 401 when no Authorization header is provided", async () => {
      const { POST } = await import("../app/api/settings/route");
      const req = new NextRequest("http://localhost/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: "https://api.evil.com/v1",
          apiKey: "sk-attacker-key",
          model: "gpt-4",
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("should NOT allow unauthenticated config override to malicious URL", async () => {
      const { POST } = await import("../app/api/settings/route");
      const req = new NextRequest("http://localhost/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: "https://api.attacker-controlled.com/v1",
          apiKey: "sk-intercepted",
          model: "gpt-4",
        }),
      });
      const res = await POST(req);
      // This attack allows API key interception — MUST be blocked
      expect(res.status).toBe(401);
      const { saveAgentConfig } = await import("@/lib/agent-config");
      expect(saveAgentConfig).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/upload — should require auth [M1]", () => {
    it("should return 401 when no Authorization header is provided", async () => {
      process.env.QINIU_ACCESS_KEY = "test-key";
      process.env.QINIU_SECRET_KEY = "test-secret";
      process.env.QINIU_BUCKET = "test-bucket";
      const { POST } = await import("../app/api/upload/route");
      const formData = new FormData();
      formData.append("file", new Blob(["test content"], { type: "text/plain" }), "test.txt");
      const req = new NextRequest("http://localhost/api/upload", {
        method: "POST",
        body: formData,
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
      delete process.env.QINIU_ACCESS_KEY;
      delete process.env.QINIU_SECRET_KEY;
      delete process.env.QINIU_BUCKET;
    });
  });

  describe("POST /api/cli — correctly requires auth (baseline)", () => {
    it("should return 401 when no Authorization header is provided", async () => {
      const { POST } = await import("../app/api/cli/route");
      const req = new NextRequest("http://localhost/api/cli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "status" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("should return 401 when Bearer token is invalid", async () => {
      const { POST } = await import("../app/api/cli/route");
      const req = new NextRequest("http://localhost/api/cli", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer fake-token-xxx",
        },
        body: JSON.stringify({ command: "status" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. SSRF via web_fetch Tool
// ═══════════════════════════════════════════════════════════════

describe("Security: SSRF Protection in web_fetch [F-006]", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    resetMockState();
    // Ensure mock tool execute is null so real web_fetch is used
    _mockToolExecute = null;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const SSRF_TARGETS = [
    { url: "http://169.254.169.254/latest/meta-data/", label: "AWS metadata endpoint" },
    { url: "http://169.254.169.254/latest/meta-data/iam/security-credentials/", label: "AWS IAM credentials" },
    { url: "http://10.0.0.1/", label: "internal 10.x network" },
    { url: "http://127.0.0.1:3000/api/settings", label: "localhost loopback" },
    { url: "http://localhost:3000/api/cli", label: "localhost via hostname" },
    { url: "http://192.168.1.1/", label: "private 192.168.x network" },
    { url: "http://172.16.0.1/", label: "private 172.16.x network" },
    { url: "http://0.0.0.0/", label: "all-zeros address" },
    { url: "http://[::1]/", label: "IPv6 loopback" },
  ];

  for (const target of SSRF_TARGETS) {
    it(`should reject SSRF attempt: ${target.label}`, async () => {
      // Mock fetch (Jina Reader) to "succeed" — the point is whether web_fetch
      // validates the URL BEFORE sending to Jina
      global.fetch = vi.fn().mockResolvedValue(
        new Response("INTERNAL DATA LEAKED", { status: 200 })
      ) as any;

      const { getTool } = await import("@/lib/agent-tools");
      const tool = getTool("web_fetch")!;
      const result = await tool.execute({ url: target.url });

      // EXPECTED after fix: error status with SSRF rejection message
      // CURRENT (vulnerable): "completed" with leaked content
      expect(result.status).toBe("error");
      if (result.status === "error") {
        expect(result.error).toMatch(/internal|private|SSRF|forbidden|blocked/i);
      }
    });
  }

  it("should allow normal public HTTPS URLs", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("Public page content", { status: 200 })
    ) as any;

    const { getTool } = await import("@/lib/agent-tools");
    const tool = getTool("web_fetch")!;
    const result = await tool.execute({ url: "https://example.com/article" });

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.data.content).toContain("Public page content");
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. Doom Loop Bypass via Semantic Equivalence
// ═══════════════════════════════════════════════════════════════

describe("Security: Doom Loop Bypass Prevention", () => {
  const noopEnqueue = vi.fn();
  const makeConfig = () => ({ baseUrl: "https://api.test.com/v1", apiKey: "sk-test", model: "test", embeddingModel: "BAAI/bge-m3", zvecEnabled: false });

  function makeCtx(recentToolCalls: Array<{ name: string; args: string }>) {
    return {
      messages: [
        { role: "system" as const, content: "system" },
        { role: "user" as const, content: "test" },
      ],
      config: makeConfig(),
      tools: [] as any[],
      recentToolCalls,
      round: 0,
    };
  }

  const makeToolCall = (name: string, args: string, id = "call_1") => ({ id, name, arguments: args });

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockState();
    _mockToolExecute = vi.fn(async () => ({ status: "completed", data: { ok: true } }));
  });

  it("should detect doom loop with same args but different key ordering [bypass attempt]", async () => {
    // 3 calls with semantically identical args but different JSON key order:
    // {"query":"test","limit":5} vs {"limit":5,"query":"test"}
    const args1 = '{"query":"test","limit":5}';
    const args2 = '{"limit":5,"query":"test"}';
    const args3 = '{"query":"test","limit":5}';

    const ctx = makeCtx([
      { name: "search_kb", args: args1 },
      { name: "search_kb", args: args2 },
    ]);

    _mockLLMSequence = [
      {
        finishReason: "tool_calls",
        content: "",
        toolCalls: [makeToolCall("search_kb", args3, "call_3")],
      },
      { finishReason: "stop", content: "Done!", toolCalls: [] },
    ];

    const { executeAgentLoop } = await import("@/lib/agent-loop");
    const result = await executeAgentLoop(ctx, noopEnqueue);

    // EXPECTED after fix: doom loop detected (semantic equivalence)
    // CURRENT: NOT detected because string comparison differs
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message).toContain("循环");
    }
  });

  it("should detect doom loop with same args but different whitespace [bypass attempt]", async () => {
    const args1 = '{"query":"test"}';
    const args2 = '{ "query" : "test" }';
    const args3 = '{"query":"test"}';

    const ctx = makeCtx([
      { name: "search_kb", args: args1 },
      { name: "search_kb", args: args2 },
    ]);

    _mockLLMSequence = [
      {
        finishReason: "tool_calls",
        content: "",
        toolCalls: [makeToolCall("search_kb", args3, "call_3")],
      },
      { finishReason: "stop", content: "Done!", toolCalls: [] },
    ];

    const { executeAgentLoop } = await import("@/lib/agent-loop");
    const result = await executeAgentLoop(ctx, noopEnqueue);

    // EXPECTED after fix: doom loop detected (semantic equivalence)
    // CURRENT: NOT detected because string comparison differs
    expect(result.type).toBe("error");
  });

  it("should NOT trigger doom loop with different case in string values [edge case]", async () => {
    // If query values differ only by case, they're semantically different
    // for most search engines — this should NOT trigger doom loop
    const args1 = '{"query":"test"}';
    const args2 = '{"query":"Test"}';
    const args3 = '{"query":"TEST"}';

    const ctx = makeCtx([
      { name: "search_kb", args: args1 },
      { name: "search_kb", args: args2 },
    ]);

    _mockLLMSequence = [
      {
        finishReason: "tool_calls",
        content: "",
        toolCalls: [makeToolCall("search_kb", args3, "call_3")],
      },
      { finishReason: "stop", content: "Done!", toolCalls: [] },
    ];

    const { executeAgentLoop } = await import("@/lib/agent-loop");
    const result = await executeAgentLoop(ctx, noopEnqueue);

    // These ARE semantically different (different search queries) — should NOT doom loop
    expect(result.type).toBe("stop");
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. safeError Edge Cases — Path-Based API Key Leakage
// ═══════════════════════════════════════════════════════════════

describe("Security: safeError Edge Cases", () => {
  it("should not leak API key in fallback for unknown status", async () => {
    const { safeError } = await import("@/lib/agent-llm");
    // Simulate a scenario where the fallback might contain URL with key in path
    const fallbackWithKey = "Request to https://api.provider.com/v1/sk-leaked-key/chat failed";
    const msg = safeError(599, fallbackWithKey);
    // For unknown status, safeError returns the fallback as-is
    // This is a potential concern: the fallback should be sanitized
    expect(msg).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
  });

  it("should not leak API key in fallback for known status codes", async () => {
    const { safeError } = await import("@/lib/agent-llm");
    for (const status of [401, 403, 404, 429, 500, 502, 503]) {
      const fallbackWithKey = `Error: Bearer sk-secret-key-12345 at https://api.siliconflow.cn/v1`;
      const msg = safeError(status, fallbackWithKey);
      expect(msg).not.toContain("sk-secret-key");
      expect(msg).not.toContain("siliconflow");
      expect(msg).not.toContain("Bearer");
    }
  });

  it("should not leak internal URL in any known error message", async () => {
    const { safeError } = await import("@/lib/agent-llm");
    for (const status of [401, 403, 404, 429, 500, 502, 503]) {
      const fallbackWithUrl = `Connection to https://internal-api.corp.local:8080/v1 failed`;
      const msg = safeError(status, fallbackWithUrl);
      expect(msg).not.toContain("internal-api");
      expect(msg).not.toContain("corp.local");
    }
  });

  it("should sanitize fallback containing both URL and key for unknown status", async () => {
    const { safeError } = await import("@/lib/agent-llm");
    const dangerous = `POST https://api.siliconflow.cn/v1/chat/completions with Bearer sk-abc123def456`;
    const msg = safeError(599, dangerous);
    // For unknown status, the fallback is returned — it should be sanitized
    expect(msg).not.toContain("siliconflow");
    expect(msg).not.toContain("sk-abc123");
    expect(msg).not.toContain("Bearer");
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. Login Brute-Force Protection
// ═══════════════════════════════════════════════════════════════

describe("Security: Login Brute-Force Protection [M2]", () => {
  function makeLoginRequest(username: string, password: string): NextRequest {
    return new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  }

  beforeEach(async () => {
    const { _resetLoginRateLimit } = await import("../app/api/auth/login/route");
    _resetLoginRateLimit();
  });

  it("should return 401 for wrong password", async () => {
    const { POST } = await import("../app/api/auth/login/route");
    const res = await POST(makeLoginRequest("admin", "wrong"));
    expect(res.status).toBe(401);
  });

  it("should return 400 for missing username", async () => {
    const { POST } = await import("../app/api/auth/login/route");
    const res = await POST(makeLoginRequest("", "kb65"));
    expect(res.status).toBe(400);
  });

  it("should return 400 for missing password", async () => {
    const { POST } = await import("../app/api/auth/login/route");
    const res = await POST(makeLoginRequest("admin", ""));
    expect(res.status).toBe(400);
  });

  it("should return 200 for correct credentials", async () => {
    const { POST } = await import("../app/api/auth/login/route");
    const res = await POST(makeLoginRequest("admin", "kb65"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.token).toBeTruthy();
  });

  it("should rate-limit after 5 failed attempts (EXPECTED after fix)", async () => {
    const { POST } = await import("../app/api/auth/login/route");

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeLoginRequest("admin", `wrong-${i}`));
      expect(res.status).toBe(401);
    }

    // 6th attempt — even with correct password — should be rate-limited
    const res = await POST(makeLoginRequest("admin", "kb65"));

    // EXPECTED after fix: 429 Too Many Requests
    // CURRENT (vulnerable): 200 OK (no rate limiting)
    expect(res.status).toBe(429);
  });

  it("should NOT lock out with correct credentials interspersed", async () => {
    const { POST } = await import("../app/api/auth/login/route");

    // Interspersed: fail, succeed, fail, succeed, fail
    await POST(makeLoginRequest("admin", "wrong"));
    await POST(makeLoginRequest("admin", "kb65"));
    await POST(makeLoginRequest("admin", "wrong"));
    await POST(makeLoginRequest("admin", "kb65"));

    // 5th attempt should not be rate-limited
    const res = await POST(makeLoginRequest("admin", "kb65"));
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. Upload File Validation (beyond auth)
// ═══════════════════════════════════════════════════════════════

describe("Security: Upload File Validation [M1]", () => {
  beforeEach(() => {
    process.env.QINIU_ACCESS_KEY = "test-key";
    process.env.QINIU_SECRET_KEY = "test-secret";
    process.env.QINIU_BUCKET = "test-bucket";
  });

  afterEach(() => {
    delete process.env.QINIU_ACCESS_KEY;
    delete process.env.QINIU_SECRET_KEY;
    delete process.env.QINIU_BUCKET;
  });

  it("should reject executable files (.exe, .sh, .bat) [EXPECTED after fix]", async () => {
    const { POST } = await import("../app/api/upload/route");
    const { createToken } = await import("@/lib/auth");
    const token = await createToken("admin");

    const formData = new FormData();
    formData.append("file", new Blob(["#!/bin/bash\nrm -rf /"], { type: "application/x-sh" }), "malicious.sh");

    const req = new NextRequest("http://localhost/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const res = await POST(req);

    // EXPECTED after fix: 400 Bad Request (file type not allowed)
    expect(res.status).toBe(400);
  });

  it("should reject files larger than 10MB [EXPECTED after fix]", async () => {
    const { POST } = await import("../app/api/upload/route");
    const { createToken } = await import("@/lib/auth");
    const token = await createToken("admin");

    // Create a >10MB file (11MB)
    const largeContent = "x".repeat(11 * 1024 * 1024);
    const formData = new FormData();
    formData.append("file", new Blob([largeContent], { type: "image/png" }), "large.png");

    const req = new NextRequest("http://localhost/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const res = await POST(req);

    // EXPECTED after fix: 413 Payload Too Large
    expect(res.status).toBe(413);
  });
});
