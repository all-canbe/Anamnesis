# mykb 下一阶段完善计划

## 现状总览

mykb 目前是一个功能完整的个人知识记录系统，核心能力已覆盖：

- **Web 端**：知识列表（分类+分页）、详情页（MD/HTML 渲染）、编排页（CRUD+编辑器）、Tags 管理
- **CLI 端**：全局 npm 包 `kb`，6 个命令覆盖发布/列表/编辑/删除/状态/初始化
- **存储层**：本地 fs + GitHub API 双模式，部署到 Vercel 后可远程写入
- **API 层**：RESTful API + token 认证，支持远程 CLI 操作
- **国际化**：中英文运行时切换

---

## 当前架构问题诊断

### 问题 1：CLI 远程模式不稳定（3 跳链）

当前 CLI 远程模式路径：
```
CLI (kb) → Vercel API (mykb) → GitHub API → Vercel 重新部署
```

三个主要问题：
- **3 跳延迟**：每次 CLI 操作都要经过 Vercel serverless（有冷启动）→ GitHub API（有速率限制）→ 等待 Vercel 重新部署（1-2 分钟）
- **GitHub API 速率限制**：未认证 60 次/小时，认证后 5000 次/小时，但每次写操作需要 3-4 次 API 调用（查 SHA、写文件、更新 index、触发 redeploy）
- **无离线能力**：CLI 远程模式完全依赖网络，网络不稳定时操作失败

### 问题 2：Vercel 无持久化文件存储

- Vercel serverless 环境文件系统只读
- 当前所有写操作必须通过 GitHub API 桥接
- 无法上传图片/附件等二进制文件
- 编排页面的编辑器也无法嵌入图片

### 问题 3：数据一致性风险

- GitHub API 写操作不是事务性的（写 .md 文件成功但写 index.json 可能失败）
- 多个并发写操作可能导致数据冲突
- 没有数据校验层

---

## 核心架构升级：SQLite (Turso) 主存储 + GitHub 备份

### 新架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLI (kb)                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  本地模式: better-sqlite3 (嵌入式 SQLite，直接读写本地 DB)    │ │
│  │  远程模式: Turso HTTP API (直连，不再经过 Vercel 中转)       │ │
│  │  文件上传: Uploadthing / GitHub raw (直传，不经过应用层)      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      Web App (Vercel)                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Turso LibSQL Client (HTTP 协议，serverless 环境可用)        │ │
│  │  · 读写直连 Turso，毫秒级响应                                 │ │
│  │  · 不再依赖 GitHub API 做写操作                               │ │
│  │  · 文件上传使用 Uploadthing / GitHub raw URL                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        存储层                                      │
│  ┌──────────────────────────────┐  ┌──────────────────────────┐  │
│  │  Turso (主存储)               │  │  GitHub (备份/版本控制)   │  │
│  │  ──────────────────────      │  │  ────────────────────    │  │
│  │  SQLite 兼容，HTTP 协议       │  │  · 定时/手动同步到仓库    │  │
│  │  · records 表 (知识记录)      │  │  · 导出为 .md 文件       │  │
│  │  · tags 表 (标签)             │  │  · Git 版本历史保留       │  │
│  │  · files 表 (文件/附件)       │  │  · 文件托管 (raw CDN)    │  │
│  │  · zvec_vectors (向量索引)    │  │  · 可回滚到任意版本       │  │
│  │  · 事务支持，数据一致性        │  │                          │  │
│  └──────────────────────────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 为什么选择 Turso

Turso 是 SQLite 的 serverless 分支（LibSQL），专为边缘计算设计：

| 特性 | 说明 |
|------|------|
| **SQLite 兼容** | 完全兼容 SQLite API，本地开发用 better-sqlite3，部署用 Turso |
| **HTTP 协议** | 通过 HTTP API 访问，Vercel serverless 零障碍 |
| **边缘部署** | 全球 35+ 节点，低延迟 |
| **免费额度** | 9GB 存储，1B 请求/月，足够个人使用 |
| **嵌入式可用** | CLI 可以直接用 Turso HTTP SDK，无需中间服务 |
| **事务支持** | 完整 ACID 事务，数据一致性有保障 |

### 数据模型设计

```sql
-- 知识记录表
CREATE TABLE records (
  id          TEXT PRIMARY KEY,          -- k1, k2, ...
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  date        TEXT NOT NULL,             -- YYYY-MM-DD
  category    TEXT NOT NULL,             -- frontend/backend/ai/reading/devops/design
  summary     TEXT NOT NULL DEFAULT '',
  format      TEXT NOT NULL DEFAULT 'md', -- md/html
  content     TEXT NOT NULL,             -- 正文内容
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 标签表
CREATE TABLE tags (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '📌'
);

-- 文件/附件表
CREATE TABLE files (
  id          TEXT PRIMARY KEY,
  record_id   TEXT REFERENCES records(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size        INTEGER NOT NULL,
  url         TEXT NOT NULL,             -- 存储 URL (Uploadthing / GitHub raw)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Zvec 向量索引（后续集成）
-- 向量存储在 Zvec 嵌入式数据库中，通过 record_id 关联
```

### CLI 远程模式新路径

**旧路径（不稳定）：**
```
kb publish → Vercel API → GitHub API (3-4 calls) → Vercel redeploy (1-2min)
```

**新路径（稳定）：**
```
kb publish → Turso HTTP API (1 call) → 即时生效
```

- 不再经过 Vercel serverless
- 不再调用 GitHub API
- 不再等待重新部署
- 单次 HTTP 请求，毫秒级响应

### GitHub 备份机制

Turso 作为主存储，GitHub 作为备份和版本控制层：

```
Turso (主) ──→ 定时/手动同步 ──→ GitHub 仓库
                                    ├── content/*.md (导出为 Markdown)
                                    ├── content/index.json (索引快照)
                                    └── files/ (附件备份)
```

同步方式：
1. **手动触发**：Web 页面上的"同步到 GitHub"按钮
2. **定时同步**：通过 GitHub Actions 定时从 Turso 拉取数据
3. **CLI 命令**：`kb sync` 将当前数据库导出到 GitHub

---

## 一、近期完善（Phase 3）

### 1. 存储层迁移：从 GitHub API 到 Turso

#### 1.1 Turso 基础集成
- [ ] 注册 Turso 账号，创建数据库
- [ ] 安装 `@libsql/client` (Web 端) 和 `better-sqlite3` (CLI 本地)
- [ ] 创建数据模型（records/tags/files 表）
- [ ] 编写数据访问层 `src/lib/db.ts`（统一读写接口）
- [ ] 本地开发用 better-sqlite3，部署用 Turso HTTP

#### 1.2 CLI 远程模式改造
- [ ] CLI 端集成 `@libsql/client` 或 Turso HTTP API
- [ ] 远程模式直连 Turso，不再经过 Vercel API
- [ ] 保留 `kb login` 但改为配置 Turso 数据库 URL + token
- [ ] 所有命令（publish/list/edit/delete/status）改用 Turso 直连

#### 1.3 Web 端改造
- [ ] 替换 `src/lib/content.ts` 中的 fs/GitHub API 为 Turso 客户端
- [ ] Server Components 改为从 Turso 读取数据
- [ ] Server Actions 改为写入 Turso
- [ ] 编排页（CRUD）操作即时生效，不再等待 redeploy

#### 1.4 GitHub 备份同步
- [ ] 实现 `src/lib/github-sync.ts`：将 Turso 数据导出为 .md 文件提交到 GitHub
- [ ] Web 页面添加"同步到 GitHub"按钮
- [ ] CLI 添加 `kb sync` 命令
- [ ] 同步时保留 frontmatter 格式，与现有 .md 文件兼容

### 2. 三栏布局重构

当前布局为单栏（header + main + footer），重构为三栏布局：

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo | [≡] | Nav | Lang | ⚙                       │
├──────────┬──────────────────────────┬──────────────────────┤
│  Left    │     Main Content         │   Agent Sidebar      │
│  Panel   │     (Records/Detail/     │   (固定右侧)          │
│  (隐藏)  │      Orchestration)      │                      │
│          │                          │   • 聊天对话          │
│  • 文件树 │                          │   • 知识问答          │
│  • 文件夹 │                          │   • 总结/推荐         │
│    上传   │                          │   • 可折叠/展开       │
│  • 视图   │                          │                      │
│    切换   │                          │                      │
│  • 快速   │                          │                      │
│    筛选   │                          │                      │
└──────────┴──────────────────────────┴──────────────────────┘
```

#### 2.1 左侧隐藏面板
- [ ] 默认隐藏，点击 Header 中的 ≡ 按钮滑出
- [ ] 支持三种宽度模式：窄（48px 图标栏）/ 中（220px 文件树）/ 关闭
- [ ] 面板内容：

**文件树视图：**
- [ ] 按文件夹/分类组织文件树（skills/notes/articles/reading 等）
- [ ] 点击文件夹筛选对应分类的记录
- [ ] 展开/折叠子目录
- [ ] 文件图标 + 文件名 + 更新时间

**视图切换器：**
- [ ] 列表视图（当前默认，卡片+缩略图）
- [ ] 网格视图（卡片网格，适合浏览）
- [ ] 紧凑视图（纯文本列表，适合大量记录）
- [ ] 视图状态持久化（localStorage）

**快速筛选：**
- [ ] 按日期范围筛选
- [ ] 按格式筛选（MD / HTML）
- [ ] 按标签筛选
- [ ] 搜索框（关键词 + Zvec 语义搜索）

#### 2.2 上传文件夹功能
- [ ] 左侧面板"上传文件夹"按钮
- [ ] 支持选择本地文件夹（通过 `<input webkitdirectory>`）
- [ ] 自动解析文件夹结构：
  - 文件夹名 → 分类/标签
  - 每个 .md 文件 → 一条知识记录
  - 文件名 → 标题（去掉序号前缀）
  - 文件内容 → 正文
- [ ] 上传前预览（显示将导入的文件列表）
- [ ] 上传进度条
- [ ] 上传结果反馈（成功/失败/冲突）

**典型场景：上传个人 Skill**
```
个人技能文件夹/
├── README.md          → 技能介绍记录
├── 安装指南.md         → 安装教程
├── API 参考.md         → API 文档
├── examples/
│   ├── basic.md       → 基础示例
│   └── advanced.md    → 高级示例
└── images/
    └── screenshot.png → 自动关联到对应记录
```

#### 2.3 编辑器文件上传
- [ ] 编排页编辑器添加图片上传按钮
- [ ] 支持拖拽上传
- [ ] 上传后自动插入 Markdown 图片语法 `![alt](url)`
- [ ] 文件管理页面（查看已上传文件列表）

#### 2.4 附件管理
- [ ] 文件列表页面（`/files`）
- [ ] 文件与知识记录关联
- [ ] 文件删除（同时删除存储服务上的文件）

### 3. 现有功能展示完善

#### 3.1 首页 Records 列表增强
- [ ] 添加搜索框（标题/摘要/内容全文搜索 + Zvec 语义搜索）
- [ ] 列表视图/网格视图切换（与左侧面板视图切换器联动）
- [ ] 排序选项（按日期/标题/分类）
- [ ] 记录数量统计展示

#### 3.2 详情页增强
- [ ] 添加"编辑"入口（跳转到编排页对应记录）
- [ ] 添加"复制链接"按钮
- [ ] 添加阅读进度指示器
- [ ] 代码块添加复制按钮
- [ ] 添加目录/大纲导航（基于标题层级）
- [ ] 添加 Zvec 相似推荐（底部显示"相关文章"）

#### 3.3 编排页增强
- [ ] 编辑器添加图片上传/嵌入功能
- [ ] 添加草稿自动保存（localStorage）
- [ ] 添加历史版本记录
- [ ] 批量操作（批量删除、批量修改分类）

#### 3.4 Tags 页面增强
- [ ] 点击标签筛选对应记录
- [ ] 标签统计（各标签下记录数）
- [ ] 标签颜色自定义

#### 3.5 全局 UI 完善
- [ ] 暗色模式切换
- [ ] 响应式优化（平板/手机适配）
- [ ] 页面加载骨架屏
- [ ] 键盘快捷键支持

### 4. 远程添加文章数据

#### 4.1 URL 导入
- [ ] 输入 URL 自动抓取文章标题、正文、作者
- [ ] 支持 Jina Reader / 网页抓取解析
- [ ] 自动生成摘要和分类建议
- [ ] 导入前预览和编辑

#### 4.2 平台内容导入
- [ ] 微信公众号文章导入（通过链接）
- [ ] 知乎文章/回答导入
- [ ] 技术博客 RSS 订阅导入
- [ ] 导入后自动归类到对应分类

#### 4.3 批量导入
- [ ] 支持 Markdown 文件批量上传
- [ ] 支持剪藏插件（浏览器扩展）
- [ ] 支持从 Pocket/Instapaper 等工具导入

### 5. Zvec 向量检索集成

#### 5.1 基础集成
- [ ] 安装 Zvec Node.js binding
- [ ] 创建向量索引模块（`src/lib/zvec.ts`）
- [ ] 知识记录写入时自动生成向量索引
- [ ] 知识记录删除时同步移除向量索引

#### 5.2 语义搜索
- [ ] 搜索框支持语义搜索（输入自然语言，返回语义相关结果）
- [ ] 混合搜索（关键词 + 向量，结果融合排序）
- [ ] 搜索高亮（关键词高亮 + 语义匹配段落高亮）

#### 5.3 相似推荐
- [ ] 详情页底部"相关文章"推荐（基于向量相似度）
- [ ] 首页"你可能感兴趣"推荐模块
- [ ] 知识图谱关联可视化（基于向量聚类）

#### 5.4 RAG 问答
- [ ] 基于知识库的问答接口
- [ ] 答案引用来源标注
- [ ] 多轮对话上下文保持

---

## 二、核心功能开发（Phase 4）

### 6. 右侧 AI Agent 侧边栏（固定面板）

这是 mykb 从"记录工具"升级为"知识助手"的关键功能。右侧面板固定显示，与左侧隐藏面板形成对称布局。

#### 6.1 侧边栏基础框架
- [ ] 固定右侧面板（默认展开，可折叠为窄条）
- [ ] 可拖拽调整宽度（280px ~ 480px）
- [ ] 聊天式交互界面
- [ ] 会话历史管理（按日期分组）
- [ ] 最小化/展开/固定模式
- [ ] 与左侧面板联动（左侧打开时中间内容自适应缩窄）

#### 6.2 Agent 核心能力

**知识管理助手：**
- [ ] 当前文章自动摘要（调用 LLM + Zvec 上下文检索）
- [ ] 关联知识推荐（基于 Zvec 向量相似度）
- [ ] 知识库问答（RAG：Zvec 检索 + LLM 生成）
- [ ] 内容分类建议（新建记录时自动推荐分类）

**知识产出助手：**
- [ ] 从多篇记录生成综合报告
- [ ] 根据笔记生成博客文章草稿
- [ ] 知识卡片生成（可导出为图片）
- [ ] 周报/月报自动生成

**知识探索助手：**
- [ ] 知识图谱探索（基于 Zvec 向量聚类的关联关系）
- [ ] 主题聚类分析
- [ ] 知识盲区发现（基于已有内容推荐学习方向）
- [ ] 趋势分析（哪些主题在增长）

**知识总结助手：**
- [ ] 定期自动生成知识回顾
- [ ] 跨记录主题提炼
- [ ] 学习路径规划
- [ ] 间隔复习提醒

#### 6.3 Agent 技术方案

- **前端**：Next.js Client Component + Server-Sent Events 流式输出
- **后端**：Next.js API Route 作为 Agent 调度层
- **LLM 接入**：支持 OpenAI / Anthropic / 硅基流动
- **RAG 集成**：Zvec 向量检索 + LLM 生成
- **Skill 集成**：可调用 TRAE Skill（如 agent-reach 进行联网搜索）

#### 6.4 Agent 交互流程

```
用户提问/下达指令
  → Agent 解析意图（管理/产出/探索/总结）
  → Zvec 检索相关知识库内容（向量相似度匹配）
  → 组装上下文 + Prompt
  → 调用 LLM 生成回答
  → 流式返回结果到侧边栏
  → 用户可追问/细化/导出结果
```

---

## 三、架构优化（Phase 5）

### 7. 技术架构升级

- [ ] 全文搜索增强（Zvec 内置全文检索 / Meilisearch）
- [ ] 用户系统（多用户支持）
- [ ] API 版本化
- [ ] 性能优化（缓存、懒加载、图片优化）

### 8. 生态建设

- [ ] 浏览器剪藏扩展
- [ ] VS Code 插件（在编辑器中管理知识库）
- [ ] 移动端适配 / PWA
- [ ] 知识库导出（JSON/Markdown/PDF）
- [ ] Webhook 集成（自动化工作流）

---

## 四、优先级与时间线

| 阶段 | 内容 | 优先级 | 预估周期 |
|------|------|--------|----------|
| P3-1 | **存储层迁移（Turso + 文件上传）** | **P0** | **1-2 周** |
| P3-2 | **三栏布局重构（左侧面板 + 右侧 Agent 框架）** | **P0** | **1-2 周** |
| P3-3 | **上传文件夹功能（个人 Skill 等）** | **P0** | **1 周** |
| P3-4 | 现有功能展示完善（搜索、UI增强） | P0 | 1-2 周 |
| P3-5 | 远程文章数据添加（URL导入） | P0 | 1 周 |
| P3-6 | Zvec 向量检索集成（语义搜索 + 相似推荐） | P0 | 1-2 周 |
| P4-1 | Agent 知识管理/总结能力 | P1 | 2 周 |
| P4-2 | Agent 知识产出/探索能力 | P1 | 2 周 |
| P5 | 架构升级与生态建设 | P2 | 长期 |

---

## 五、技术选型建议

| 需求 | 推荐方案 | 理由 |
|------|----------|------|
| **主数据库** | **Turso (LibSQL)** | SQLite 兼容、HTTP 协议、serverless 友好、免费额度充足 |
| 本地数据库 | better-sqlite3 | 与 Turso 同源，本地开发无缝切换 |
| 向量检索 | Zvec (阿里通义) | 嵌入式、Apache 2.0、多语言 |
| 文件存储 | Uploadthing | 免费 2GB、Vercel 原生、TypeScript SDK |
| 版本备份 | GitHub API | 保留 Git 历史，与现有生态兼容 |
| LLM API | OpenAI / Anthropic / 硅基流动 | 灵活切换 |
| 流式输出 | Server-Sent Events | 原生支持、简单可靠 |
| 知识图谱 | D3.js / vis-network | 可视化探索 |

---

## 六、迁移计划

### 从当前架构迁移到 Turso 的步骤

```
Step 1: 创建 Turso 数据库 + 建表
Step 2: 编写 db.ts 数据访问层（统一接口）
Step 3: 将现有 content/*.md 数据导入 Turso
Step 4: Web 端改用 Turso 读写（替换 fs/GitHub API）
Step 5: CLI 端集成 Turso 直连（替换 Vercel API 中转）
Step 6: 实现 GitHub 备份同步
Step 7: 添加文件上传功能
Step 8: 下线旧的 GitHub API 桥接代码
```

### 向后兼容

- 迁移期间，旧的 GitHub API 桥接代码保留
- 通过环境变量 `TURSO_DB_URL` / `TURSO_AUTH_TOKEN` 控制是否启用新存储
- 未配置 Turso 时自动降级为现有模式（本地 fs / GitHub API）

---

## 七、变更记录

| 日期 | 版本 | 内容 |
|------|------|------|
| 2026-06-29 | v1.0 | 初始规划文档 |
| 2026-06-29 | v1.1 | 新增 MD + Zvec 双驱动架构设计 |
| 2026-06-29 | v1.2 | **架构重构**：Turso 主存储替代 GitHub API 桥接，新增文件上传方案 |
| 2026-06-29 | v1.3 | **三栏布局**：左侧隐藏面板（文件树+视图切换+上传文件夹）+ 右侧固定 Agent 侧边栏 |
