import { getRecords, getRecord } from "./content";
import { embedText, embedBatch, cosineSimilarity } from "./embedding";

interface VectorIndex {
  recordId: string;
  vector: number[];
  text: string;
  title: string;
  category: string;
}

let index: VectorIndex[] = [];
let initialized = false;

export async function initIndex(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const records = await getRecords();
  const texts: string[] = [];
  const items: Omit<VectorIndex, "vector">[] = [];

  for (const meta of records) {
    const record = await getRecord(meta.id);
    if (!record) continue;
    const text = `${meta.title}\n${meta.summary}\n${(record.content || "").slice(0, 2000)}`;
    texts.push(text);
    items.push({
      recordId: meta.id,
      text,
      title: meta.title,
      category: meta.category,
    });
  }

  if (texts.length === 0) return;

  const embeddings = await embedBatch(texts);
  index = items.map((item, i) => ({
    ...item,
    vector: embeddings[i]?.vector || [],
  }));
}

export async function addToIndex(recordId: string): Promise<void> {
  const record = await getRecord(recordId);
  if (!record) return;

  const text = `${record.meta.title}\n${record.meta.summary}\n${(record.content || "").slice(0, 2000)}`;
  const { vector } = await embedText(text);

  const existing = index.findIndex((i) => i.recordId === recordId);
  const entry: VectorIndex = {
    recordId,
    vector,
    text,
    title: record.meta.title,
    category: record.meta.category,
  };

  if (existing >= 0) {
    index[existing] = entry;
  } else {
    index.push(entry);
  }
}

export function removeFromIndex(recordId: string): void {
  index = index.filter((i) => i.recordId !== recordId);
}

export interface SearchResult {
  recordId: string;
  title: string;
  category: string;
  score: number;
  snippet: string;
}

export async function semanticSearch(query: string, limit = 5): Promise<SearchResult[]> {
  if (index.length === 0) await initIndex();
  if (index.length === 0) return [];

  const { vector: queryVec } = await embedText(query);
  if (queryVec.length === 0) return [];

  const scored = index
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

export async function hybridSearch(
  query: string,
  options?: { category?: string; limit?: number }
): Promise<SearchResult[]> {
  const limit = options?.limit || 5;
  const category = options?.category;

  const records = await getRecords();
  const q = query.toLowerCase();
  let keywordResults = records.filter((r) => {
    if (category && category !== "all" && r.category !== category) return false;
    return (
      r.title.toLowerCase().includes(q) ||
      r.summary.toLowerCase().includes(q)
    );
  });

  const semanticResults = await semanticSearch(query, limit * 2);

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
