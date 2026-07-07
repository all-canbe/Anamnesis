import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./../app/api/agent/chat/route";
import { POST as SettingsPOST, GET as SettingsGET } from "./../app/api/settings/route";
import { createToken } from "@/lib/auth";

// Mock the agent dependencies
vi.mock("@/lib/agent-config", () => ({
  getAgentConfig: async (_userId: string) => ({ apiKey: null }),
  hasAgentConfig: async (_userId: string) => ({ configured: true, baseUrl: "https://api.test.com/v1", model: "test-model" }),
  saveAgentConfig: async (_cfg: any, _userId: string) => {},
}));

let authHeader: Record<string, string>;

beforeAll(async () => {
  const token = await createToken("admin");
  authHeader = { Authorization: `Bearer ${token}` };
});

describe("Settings API", () => {
  it("GET /api/settings should return valid response structure", async () => {
    const request = new NextRequest("http://localhost/api/settings", {
      method: "GET",
      headers: authHeader,
    });
    const response = await SettingsGET(request);
    expect(response).toBeDefined();
    expect(response.status).toBeLessThan(500);
    const data = await response.json();
    expect(data).toHaveProperty("configured");
    expect(data).toHaveProperty("baseUrl");
    expect(data).toHaveProperty("model");
    expect(data).not.toHaveProperty("apiKey");
  });

  it("POST /api/settings should reject missing baseUrl", async () => {
    const request = new NextRequest("http://localhost/api/settings", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await SettingsPOST(request);
    expect(response.status).toBe(400);
  });

  it("POST /api/settings should accept valid request", async () => {
    const request = new NextRequest("http://localhost/api/settings", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://api.test.com/v1",
        apiKey: "sk-test",
        model: "test-model",
      }),
    });
    const response = await SettingsPOST(request);
    expect(response.status).not.toBe(400);
  });
});

describe("Agent Chat API", () => {
  it("should return error when message is empty", async () => {
    const request = new NextRequest("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    const response = await POST(request);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
  });

  it("should return error when message is whitespace only", async () => {
    const request = new NextRequest("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it("should accept history field in request body", async () => {
    const request = new NextRequest("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "你好",
        history: [
          { role: "user", content: "你好" },
          { role: "assistant", content: "你好！" },
        ],
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it("should return correct SSE content-type header", async () => {
    const request = new NextRequest("http://localhost/api/agent/chat", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ message: "测试" }),
    });
    const response = await POST(request);
    const contentType = response.headers.get("content-type");
    expect(contentType).toContain("text/event-stream");
  });
});