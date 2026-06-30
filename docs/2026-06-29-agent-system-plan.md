# 知忆 Agent 系统完整实现计划

## 一、整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                      Agent 侧边栏 (UI)                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  聊天界面 · 消息列表 · 输入框 · 会话管理                   │  │
│  │  流式输出 (SSE) · Markdown 渲染 · 来源标注                 │  │
│  └──────────────────────────┬─────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│                    Agent 调度层 (API Route)                        │
│                                                                   │
│  用户输入 → 意图识别 → 工具调用 → 结果组装 → 流式返回             │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ 意图解析  │  │ 工具调度  │  │ 上下文   │  │ LLM 调用         │  │
│  │ Classifier│  │ Router   │  │ Builder  │  │ (OpenAI/硅基流动) │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────┬────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│                       Agent 工具层 (Tools)                         │
│                                                                   │
│  ┌────────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │ 知识工具            │  │ 上传工具        │  │ 管理工具        │  │
│  │ ───────────        │  │ ──────────     │  │ ──────────     │  │
│  │ • search_kb        │  │ • search_skill  │  │ • list_records │  │
│  │ • summarize        │  │ • fetch_skill   │  │ • get_record   │  │
│  │ • recommend        │  │ • import_skill  │  │ • edit_record  │  │
│  │ • ask_kb (RAG)     │  │ • upload_folder │  │ • delete_record│  │
│  │ • similar_records  │  │                │  │                │  │
│  └────────────────────┘  └────────────────┘  └────────────────┘  │
└─────────────────────────────┬────────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────────┐
│                       数据/存储层                                  │
│                                                                   │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │ Turso (主存储)  │  │ Zvec (向量)    │  │ R2 (文件存储)      │  │
│  │ records/tags/   │  │ 语义搜索       │  │ 图片/附件          │  │
│  │ files/skills    │  │ 相似推荐       │  │ Skill 包缓存       │  │
│  │                │  │ RAG 检索       │  │                    │  │
│  └────────────────┘  └────────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 二、Skill 系统设计

### 2.1 什么是 Skill

Skill 是一个**结构化知识包**，本质是一个文件夹，包含多个 .md 文件和相关资源：

```
my-skill/
├── skill.json              ← Skill 元数据（名称、描述、版本、作者）
├── README.md               ← 技能介绍/总览
├── guide.md                ← 使用指南
├── api.md                  ← API 参考
├── examples/               ← 示例目录
│   ├── basic.md
│   └── advanced.md
└── images/                 ← 资源目录
    └── screenshot.png
```

### 2.2 Skill 数据模型

```sql
-- skills 表
CREATE TABLE skills (
  id          TEXT PRIMARY KEY,           -- skill-xxx
  name        TEXT NOT NULL,              -- 技能名称
  slug        TEXT NOT NULL UNIQUE,       -- URL 友好的标识
  description TEXT NOT NULL DEFAULT '',
  version     TEXT NOT NULL DEFAULT '1.0.0',
  author      TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT '',   -- 来源: local / web / registry
  source_url  TEXT,                       -- 来源 URL
  category    TEXT,                       -- 关联分类
  tags        TEXT NOT NULL DEFAULT '[]', -- JSON 数组
  record_ids  TEXT NOT NULL DEFAULT '[]', -- 关联的知识记录 ID 列表
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 每条 Skill 中的 .md 文件对应一条 records 记录
-- 通过 skills.record_ids 关联
```

### 2.3 Skill 来源

| 来源 | 方式 | 状态 |
|------|------|------|
| **本地上传** | 左侧面板"上传文件夹" | ✅ 已实现 |
| **Web 搜索 + 导入** | Agent 搜索网络 → 下载 → 解析 → 导入 | 🔄 待实现 |
| **Skill Registry** | 社区共享的 Skill 市场 | 📝 远期 |

### 2.4 Skill 在知识库中的存储

上传一个 Skill 文件夹时：

```
上传 my-skill/
  ↓
解析 skill.json → 创建 skills 记录
  ↓
解析每个 .md 文件 → 创建 records 记录（关联 skill_id）
  ↓
图片等资源 → 上传到 R2（待集成）
  ↓
返回 Skill 页面（展示结构化的技能文档）
```

---

## 三、MD + Zvec 双驱动集成

### 3.1 当前状态

- **MD 驱动**：✅ 已完成 — Markdown 文件存储 + frontmatter 元数据
- **Zvec 驱动**：🔲 待实现 — 向量化索引 + 语义检索

### 3.2 Zvec 集成方案

Zvec（阿里通义实验室开源嵌入式向量数据库）的集成分三层：

#### 第一层：向量索引（数据写入时同步）

```
写入 records 表
  ↓
触发 Zvec 索引更新
  ↓
将 title + summary + content 拼接 → 调用 embedding API → 存入 Zvec
```

```typescript
// src/lib/zvec.ts — 向量索引模块
interface ZvecIndex {
  record_id: string;
  embedding: number[];    // 向量
  text: string;           // 原始文本（用于检索后展示）
  metadata: {             // 元数据（用于过滤）
    title: string;
    category: string;
    date: string;
  };
}
```

#### 第二层：语义检索（查询时使用）

```typescript
// 混合搜索：关键词 + 向量
async function hybridSearch(query: string, options?: {
  category?: string;
  limit?: number;
}): Promise<SearchResult[]> {
  // 1. 关键词搜索（SQL LIKE / FTS）
  const keywordResults = await searchByKeyword(query, options);
  
  // 2. 向量语义搜索（Zvec）
  const queryEmbedding = await embedText(query);
  const semanticResults = await zvec.search(queryEmbedding, options);
  
  // 3. 结果融合（RRF 排序）
  return fuseResults(keywordResults, semanticResults);
}
```

#### 第三层：RAG 问答（Agent 使用）

```
用户提问 → 向量检索 Top-K → 组装 Prompt → LLM 生成 → 流式返回
```

### 3.3 Embedding 方案

| 方案 | 说明 | 成本 |
|------|------|------|
| **硅基流动 API** | 免费额度，兼容 OpenAI 格式 | 免费 |
| **OpenAI embeddings** | text-embedding-3-small | 低 |
| **本地模型** | BGE-small-zh (ONNX) | 零成本，需本地部署 |

**推荐**：先用硅基流动 API（免费），后续可切换。

---

## 四、Agent 工具系统

### 4.1 工具定义

每个工具是一个函数，有明确的输入/输出描述，Agent 根据意图自动调用：

```typescript
interface Tool {
  name: string;           // 工具名
  description: string;    // 工具描述（给 LLM 看）
  parameters: {           // 参数 schema
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  execute: (args: any) => Promise<any>;  // 执行函数
}
```

### 4.2 工具清单

#### 知识工具

| 工具 | 描述 | 参数 |
|------|------|------|
| `search_kb` | 搜索知识库（混合搜索） | query, category?, limit? |
| `summarize` | 总结指定记录 | record_id |
| `recommend` | 推荐相关记录 | record_id?, query?, limit? |
| `ask_kb` | RAG 问答 | question, record_ids? |
| `similar_records` | 找相似记录 | record_id, limit? |

#### 上传工具

| 工具 | 描述 | 参数 |
|------|------|------|
| `search_skill` | 搜索网上的 Skill | query, source? |
| `fetch_skill` | 下载指定 URL 的 Skill | url |
| `import_skill` | 导入 Skill 到知识库 | skill_data, name, category? |
| `upload_folder` | 上传本地文件夹 | (浏览器 API，需用户交互) |

#### 管理工具

| 工具 | 描述 | 参数 |
|------|------|------|
| `list_records` | 列出知识记录 | category?, page?, limit? |
| `get_record` | 获取记录详情 | record_id |
| `stats` | 知识库统计 | - |

### 4.3 工具调用流程

```
用户: "帮我找一下前端相关的 Skill"
  ↓
Agent 意图识别 → "search_skill"
  ↓
调用 search_skill(query="前端 skill")
  ↓
返回结果列表
  ↓
Agent 展示给用户 → "我找到了这些前端 Skill，你想导入哪个？"
  ↓
用户: "导入第三个"
  ↓
Agent 调用 fetch_skill(url) → import_skill(data)
  ↓
返回导入结果
```

### 4.4 联网搜索 Skill

Agent 搜索网上的 Skill 文件夹，流程如下：

```
用户: "帮我找一个 React 组件库的 Skill"
  ↓
Agent 调用 search_skill("React 组件库 skill")
  ↓
后端搜索策略：
  1. GitHub API 搜索仓库（关键词 + skill/README.md）
  2. 网页搜索（搜索引擎 API）
  3. Skill Registry（如果有）
  ↓
返回结果列表（名称、描述、来源、Star 数）
  ↓
用户选择 → Agent 下载 → 解析 → 导入
```

**Skill 发现来源优先级：**

| 来源 | 方式 | 优先级 |
|------|------|--------|
| GitHub | GitHub API 搜索仓库 | P0 |
| 网页 | Jina Reader / 搜索引擎 | P1 |
| 社区 Registry | 自建或第三方 | P2 |

---

## 五、Agent 对话系统

### 5.1 技术方案

```
前端 (AgentSidebar)
  │ 用户输入
  ▼
POST /api/agent/chat  { message, history }
  │
  ▼
Agent 调度层
  │ 1. 意图识别（LLM 分类）
  │ 2. 工具调用（循环：调用 → 结果 → 再调用）
  │ 3. 最终回答生成
  │
  ▼
SSE 流式返回
  │ text/event-stream
  ▼
前端逐块渲染
```

### 5.2 意图分类

Agent 收到用户消息后，先分类意图：

| 意图 | 触发词 | 动作 |
|------|--------|------|
| `search` | 搜索/找/查 | 调用 search_kb |
| `summarize` | 总结/概括/要点 | 调用 summarize |
| `recommend` | 推荐/相关/类似 | 调用 recommend |
| `ask` | 问/什么/为什么/如何 | 调用 ask_kb (RAG) |
| `find_skill` | 找 Skill/技能/插件 | 调用 search_skill |
| `import_skill` | 导入/下载 Skill | 调用 fetch_skill + import_skill |
| `manage` | 列出/统计/状态 | 调用 list_records / stats |
| `chat` | 其他/闲聊 | 直接 LLM 对话 |

### 5.3 消息格式

```typescript
interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;  // JSON
  };
}
```

### 5.4 会话管理

- 每个会话有独立 ID
- 会话历史存储在 localStorage（短期）和 Turso（长期）
- 支持多会话切换（类似 ChatGPT 的侧边栏会话列表）

---

## 六、Skill 的 Web 搜索与导入

### 6.1 搜索 Skill

```
GET /api/agent/search-skill?q=react+component
  ↓
并行搜索：
  ├── GitHub API: search/repositories?q=react+component+skill
  ├── 网页搜索: Jina Reader / 搜索引擎
  └── (可选) 本地缓存
  ↓
合并去重 → 返回 SkillListItem[]
```

### 6.2 下载 Skill

```
POST /api/agent/fetch-skill { url }
  ↓
1. 如果是 GitHub 仓库 → 下载 ZIP / 遍历文件
2. 如果是网页 → Jina Reader 抓取
  ↓
解析 skill.json（如果有）
  ↓
返回 SkillPackage { name, description, files: [{path, content}] }
```

### 6.3 导入 Skill

```
POST /api/agent/import-skill { name, files, category? }
  ↓
1. 创建 skills 记录
2. 遍历 .md 文件 → 创建 records 记录
3. 图片文件 → 上传到 R2
4. 更新索引
  ↓
返回导入结果
```

### 6.4 用户交互流程

```
用户: "帮我找一个 Vue3 的 Skill"
Agent: "找到了这些 Vue3 相关的 Skill："
       1. Vue3 组件开发指南 (GitHub ⭐234)
       2. Vue3 + TypeScript 最佳实践 (GitHub ⭐89)
       3. Vue3 企业级项目模板 (GitHub ⭐567)
       你想导入哪个？

用户: "导入第一个"
Agent: "正在下载 Vue3 组件开发指南..."
       "解析中... 发现 5 篇文档"
       "导入完成！已添加到知识库，分类：前端"
       "要现在查看吗？"
```

---

## 七、实现阶段划分

### Phase 4-1：Agent 基础框架 + Skill 系统（2 周）

| 任务 | 子任务 | 预估 |
|------|--------|------|
| **Agent 对话基础** | SSE 流式 API Route、前端消息渲染、会话管理 | 3 天 |
| **意图识别** | LLM 分类 + 工具调度循环 | 2 天 |
| **知识工具** | search_kb / summarize / recommend / ask_kb | 3 天 |
| **Skill 数据模型** | skills 表 + 上传解析增强（支持 skill.json） | 2 天 |
| **管理工具** | list_records / get_record / stats | 1 天 |

### Phase 4-2：Zvec 向量检索（1 周）

| 任务 | 子任务 | 预估 |
|------|--------|------|
| **Zvec 集成** | 安装 + 基础 CRUD 向量索引 | 2 天 |
| **混合搜索** | 关键词 + 向量融合排序 | 2 天 |
| **RAG 问答** | 检索 + Prompt 组装 + LLM 生成 | 2 天 |
| **相似推荐** | 详情页"相关文章" | 1 天 |

### Phase 4-3：Skill Web 搜索 + 导入（1 周）

| 任务 | 子任务 | 预估 |
|------|--------|------|
| **GitHub 搜索** | GitHub API 搜索 Skill 仓库 | 2 天 |
| **网页搜索** | Jina Reader 抓取 Skill 页面 | 1 天 |
| **下载解析** | 下载 ZIP / 遍历文件 → 解析 skill.json | 2 天 |
| **Agent 上传工具** | search_skill / fetch_skill / import_skill | 2 天 |

---

## 八、技术选型

| 需求 | 方案 | 理由 |
|------|------|------|
| LLM API | 硅基流动 / OpenAI | 免费额度 + 兼容格式 |
| Embedding | 硅基流动 API / BGE-small-zh | 先 API 后本地 |
| 向量数据库 | Zvec (阿里通义) | 嵌入式、Apache 2.0 |
| 流式输出 | Server-Sent Events | 原生支持 |
| 会话存储 | localStorage + Turso | 短期+长期 |
| Skill 搜索 | GitHub API + Jina Reader | 免费+可靠 |
| 文件存储 | Cloudflare R2 | 免费 10GB |

---

## 九、数据流全景图

```
用户输入 "帮我总结 RSC 这篇文章"
  ↓
AgentSidebar → POST /api/agent/chat
  ↓
Agent 调度层：
  1. 意图识别 → "summarize"
  2. 调用工具 summarize({ record_id: "k1" })
  3. 工具执行：
     a. Turso 查询 records 表 → 获取 content
     b. (可选) Zvec 检索相关段落
     c. 组装 Prompt
     d. 调用 LLM → 生成总结
  4. SSE 流式返回
  ↓
前端逐块渲染 Markdown
  ↓
用户看到总结

---

用户输入 "找一个 React Skill"
  ↓
Agent 调度层：
  1. 意图识别 → "find_skill"
  2. 调用工具 search_skill({ query: "React" })
  3. 工具执行：
     a. GitHub API 搜索仓库
     b. 返回结果列表
  4. Agent 展示结果
  ↓
用户: "导入第一个"
  ↓
Agent 调用 fetch_skill → import_skill
  ↓
下载 → 解析 → 写入 Turso + Zvec 索引
  ↓
导入完成
```

---

## 十、变更记录

| 日期 | 版本 | 内容 |
|------|------|------|
| 2026-06-29 | v1.0 | 初始 Agent 系统实现计划 |
