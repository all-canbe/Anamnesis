import { getSetting, setSetting } from "./turso";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { encrypt, decrypt, isEncryptionConfigured } from "./crypto";

export interface AgentConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  embeddingBaseUrl: string;
  embeddingApiKey: string;
  embeddingModel: string;
  zvecEnabled: boolean;
}

const DEFAULT_BASE_URL = "https://api.siliconflow.cn/v1";
const DEFAULT_MODEL = "Qwen/Qwen2.5-7B-Instruct";
const DEFAULT_EMBEDDING_MODEL = "BAAI/bge-m3";
const DEFAULT_EMBEDDING_BASE_URL = DEFAULT_BASE_URL;
const DEFAULT_EMBEDDING_API_KEY = "";
const ENC_PREFIX = "enc:";

/** 对 API Key 加密存储，未配置 ENCRYPTION_KEY 时明文存储 */
function packApiKey(plaintext: string): string {
  if (!plaintext) return "";
  if (isEncryptionConfigured()) {
    return ENC_PREFIX + encrypt(plaintext);
  }
  return plaintext;
}

/** 对 API Key 解密读取，兼容旧版明文数据 */
function unpackApiKey(stored: string | null): string {
  if (!stored) return "";
  if (stored.startsWith(ENC_PREFIX)) {
    return decrypt(stored.slice(ENC_PREFIX.length)) ?? "";
  }
  // 旧版明文数据，直接返回
  return stored;
}

/** .env.local 文件路径 */
function envLocalPath(): string {
  return resolve(process.cwd(), ".env.local");
}

/** 写入 .env.local：替换或追加 LLM_* 变量。
 *  可作为 DB 不可用时的回退存储，也可在明确要求时直接写入。
 *  守卫：禁止写入空值。
 */
export function writeEnvLocal(cfg: AgentConfig, skipKey = false): void {
  // 守卫：禁止写入空值
  if (!cfg.baseUrl || !cfg.model) {
    console.warn("[agent-config] 跳过写入 .env.local：baseUrl 或 model 为空");
    return;
  }

  const filePath = envLocalPath();
  let content = "";
  if (existsSync(filePath)) {
    content = readFileSync(filePath, "utf-8");
  }

  const replacements: [RegExp, string][] = [];

  if (cfg.baseUrl) {
    replacements.push([/^LLM_BASE_URL=.*$/m, `LLM_BASE_URL=${cfg.baseUrl}`]);
  }
  if (cfg.model) {
    replacements.push([/^LLM_MODEL=.*$/m, `LLM_MODEL=${cfg.model}`]);
  }
  if (!skipKey && cfg.apiKey) {
    // 加密后写入 .env.local
    const packed = packApiKey(cfg.apiKey);
    replacements.push([/^LLM_API_KEY=.*$/m, `LLM_API_KEY=${packed}`]);
  }

  if (replacements.length === 0) return;

  for (const [regex, replacement] of replacements) {
    if (regex.test(content)) {
      content = content.replace(regex, replacement);
    } else {
      content = content.trimEnd() + "\n" + replacement;
    }
  }

  writeFileSync(filePath, content.trimEnd() + "\n", "utf-8");
}

/** 从 DB 读取用户配置（仅在服务端调用） */
export async function getAgentConfig(userId: string): Promise<AgentConfig> {
  const dbBaseUrl = await getSetting("agent_baseUrl", userId);
  const dbApiKey = await getSetting("agent_apiKey", userId);
  const dbModel = await getSetting("agent_model", userId);
  const dbEmbeddingBaseUrl = await getSetting("embedding_baseUrl", userId);
  const dbEmbeddingApiKey = await getSetting("embedding_apiKey", userId);
  const dbEmbeddingModel = await getSetting("embedding_model", userId);
  const dbZvecEnabled = await getSetting("zvec_enabled", userId);
  if (dbApiKey && dbBaseUrl) {
    return {
      baseUrl: dbBaseUrl,
      apiKey: unpackApiKey(dbApiKey),
      model: dbModel || DEFAULT_MODEL,
      embeddingBaseUrl: dbEmbeddingBaseUrl || DEFAULT_EMBEDDING_BASE_URL,
      embeddingApiKey: dbEmbeddingApiKey ? unpackApiKey(dbEmbeddingApiKey) : "",
      embeddingModel: dbEmbeddingModel || DEFAULT_EMBEDDING_MODEL,
      zvecEnabled: dbZvecEnabled === "true",
    };
  }
  // 无 DB 配置时返回默认值
  return {
    baseUrl: DEFAULT_BASE_URL,
    apiKey: "",
    model: DEFAULT_MODEL,
    embeddingBaseUrl: DEFAULT_EMBEDDING_BASE_URL,
    embeddingApiKey: DEFAULT_EMBEDDING_API_KEY,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    zvecEnabled: false,
  };
}

/** 保存配置到 DB（用户隔离）。
 *  API Key 加密存储。
 */
export async function saveAgentConfig(
  cfg: AgentConfig,
  userId: string,
  skipKey = false,
): Promise<void> {
  await setSetting("agent_baseUrl", cfg.baseUrl, userId);
  if (!skipKey && cfg.apiKey) {
    await setSetting("agent_apiKey", packApiKey(cfg.apiKey), userId);
  }
  await setSetting("agent_model", cfg.model, userId);
  await setSetting("embedding_baseUrl", cfg.embeddingBaseUrl || DEFAULT_EMBEDDING_BASE_URL, userId);
  if (cfg.embeddingApiKey) {
    await setSetting("embedding_apiKey", packApiKey(cfg.embeddingApiKey), userId);
  }
  await setSetting("embedding_model", cfg.embeddingModel || DEFAULT_EMBEDDING_MODEL, userId);
  await setSetting("zvec_enabled", cfg.zvecEnabled ? "true" : "false", userId);
}

/** 检查是否已配置（不返回完整 Key，只返回预览，供前端调用） */
export async function hasAgentConfig(userId: string): Promise<{
  configured: boolean;
  baseUrl: string;
  model: string;
  keyPreview?: string;
  embeddingBaseUrl?: string;
  embeddingModel?: string;
  embeddingApiKeyPreview?: string;
  zvecEnabled?: boolean;
}> {
  const dbApiKey = await getSetting("agent_apiKey", userId);
  const dbBaseUrl = await getSetting("agent_baseUrl", userId);
  const dbModel = await getSetting("agent_model", userId);
  const dbEmbeddingBaseUrl = await getSetting("embedding_baseUrl", userId);
  const dbEmbeddingApiKey = await getSetting("embedding_apiKey", userId);
  const dbEmbeddingModel = await getSetting("embedding_model", userId);
  const dbZvecEnabled = await getSetting("zvec_enabled", userId);
  if (dbApiKey && dbBaseUrl) {
    const apiKey = unpackApiKey(dbApiKey);
    const embeddingApiKey = dbEmbeddingApiKey ? unpackApiKey(dbEmbeddingApiKey) : "";
    return {
      configured: !!apiKey,
      baseUrl: dbBaseUrl,
      model: dbModel || DEFAULT_MODEL,
      keyPreview: apiKey ? maskKey(apiKey) : undefined,
      embeddingBaseUrl: dbEmbeddingBaseUrl || DEFAULT_EMBEDDING_BASE_URL,
      embeddingModel: dbEmbeddingModel || DEFAULT_EMBEDDING_MODEL,
      embeddingApiKeyPreview: embeddingApiKey ? maskKey(embeddingApiKey) : undefined,
      zvecEnabled: dbZvecEnabled === "true",
    };
  }
  return {
    configured: false,
    baseUrl: dbBaseUrl || DEFAULT_BASE_URL,
    model: dbModel || DEFAULT_MODEL,
    embeddingBaseUrl: dbEmbeddingBaseUrl || DEFAULT_EMBEDDING_BASE_URL,
    embeddingModel: dbEmbeddingModel || DEFAULT_EMBEDDING_MODEL,
    embeddingApiKeyPreview: undefined,
    zvecEnabled: dbZvecEnabled === "true",
  };
}

/** 对 Key 做脱敏：前4位+后4位，中间用*代替 */
function maskKey(key: string): string {
  if (key.length <= 8) return key.slice(0, 2) + "****" + key.slice(-2);
  return key.slice(0, 4) + "****" + key.slice(-4);
}