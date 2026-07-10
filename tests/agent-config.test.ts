/**
 * Agent Config Tests
 *
 * Tests getAgentConfig, saveAgentConfig, hasAgentConfig, maskKey.
 * Mocks: turso (getSetting, setSetting), crypto (encrypt, decrypt, isEncryptionConfigured).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks for dependencies ───

const mockGetSetting = vi.fn();
const mockSetSetting = vi.fn();

vi.mock("@/lib/turso", () => ({
  getSetting: mockGetSetting,
  setSetting: mockSetSetting,
}));

const mockEncrypt = vi.fn();
const mockDecrypt = vi.fn();
const mockIsEncryptionConfigured = vi.fn(() => false);

vi.mock("@/lib/crypto", () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
  isEncryptionConfigured: mockIsEncryptionConfigured,
}));

const TEST_USER = "admin";

// ─── Tests ───

describe("agent-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEncryptionConfigured.mockReturnValue(false);
    mockGetSetting.mockResolvedValue(null);
    mockSetSetting.mockResolvedValue(undefined);
    mockEncrypt.mockImplementation((s: string) => `enc_${s}`);
    mockDecrypt.mockImplementation((s: string) => s.replace("enc:", "").replace("enc_", ""));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getAgentConfig", () => {
    it("should return config from DB when available", async () => {
      mockGetSetting.mockImplementation((key: string, userId?: string) => {
        // getSetting already adds userId prefix internally, just check the key
        if (key === "agent_baseUrl") return "https://api.example.com/v1";
        if (key === "agent_apiKey") return "sk-test-key";
        if (key === "agent_model") return "test-model";
        if (key === "embedding_model") return "BAAI/bge-m3";
        if (key === "zvec_enabled") return "false";
        return null;
      });

      const { getAgentConfig } = await import("@/lib/agent-config");
      const cfg = await getAgentConfig(TEST_USER);

      expect(cfg.baseUrl).toBe("https://api.example.com/v1");
      expect(cfg.apiKey).toBe("sk-test-key");
      expect(cfg.model).toBe("test-model");
    });

    it("should return defaults when nothing is configured", async () => {
      const { getAgentConfig } = await import("@/lib/agent-config");
      const cfg = await getAgentConfig(TEST_USER);

      expect(cfg.baseUrl).toBe("https://api.siliconflow.cn/v1");
      expect(cfg.apiKey).toBe("");
      expect(cfg.model).toBe("Qwen/Qwen2.5-7B-Instruct");
    });

    it("should use default model when DB has no model", async () => {
      mockGetSetting.mockImplementation((key: string, userId?: string) => {
        // getSetting already adds userId prefix internally
        if (key === "agent_baseUrl") return "https://custom.api/v1";
        if (key === "agent_apiKey") return "sk-custom";
        return null;
      });

      const { getAgentConfig } = await import("@/lib/agent-config");
      const cfg = await getAgentConfig(TEST_USER);

      expect(cfg.model).toBe("Qwen/Qwen2.5-7B-Instruct");
    });

    it("should return empty apiKey when DB has no key", async () => {
      mockGetSetting.mockImplementation((key: string, userId?: string) => {
        // getSetting already adds userId prefix internally
        if (key === "agent_baseUrl") return "https://custom.api/v1";
        return null;
      });

      const { getAgentConfig } = await import("@/lib/agent-config");
      const cfg = await getAgentConfig(TEST_USER);

      expect(cfg.apiKey).toBe("");
    });
  });

  describe("saveAgentConfig", () => {
    it("should save to DB for user", async () => {
      mockSetSetting.mockResolvedValue(undefined);

      const { saveAgentConfig } = await import("@/lib/agent-config");
      await saveAgentConfig({
        baseUrl: "https://api.test.com/v1",
        apiKey: "sk-save-test",
        model: "save-model",
        embeddingBaseUrl: "https://api.test.com/v1",
        embeddingApiKey: "",
        embeddingModel: "BAAI/bge-m3",
        zvecEnabled: false,
      }, TEST_USER);

      expect(mockSetSetting).toHaveBeenCalledWith("agent_baseUrl", "https://api.test.com/v1", TEST_USER);
      expect(mockSetSetting).toHaveBeenCalledWith("agent_model", "save-model", TEST_USER);
    });

    it("should skip apiKey when skipKey is true", async () => {
      mockSetSetting.mockResolvedValue(undefined);

      const { saveAgentConfig } = await import("@/lib/agent-config");
      await saveAgentConfig(
        { baseUrl: "https://api.test.com/v1", apiKey: "sk-secret", model: "m", embeddingBaseUrl: "https://api.test.com/v1", embeddingApiKey: "", embeddingModel: "BAAI/bge-m3", zvecEnabled: false },
        TEST_USER,
        true,
      );

      const apiKeyCalls = mockSetSetting.mock.calls.filter((c: any[]) => c[0] === "agent_apiKey");
      expect(apiKeyCalls).toHaveLength(0);
    });

    it("should throw when DB fails", async () => {
      mockSetSetting.mockRejectedValue(new Error("DB write error"));

      const { saveAgentConfig } = await import("@/lib/agent-config");
      await expect(saveAgentConfig({
        baseUrl: "https://fallback.test.com/v1",
        apiKey: "sk-fallback",
        model: "fallback-model",
        embeddingBaseUrl: "https://fallback.test.com/v1",
        embeddingApiKey: "",
        embeddingModel: "BAAI/bge-m3",
        zvecEnabled: false,
      }, TEST_USER)).rejects.toThrow("DB write error");
    });

    it("should encrypt apiKey when encryption is configured", async () => {
      mockIsEncryptionConfigured.mockReturnValue(true);
      mockEncrypt.mockReturnValue("encrypted_value_hex");
      mockSetSetting.mockResolvedValue(undefined);

      const { saveAgentConfig } = await import("@/lib/agent-config");
      await saveAgentConfig({
        baseUrl: "https://api.test.com/v1",
        apiKey: "sk-secret-key",
        model: "m",
        embeddingBaseUrl: "https://api.test.com/v1",
        embeddingApiKey: "",
        embeddingModel: "BAAI/bge-m3",
        zvecEnabled: false,
      }, TEST_USER);

      const apiKeyCall = mockSetSetting.mock.calls.find((c: any[]) => c[0] === "agent_apiKey");
      expect(apiKeyCall).toBeDefined();
      if (apiKeyCall) {
        expect(apiKeyCall[1]).toContain("enc:");
        expect(apiKeyCall[1]).toContain("encrypted_value_hex");
      }
    });
  });

  describe("hasAgentConfig", () => {
    it("should return configured: true when DB has key", async () => {
      mockGetSetting.mockImplementation((key: string, userId?: string) => {
        // getSetting already adds userId prefix internally
        if (key === "agent_baseUrl") return "https://api.example.com/v1";
        if (key === "agent_apiKey") return "sk-test-key-1234567890";
        if (key === "agent_model") return "test-model";
        if (key === "embedding_model") return "BAAI/bge-m3";
        if (key === "zvec_enabled") return "false";
        return null;
      });

      const { hasAgentConfig } = await import("@/lib/agent-config");
      const result = await hasAgentConfig(TEST_USER);

      expect(result.configured).toBe(true);
      expect(result.keyPreview).toBeDefined();
      expect(result.keyPreview).toContain("****");
    });

    it("should return configured: false when no key is set", async () => {
      const { hasAgentConfig } = await import("@/lib/agent-config");
      const result = await hasAgentConfig(TEST_USER);

      expect(result.configured).toBe(false);
      expect(result.keyPreview).toBeUndefined();
    });

    it("should mask short keys (<=8 chars) correctly", async () => {
      mockGetSetting.mockImplementation((key: string, userId?: string) => {
        // getSetting already adds userId prefix internally
        if (key === "agent_baseUrl") return "https://api.example.com/v1";
        if (key === "agent_apiKey") return "ab123456";
        return null;
      });

      const { hasAgentConfig } = await import("@/lib/agent-config");
      const result = await hasAgentConfig(TEST_USER);

      expect(result.keyPreview).toBe("ab****56");
    });

    it("should mask long keys (>8 chars) correctly", async () => {
      mockGetSetting.mockImplementation((key: string, userId?: string) => {
        // getSetting already adds userId prefix internally
        if (key === "agent_baseUrl") return "https://api.example.com/v1";
        if (key === "agent_apiKey") return "sk-abcdefghijklmnop";
        return null;
      });

      const { hasAgentConfig } = await import("@/lib/agent-config");
      const result = await hasAgentConfig(TEST_USER);

      expect(result.keyPreview).toBe("sk-a****mnop");
    });

    it("should return empty keyPreview when apiKey is empty", async () => {
      mockGetSetting.mockImplementation((key: string, userId?: string) => {
        // getSetting already adds userId prefix internally
        if (key === "agent_baseUrl") return "https://api.example.com/v1";
        if (key === "agent_apiKey") return "";
        return null;
      });

      const { hasAgentConfig } = await import("@/lib/agent-config");
      const result = await hasAgentConfig(TEST_USER);

      expect(result.configured).toBe(false);
      expect(result.keyPreview).toBeUndefined();
    });
  });
});