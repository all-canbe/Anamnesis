const EMBEDDING_API = (process.env.LLM_BASE_URL || "https://api.siliconflow.cn/v1").replace(/\/+$/, "");
let _embeddingModel = process.env.EMBEDDING_MODEL || "BAAI/bge-m3";
let _apiKey = process.env.LLM_API_KEY || "";
let _embeddingBaseUrl = process.env.LLM_BASE_URL || "https://api.siliconflow.cn/v1";

/** 运行时设置 embedding 基础 URL（如从 agent config 读取） */
export function setEmbeddingBaseUrl(url: string): void {
  if (url) _embeddingBaseUrl = url.replace(/\/+$/, "");
}

/** 运行时设置 embedding 模型（如从 agent config 读取） */
export function setEmbeddingModel(model: string): void {
  if (model) _embeddingModel = model;
}

/** 运行时设置 API Key（如从 agent config 读取） */
export function setApiKey(key: string): void {
  if (key !== undefined) _apiKey = key;
}

/** 获取当前 embedding 基础 URL */
export function getEmbeddingBaseUrl(): string {
  return _embeddingBaseUrl;
}

/** 获取当前 embedding 模型 */
export function getEmbeddingModel(): string {
  return _embeddingModel;
}

/** 获取当前 API Key */
export function getApiKey(): string {
  return _apiKey;
}

export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
}

export async function embedText(text: string): Promise<EmbeddingResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return simpleEmbed(text);
  }

  try {
    const res = await fetch(`${getEmbeddingBaseUrl()}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getEmbeddingModel(),
        input: text.slice(0, 8000),
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      const vector = data.data?.[0]?.embedding;
      if (vector) {
        return { vector, dimensions: vector.length };
      }
    }
  } catch {}

  return simpleEmbed(text);
}

export async function embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
  const apiKey = getApiKey();
  if (!apiKey || texts.length === 0) {
    return texts.map((t) => simpleEmbed(t));
  }

  try {
    const res = await fetch(`${getEmbeddingBaseUrl()}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getEmbeddingModel(),
        input: texts.map((t) => t.slice(0, 8000)),
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const data = await res.json();
      return (data.data || []).map((item: any) => ({
        vector: item.embedding,
        dimensions: item.embedding.length,
      }));
    }
  } catch {}

  return texts.map((t) => simpleEmbed(t));
}

function simpleEmbed(text: string): EmbeddingResult {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const dim = 128;
  const vector = new Array(dim).fill(0);

  for (let i = 0; i < words.length; i++) {
    const hash = simpleHash(words[i]);
    for (let j = 0; j < 4; j++) {
      const idx = Math.abs(hash + j * 31) % dim;
      vector[idx] += 1.0 / words.length;
    }
  }

  const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  if (mag > 0) {
    for (let i = 0; i < dim; i++) vector[i] /= mag;
  }

  return { vector, dimensions: dim };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
