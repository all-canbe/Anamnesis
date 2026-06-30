import { getRecords, getRecord } from "./content";
import { searchSkills } from "./web-search";
import { hybridSearch, semanticSearch, initIndex } from "./zvec";
import { fetchSkillFromGitHub, importSkill } from "./skill-importer";

export interface ToolParam {
  type: string;
  properties: Record<string, { type: string; description: string }>;
  required: string[];
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParam;
  execute: (args: Record<string, any>) => Promise<any>;
}

export const tools: Tool[] = [
  {
    name: "search_kb",
    description: "Search knowledge base records using hybrid search (keyword + vector semantic)",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keyword or natural language query" },
        category: { type: "string", description: "Filter by category: frontend/backend/ai/reading/devops/design" },
        limit: { type: "number", description: "Max results (default 5)" },
      },
      required: [],
    },
    async execute(args) {
      const { query = "", category, limit = 5 } = args;
      if (!query) {
        let records = await getRecords();
        if (category && category !== "all") {
          records = records.filter((r) => r.category === category);
        }
        return records.slice(0, limit).map((r) => ({
          id: r.id, title: r.title, date: r.date,
          category: r.category, summary: r.summary,
        }));
      }
      const results = await hybridSearch(query, { category, limit });
      return results.map((r) => ({
        id: r.recordId, title: r.title,
        category: r.category, score: r.score,
        summary: r.snippet,
      }));
    },
  },
  {
    name: "get_record",
    description: "Get full content of a knowledge record by ID",
    parameters: {
      type: "object",
      properties: {
        record_id: { type: "string", description: "Record ID like k1, k2" },
      },
      required: ["record_id"],
    },
    async execute(args) {
      const record = await getRecord(args.record_id);
      if (!record) return { error: `Record '${args.record_id}' not found` };
      return {
        id: record.meta.id,
        title: record.meta.title,
        date: record.meta.date,
        category: record.meta.category,
        summary: record.meta.summary,
        content: record.content.slice(0, 3000),
      };
    },
  },
  {
    name: "summarize",
    description: "Summarize a knowledge record",
    parameters: {
      type: "object",
      properties: {
        record_id: { type: "string", description: "Record ID to summarize" },
      },
      required: ["record_id"],
    },
    async execute(args) {
      const record = await getRecord(args.record_id);
      if (!record) return { error: `Record '${args.record_id}' not found` };
      const text = record.content.replace(/[#*`>\[\]]/g, "").trim();
      const sentences = text.split(/[。！？\n]+/).filter(Boolean);
      const summary = sentences.slice(0, 5).join("。") + "。";
      return {
        id: record.meta.id,
        title: record.meta.title,
        summary: summary.slice(0, 500),
        wordCount: text.length,
      };
    },
  },
  {
    name: "stats",
    description: "Get knowledge base statistics",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    async execute() {
      const records = await getRecords();
      const categories: Record<string, number> = {};
      records.forEach((r) => {
        categories[r.category] = (categories[r.category] || 0) + 1;
      });
      return {
        total: records.length,
        categories,
        latest: records.slice(0, 5).map((r) => ({ id: r.id, title: r.title, date: r.date })),
      };
    },
  },
  {
    name: "search_skill",
    description: "Search for skills/tutorials/guides on the web and GitHub",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "What skill to search for" },
        limit: { type: "number", description: "Max results (default 5)" },
      },
      required: ["query"],
    },
    async execute(args) {
      return searchSkills(args.query, args.limit || 5);
    },
  },
  {
    name: "ask_kb",
    description: "Answer a question using RAG: search knowledge base semantically then answer",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "The question to answer" },
      },
      required: ["question"],
    },
    async execute(args) {
      const { question } = args;
      const results = await semanticSearch(question, 3);
      if (results.length === 0) return { answer: "No relevant knowledge found.", sources: [] };

      const sources = [];
      for (const r of results) {
        const record = await getRecord(r.recordId);
        sources.push({
          id: r.recordId,
          title: r.title,
          content: record?.content?.slice(0, 1000) || "",
          score: r.score,
        });
      }

      const context = sources.map((s) => `[${s.id}] ${s.title}\n${s.content}`).join("\n\n---\n\n");

      return {
        context,
        sources: sources.map((s) => ({ id: s.id, title: s.title, score: s.score })),
      };
    },
  },
  {
    name: "fetch_skill",
    description: "Download a skill/tutorial from a GitHub repository URL",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "GitHub repository URL" },
      },
      required: ["url"],
    },
    async execute(args) {
      const skill = await fetchSkillFromGitHub(args.url);
      return {
        name: skill.name,
        description: skill.description,
        version: skill.version,
        author: skill.author,
        category: skill.category,
        fileCount: skill.files.length,
        imageCount: skill.images.length,
        files: skill.files.map((f) => f.path),
      };
    },
  },
  {
    name: "import_skill",
    description: "Import a downloaded skill package into the knowledge base",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "GitHub repository URL to import" },
        category: { type: "string", description: "Override category: frontend/backend/ai/reading/devops/design" },
      },
      required: ["url"],
    },
    async execute(args) {
      const skill = await fetchSkillFromGitHub(args.url);
      if (args.category) skill.category = args.category;
      const result = await importSkill(skill);
      return {
        name: skill.name,
        description: skill.description,
        ok: result.ok,
        recordCount: result.recordIds.length,
        recordIds: result.recordIds,
        errors: result.errors,
      };
    },
  },
];

export function getTool(name: string): Tool | undefined {
  return tools.find((t) => t.name === name);
}

export async function initAgent(): Promise<void> {
  await initIndex();
}
