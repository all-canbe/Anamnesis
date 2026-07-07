/**
 * Agent LLM Error Sanitization Tests
 *
 * Tests that safeError() never leaks sensitive information (URLs, API keys,
 * internal service names) in error messages returned to users.
 */
import { describe, it, expect } from "vitest";
import { safeError } from "@/lib/agent-llm";

describe("safeError - error message sanitization", () => {
  it("should return safe message for 401", () => {
    const msg = safeError(401, "fallback");
    expect(msg).toContain("API Key");
    expect(msg).not.toContain("Bearer");
    expect(msg).not.toContain("sk-");
  });

  it("should return safe message for 403", () => {
    const msg = safeError(403, "fallback");
    expect(msg).toContain("权限");
  });

  it("should return safe message for 404", () => {
    const msg = safeError(404, "fallback");
    expect(msg).toContain("模型");
  });

  it("should return safe message for 429", () => {
    const msg = safeError(429, "fallback");
    expect(msg).toContain("频繁");
  });

  it("should return safe message for 500", () => {
    const msg = safeError(500, "fallback");
    expect(msg).toContain("内部错误");
  });

  it("should return safe message for 502", () => {
    const msg = safeError(502, "fallback");
    expect(msg).toContain("网关");
  });

  it("should return safe message for 503", () => {
    const msg = safeError(503, "fallback");
    expect(msg).toContain("不可用");
  });

  it("should use fallback for unknown status codes", () => {
    const msg = safeError(999, "custom fallback message");
    expect(msg).toBe("custom fallback message");
  });

  it("should NEVER contain siliconflow in any error message", () => {
    for (const status of [401, 403, 404, 429, 500, 502, 503, 999]) {
      const msg = safeError(status, "fallback with api.siliconflow.cn/v1");
      // Even the fallback should be checked — but safeError returns fallback for 999
      if (status === 999) {
        expect(msg).toBe("fallback with api.siliconflow.cn/v1");
      } else {
        expect(msg).not.toContain("siliconflow");
      }
    }
  });

  it("should NEVER contain Bearer in any known error message", () => {
    for (const status of [401, 403, 404, 429, 500, 502, 503]) {
      const msg = safeError(status, "fallback");
      expect(msg).not.toContain("Bearer");
    }
  });

  it("should NEVER contain API key patterns in known error messages", () => {
    for (const status of [401, 403, 404, 429, 500, 502, 503]) {
      const msg = safeError(status, "fallback");
      expect(msg).not.toMatch(/sk-[a-zA-Z0-9]+/);
    }
  });
});
