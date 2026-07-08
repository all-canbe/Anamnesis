import { getRecords, getRecord } from "./content";
import { embedText, embedBatch, cosineSimilarity, setEmbeddingModel } from "./embedding";
import { getAgentConfig } from "./agent-config";
import {
  ZVecCreateAndOpen,
  ZVecCollectionSchema,
  ZVecDataType,
} from "@zvec/zvec";
import { existsSync, rmSync } from "fs";

// ─── Memory mode state ───

interface VectorIndex {
  recordId: string;
  vector: number[];
  text: string;
  title: string;
  category: string;
  userId: string;
}

let index: VectorIndex[] = [];
let initialized = false;
let indexUserId = "";

// ─── Zvec mode state ───

let useRealZvec: boolean | null = null; // null = 未确定
let zvecCollection: any = null;
let zvecUserId = "";
let zvecDim: number | null = null;

function getZvecSchema(dim: number) {
  return new ZVecCollectionSchema({
    name: "kb_vectors",
    fields: [
      { name: "title", dataType: ZVecDataType.STRING },
      { name: "category", dataType: ZVecDataType.STRING },
      { name: "text", dataType: ZVecDataType.STRING },
      { name: "user_id", dataType: ZVecDataType.STRING },
    ],
    vectors: [
      { name: "embedding", dataType: ZVecDataType.VECTOR_FP32, dimension: dim },
    ],
  });
}

/** 将 Zvec 距离分数转换为相似度（0~1，越高越相似） */
function zvecScoreToSimilarity(distance: number): number {
  return 1 / (1 + distance);
}

/** 延迟确定使用内存模式还是 Zvec 模式 */
async function resolveMode(userId?: string): Promise<boolean> {
  if (useRealZvec !== null) return useRealZvec;
  if (!userId) {
    useRealZvec = false;
    return false;
  }

  try {
    const config = await getAgentConfig(userId);
    useRealZvec = config.zvecEnabled;
    if (useRealZvec) {
      setEmbeddingModel(config.embeddingModel);
    }
  } catch {
    useRealZvec = false;
  }
  return useRealZvec;
}

/**
 * 确保 Zvec collection 已打开
 *
 * 存储规范：
 * - 路径：./zvec_data/{userId}/
 * - 该目录已加入 .gitignore，不可提交到版本库
 * - 包含 WAL 日志、索引文件、锁文件，禁止手动修改
 * - 服务重启后通过 ZVecOpen() 恢复，无需重建
 */
function ensureZvecCollection(userId: string, dim: number): any {
  if (zvecCollection && zvecUserId === userId) {
    // 维度不匹配时删除旧数据重建（用户切换 embedding 模型）
    if (zvecDim !== null && zvecDim !== dim) {
      resetZvecMode();
      const path = `./zvec_data/${userId}`;
      if (existsSync(path)) {
        rmSync(path, { recursive: true, force: true });
      }
    } else {
      return zvecCollection;
    }
  }

  const schema = getZvecSchema(dim);
  const path = `./zvec_data/${userId}`;
  zvecCollection = ZVecCreateAndOpen(path, schema);
  zvecDim = dim;
  zvecUserId = userId;
  return zvecCollection;
}

export function resetZvecMode(): void {
  useRealZvec = null;
  zvecCollection = null;
  zvecUserId = "";
  initialized = false;
  index = [];
  indexUserId = "";
}

// ─── 公共 API ───

export async function initIndex(userId?: string): Promise<void> {
  const realZvec = await resolveMode(userId);

  if (realZvec && userId) {
    // Zvec 模式：重建整个 collection
    let collection = ensureZvecCollection(userId, 0);

    // 检测现有 collection 维度是否与当前模型匹配
    try {
      const probe = collection.querySync({
        fieldName: "embedding",
        vector: new Array(zvecDim || 0).fill(0),
        topk: 1,
      });
      if (probe.length > 0 && zvecDim !== null) {
        // 集合已有数据且维度已知，跳过重建（幂等）
        return;
      }
    } catch {
      // 集合为空或维度不匹配，继续重建
      resetZvecMode();
      collection = ensureZvecCollection(userId, 0);
    }

    const records = await getRecords(userId);
    const docs: any[] = [];
    let firstDim: number | null = null;

    for (const meta of records) {
      const record = await getRecord(meta.id, userId);
      if (!record) continue;
      const text = `${meta.title}\n${meta.summary}\n${(record.content || "").slice(0, 2000)}`;
      const { vector } = await embedText(text);
      if (vector.length === 0) continue;

      // 动态确定维度
      if (firstDim === null) {
        firstDim = vector.length;
        // 如果维度与已有 collection 不匹配，删除重建
        if (zvecDim !== null && zvecDim !== firstDim) {
          resetZvecMode();
          const path = `./zvec_data/${userId}`;
          if (existsSync(path)) {
            rmSync(path, { recursive: true, force: true });
          }
          collection = ensureZvecCollection(userId, firstDim);
        }
      }

      docs.push({
        id: meta.id,
        vectors: { embedding: vector },
        fields: {
          title: meta.title,
          category: meta.category,
          text: text.slice(0, 2000),
          user_id: userId,
        },
      });
    }

    if (docs.length > 0) {
      collection.insertSync(docs);
      collection.optimizeSync();
    }
    return;
  }

  // 内存模式
  if (initialized && (!userId || indexUserId === userId)) return;
  initialized = true;
  indexUserId = userId || "";

  const records = await getRecords(userId);
  const texts: string[] = [];
  const items: Omit<VectorIndex, "vector">[] = [];

  for (const meta of records) {
    const record = await getRecord(meta.id, userId);
    if (!record) continue;
    const text = `${meta.title}\n${meta.summary}\n${(record.content || "").slice(0, 2000)}`;
    texts.push(text);
    items.push({
      recordId: meta.id,
      text,
      title: meta.title,
      category: meta.category,
      userId: userId || "",
    });
  }

  if (texts.length === 0) return;

  const embeddings = await embedBatch(texts);
  index = items.map((item, i) => ({
    ...item,
    vector: embeddings[i]?.vector || [],
  }));
}

export async function addToIndex(recordId: string, userId?: string): Promise<void> {
  const realZvec = await resolveMode(userId);

  const record = await getRecord(recordId, userId);
  if (!record) return;

  const text = `${record.meta.title}\n${record.meta.summary}\n${(record.content || "").slice(0, 2000)}`;
  const { vector } = await embedText(text);
  if (vector.length === 0) return;

  if (realZvec && userId) {
    const collection = ensureZvecCollection(userId, vector.length);
    collection.upsertSync([{
      id: recordId,
      vectors: { embedding: vector },
      fields: {
        title: record.meta.title,
        category: record.meta.category,
        text: text.slice(0, 2000),
        user_id: userId,
      },
    }]);
    return;
  }

  // 内存模式
  const existing = index.findIndex((i) => i.recordId === recordId);
  const entry: VectorIndex = {
    recordId,
    vector,
    text,
    title: record.meta.title,
    category: record.meta.category,
    userId: userId || "",
  };

  if (existing >= 0) {
    index[existing] = entry;
  } else {
    index.push(entry);
  }
}

export function removeFromIndex(recordId: string): void {
  // 内存模式
  index = index.filter((i) => i.recordId !== recordId);

  // Zvec 模式（如有活跃 collection）
  if (zvecCollection) {
    try {
      zvecCollection.deleteSync(recordId);
    } catch {
      // 忽略删除失败（可能不存在）
    }
  }
}

export interface SearchResult {
  recordId: string;
  title: string;
  category: string;
  score: number;
  snippet: string;
}

export async function semanticSearch(query: string, userId?: string, limit = 5): Promise<SearchResult[]> {
  const realZvec = await resolveMode(userId);

  if (realZvec && userId) {
    const { vector: queryVec } = await embedText(query);
    if (queryVec.length === 0) return [];

    const collection = ensureZvecCollection(userId, queryVec.length);
    const results = collection.querySync({
      fieldName: "embedding",
      vector: queryVec,
      topk: limit,
    });

    return (results || []).map((r: any) => ({
      recordId: r.id,
      title: r.fields?.title || "",
      category: r.fields?.category || "",
      score: zvecScoreToSimilarity(r.score),
      snippet: (r.fields?.text || "").slice(0, 150),
    }));
  }

  // 内存模式
  if (userId && (!initialized || indexUserId !== userId)) {
    initialized = false;
    await initIndex(userId);
  }
  if (index.length === 0) await initIndex(userId);
  if (index.length === 0) return [];

  const { vector: queryVec } = await embedText(query);
  if (queryVec.length === 0) return [];

  const scored = index
    .filter((item) => !userId || item.userId === userId)
    .map((item) => ({
      ...item,
      score: cosineSimilarity(queryVec, item.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((item) => ({
    recordId: item.recordId,
    title: item.title,
    category: item.category,
    score: item.score,
    snippet: item.text.slice(0, 150),
  }));
}

/** Find records semantically similar to a given record */
export async function findSimilar(recordId: string, userId?: string, limit = 3): Promise<SearchResult[]> {
  const realZvec = await resolveMode(userId);

  if (realZvec && userId) {
    const collection = ensureZvecCollection(userId, zvecDim || 0);

    // 获取目标记录的向量
    let targetVector: number[] | null = null;
    try {
      const fetched = collection.fetchSync(recordId);
      if (fetched && fetched[recordId]) {
        targetVector = fetched[recordId].vectors?.embedding;
      }
    } catch {
      // 记录不存在
    }

    if (!targetVector || targetVector.length === 0) return [];

    const results = collection.querySync({
      fieldName: "embedding",
      vector: targetVector,
      topk: limit + 1, // +1 以排除自身
    });

    return (results || [])
      .filter((r: any) => r.id !== recordId)
      .slice(0, limit)
      .map((r: any) => ({
        recordId: r.id,
        title: r.fields?.title || "",
        category: r.fields?.category || "",
        score: zvecScoreToSimilarity(r.score),
        snippet: (r.fields?.text || "").slice(0, 150),
      }));
  }

  // 内存模式
  if (userId && (!initialized || indexUserId !== userId)) {
    initialized = false;
    await initIndex(userId);
  }
  if (index.length === 0) await initIndex(userId);
  if (index.length === 0) return [];

  const item = index.find((i) => i.recordId === recordId);
  if (!item) return [];

  const scored = index
    .filter((i) => i.recordId !== recordId && (!userId || i.userId === userId))
    .map((i) => ({
      ...i,
      score: cosineSimilarity(item.vector, i.vector),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((i) => ({
    recordId: i.recordId,
    title: i.title,
    category: i.category,
    score: i.score,
    snippet: i.text.slice(0, 150),
  }));
}

export async function hybridSearch(
  query: string,
  options?: { category?: string; limit?: number; userId?: string }
): Promise<SearchResult[]> {
  const limit = options?.limit || 5;
  const category = options?.category;
  const userId = options?.userId;

  const records = await getRecords(userId);
  const q = query.toLowerCase();
  let keywordResults = records.filter((r) => {
    if (category && category !== "all" && r.category !== category) return false;
    return (
      r.title.toLowerCase().includes(q) ||
      r.summary.toLowerCase().includes(q)
    );
  });

  const semanticResults = await semanticSearch(query, userId, limit * 2);

  const scoreMap = new Map<string, number>();
  const K = 60;

  keywordResults.forEach((r, i) => {
    scoreMap.set(r.id, (scoreMap.get(r.id) || 0) + 1 / (K + i));
  });

  semanticResults.forEach((r, i) => {
    scoreMap.set(r.recordId, (scoreMap.get(r.recordId) || 0) + 1 / (K + i));
  });

  const fused = Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return fused.map(([id]) => {
    const meta = records.find((r) => r.id === id);
    const sem = semanticResults.find((s) => s.recordId === id);
    return {
      recordId: id,
      title: meta?.title || "",
      category: meta?.category || "",
      score: scoreMap.get(id) || 0,
      snippet: sem?.snippet || meta?.summary || "",
    };
  });
}