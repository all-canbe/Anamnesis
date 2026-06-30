# 知忆 — 现阶段完成情况与前端展示完善计划

## 一、项目概述

**知忆**（原名 mykb）是一个个人知识记录系统，采用 **MD + Zvec 双驱动架构**：
- **MD 驱动**：Markdown 文件存储，Git 版本控制
- **Zvec 驱动**：阿里通义实验室开源的嵌入式向量数据库，语义检索
- **Turso 主存储**：SQLite 兼容的 serverless 数据库（规划中）
- **CLI + Web 双通道**：终端命令行 + Web 浏览器

---

## 二、已完成功能清单

### Phase 1 — Web 基础（✅ 完成）

| 功能 | 文件 | 说明 |
|------|------|------|
| Records 列表 | [page.tsx](file:///e:/skills_test/mykb/app/page.tsx) | 分类筛选 + 分页 + 滚动动效 |
| 记录详情页 | [records/[id]/page.tsx](file:///e:/skills_test/mykb/app/records/%5Bid%5D/page.tsx) | MD/HTML 渲染 + 上下篇导航 |
| 编排页 | [records-client.tsx](file:///e:/skills_test/mykb/app/records-client.tsx) | CRUD + Markdown 编辑器 + 格式切换 |
| Tags 管理 | [api/tags/route.ts](file:///e:/skills_test/mykb/app/api/tags/route.ts) | 预设 6 分类 + 自定义标签 |
| 中英文双语 | [language-context.tsx](file:///e:/skills_test/mykb/src/lib/language-context.tsx) | React Context 运行时切换 |
| 内容存储 | [content.ts](file:///e:/skills_test/mykb/src/lib/content.ts) | 本地 fs + GitHub API 双模式 |
| GitHub 桥接 | [github-api.ts](file:///e:/skills_test/mykb/src/lib/github-api.ts) | Vercel 部署后远程写入 |
| 14 篇示例记录 | [content/](file:///e:/skills_test/mykb/content/) | 覆盖 6 个分类 |

### Phase 2 — CLI 工具 + 设置页（✅ 完成）

| 功能 | 文件 | 说明 |
|------|------|------|
| CLI 命令行 | [kb-cli/](file:///e:/skills_test/kb-cli/) | 全局 npm 包，6 个命令 |
| 设置页 | [settings/page.tsx](file:///e:/skills_test/mykb/app/settings/page.tsx) | Turso/sqld 服务器地址切换 |
| API 层 | [api/cli/route.ts](file:///e:/skills_test/mykb/app/api/cli/route.ts) | RESTful + token 认证 |

### Phase 3-2 — 三栏布局（✅ 完成）

| 功能 | 文件 | 说明 |
|------|------|------|
| Shell 容器 | [shell.tsx](file:///e:/skills_test/mykb/app/shell.tsx) | 三栏布局状态管理 |
| 左侧面板 | [left-panel.tsx](file:///e:/skills_test/mykb/app/left-panel.tsx) | 文件树 + 视图切换 + 搜索 + 上传入口 |
| 右侧 Agent 面板 | [agent-sidebar.tsx](file:///e:/skills_test/mykb/app/agent-sidebar.tsx) | 固定 300px，可折叠 |
| 视图模式 | globals.css | 列表/网格/紧凑三种模式 |

### Phase 3-3 — 上传文件夹（✅ 完成）

| 功能 | 文件 | 说明 |
|------|------|------|
| 上传对话框 | [upload-folder-dialog.tsx](file:///e:/skills_test/mykb/app/upload-folder-dialog.tsx) | 4 步状态机：选择→预览→上传→完成 |
| 文件夹解析 | upload-folder-dialog.tsx | 自动识别分类、标题清洗、摘要生成 |
| skill.json 支持 | upload-folder-dialog.tsx | 自动检测 Skill 元数据 |

### Phase 4-1 — Agent 基础框架（✅ 完成）

| 功能 | 文件 | 说明 |
|------|------|------|
| 联网搜索 | [web-search.ts](file:///e:/skills_test/mykb/src/lib/web-search.ts) | Jina Reader + GitHub API 聚合搜索 |
| 工具层 | [agent-tools.ts](file:///e:/skills_test/mykb/src/lib/agent-tools.ts) | 8 个工具：search_kb / get_record / summarize / stats / search_skill / fetch_skill / import_skill / ask_kb |
| SSE API | [api/agent/chat/route.ts](file:///e:/skills_test/mykb/app/api/agent/chat/route.ts) | 意图识别 → 工具调度 → LLM 流式生成 |
| 聊天界面 | [agent-sidebar.tsx](file:///e:/skills_test/mykb/app/agent-sidebar.tsx) | SSE 流式渲染 + 消息气泡 |
| 会话管理 | [chat-store.ts](file:///e:/skills_test/mykb/src/lib/chat-store.ts) | 多会话 + localStorage 持久化 + 四级上下文压缩 |

### Phase 4-2 — Zvec 向量检索（✅ 完成）

| 功能 | 文件 | 说明 |
|------|------|------|
| Embedding API | [embedding.ts](file:///e:/skills_test/mykb/src/lib/embedding.ts) | 硅基流动 API + 本地 hash 降级 |
| 向量索引 | [zvec.ts](file:///e:/skills_test/mykb/src/lib/zvec.ts) | 索引管理 + 语义搜索 + 混合搜索 |
| RRF 融合 | zvec.ts | 关键词 + 向量 RRF 排序融合 |
| RAG 问答 | agent-tools.ts → ask_kb | 语义检索 Top-3 → LLM 生成 |

### Phase 4-3 — Skill 搜索导入（✅ 完成）

| 功能 | 文件 | 说明 |
|------|------|------|
| Skill 导入器 | [skill-importer.ts](file:///e:/skills_test/mykb/src/lib/skill-importer.ts) | GitHub 下载 + 解析 + 导入 |
| fetch_skill 工具 | agent-tools.ts | 预览 GitHub 仓库 Skill 内容 |
| import_skill 工具 | agent-tools.ts | 下载并导入 Skill 到知识库 |

### 上下文压缩（✅ 完成）

| 功能 | 文件 | 说明 |
|------|------|------|
| CompactionConfig | [chat-store.ts](file:///e:/skills_test/mykb/src/lib/chat-store.ts) | 12 项可调参数 |
| CompactionPipeline | chat-store.ts | 四级压缩决策 + 执行 |
| SummaryChain | chat-store.ts | 累积摘要链，自动裁剪 |
| 热尾保护 | chat-store.ts | 最近 3 条工具结果保留完整 |

---

## 三、待完善的前端展示功能

### P3-4 现有功能展示完善（优先级 P0）

#### 3.4.1 首页 Records 列表增强

| 子任务 | 说明 | 涉及文件 |
|--------|------|---------|
| 搜索框 | 标题/摘要/内容全文搜索 + Zvec 语义搜索 | page.tsx, records-client.tsx |
| 排序选项 | 按日期/标题/分类排序 | records-client.tsx |
| 记录统计 | 总记录数、各分类数量展示 | records-client.tsx |
| 空状态优化 | 无记录时的引导页面 | records-client.tsx |

#### 3.4.2 详情页增强

| 子任务 | 说明 | 涉及文件 |
|--------|------|---------|
| 编辑入口 | 从详情页跳转到编排页 | records/[id]/client.tsx |
| 复制链接 | 一键复制当前记录 URL | records/[id]/client.tsx |
| 阅读进度 | 滚动时显示阅读进度指示器 | records/[id]/client.tsx |
| 代码复制 | 代码块右上角复制按钮 | records/[id]/client.tsx |
| 目录导航 | 基于标题层级的大纲 | records/[id]/client.tsx |
| 相似推荐 | 底部显示 Zvec 相关文章 | records/[id]/client.tsx |

#### 3.4.3 编排页增强

| 子任务 | 说明 | 涉及文件 |
|--------|------|---------|
| 图片上传 | 编辑器内上传图片（R2） | records-client.tsx |
| 草稿保存 | localStorage 自动保存 | records-client.tsx |
| 批量操作 | 批量删除、批量改分类 | records-client.tsx |

#### 3.4.4 Tags 页面增强

| 子任务 | 说明 | 涉及文件 |
|--------|------|---------|
| 标签筛选 | 点击标签筛选对应记录 | records-client.tsx |
| 标签统计 | 各标签下记录数 | records-client.tsx |
| 颜色自定义 | 标签颜色选择器 | records-client.tsx |

#### 3.4.5 全局 UI 完善

| 子任务 | 说明 | 涉及文件 |
|--------|------|---------|
| 暗色模式 | CSS 变量 + 切换按钮 | globals.css, shell.tsx |
| 响应式优化 | 平板/手机适配 | globals.css |
| 骨架屏 | 页面加载占位 | records-client.tsx |
| 键盘快捷键 | Ctrl+K 搜索、Escape 关闭等 | shell.tsx |

### P3-5 远程文章数据添加（优先级 P0）

| 子任务 | 说明 |
|--------|------|
| URL 导入 | 输入 URL 自动抓取文章（Jina Reader） |
| 平台导入 | 公众号/知乎/RSS 订阅 |
| 批量导入 | Markdown 文件批量上传 |
| 导入预览 | 导入前预览和编辑 |

### P4-1 Agent 前端增强（优先级 P1）

| 子任务 | 说明 |
|--------|------|
| Markdown 渲染 | Agent 回答支持代码块/表格/图片 |
| 来源标注 | 引用知识库记录时显示来源卡片 |
| 流式打字机效果 | 逐字输出动画 |
| 会话重命名 | 手动修改会话标题 |
| 消息复制 | 复制单条消息内容 |
| 清除对话 | 一键清空当前会话 |

### P5 架构升级与生态（优先级 P2）

| 子任务 | 说明 |
|--------|------|
| Turso 存储迁移 | 从 GitHub API 桥接迁移到 Turso 直连 |
| R2 文件上传 | 图片/附件上传到 Cloudflare R2 |
| 用户系统 | 多用户支持 |
| 浏览器扩展 | 剪藏插件 |
| VS Code 插件 | 编辑器中管理知识库 |
| PWA | 移动端适配 |

---

## 四、当前架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户交互层                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Web 浏览器   │  │  终端 CLI    │  │  AI Agent 侧边栏          │  │
│  │  (Next.js)   │  │  (kb 命令)   │  │  (SSE 流式 + 8 工具)      │  │
│  │  + 设置页 ⚙  │  │  直连 Turso  │  │  + 四级上下文压缩          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘  │
└─────────┼──────────────────┼─────────────────────┼──────────────────┘
          │                  │                     │
┌─────────▼──────────────────▼─────────────────────▼──────────────────┐
│                        服务层                                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Next.js App Router (Server Components + Server Actions)        │ │
│  │  · Records 列表 (分类+分页+语义搜索)   · 详情页 (渲染+相似推荐)   │ │
│  │  · 编排页 (CRUD+编辑器+上传文件夹)      · Tags 管理               │ │
│  │  · 中英文切换                          · Agent 调度              │ │
│  └──────────────────────┬──────────────────────────────────────────┘ │
└─────────────────────────┼────────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────────┐
│                    存储 + 工具层                                       │
│  ┌────────────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │ 内容存储 (fs/GitHub)│  │ Zvec (向量)    │  │ Agent 工具          │  │
│  │ content/*.md       │  │ 语义搜索       │  │ search_kb / ask_kb  │  │
│  │ content/index.json │  │ 混合搜索       │  │ search_skill / ...  │  │
│  │ tags.json          │  │ RAG 问答       │  │ web-search / import │  │
│  └────────────────────┘  └────────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 五、文件清单

### src/lib/ — 核心库（12 个文件）

| 文件 | 行数 | 职责 |
|------|------|------|
| [chat-store.ts](file:///e:/skills_test/mykb/src/lib/chat-store.ts) | ~415 | 会话管理 + 四级上下文压缩 |
| [agent-tools.ts](file:///e:/skills_test/mykb/src/lib/agent-tools.ts) | ~175 | Agent 工具层（8 个工具） |
| [skill-importer.ts](file:///e:/skills_test/mykb/src/lib/skill-importer.ts) | ~140 | Skill 下载/解析/导入 |
| [zvec.ts](file:///e:/skills_test/mykb/src/lib/zvec.ts) | ~120 | 向量索引 + 混合搜索 |
| [embedding.ts](file:///e:/skills_test/mykb/src/lib/embedding.ts) | ~95 | Embedding API |
| [web-search.ts](file:///e:/skills_test/mykb/src/lib/web-search.ts) | ~75 | 联网搜索 |
| [content.ts](file:///e:/skills_test/mykb/src/lib/content.ts) | ~190 | 内容 CRUD |
| [auth.ts](file:///e:/skills_test/mykb/src/lib/auth.ts) | ~30 | Token 认证 |
| [github-api.ts](file:///e:/skills_test/mykb/src/lib/github-api.ts) | ~120 | GitHub API 桥接 |
| [types.ts](file:///e:/skills_test/mykb/src/lib/types.ts) | ~30 | 类型定义 |
| [md-to-html.ts](file:///e:/skills_test/mykb/src/lib/md-to-html.ts) | ~30 | Markdown 转 HTML |
| [language-context.tsx](file:///e:/skills_test/mykb/src/lib/language-context.tsx) | ~145 | 中英文双语 |

### app/ — 页面组件（13 个文件）

| 文件 | 职责 |
|------|------|
| [shell.tsx](file:///e:/skills_test/mykb/app/shell.tsx) | 三栏布局容器 |
| [left-panel.tsx](file:///e:/skills_test/mykb/app/left-panel.tsx) | 左侧面板 |
| [agent-sidebar.tsx](file:///e:/skills_test/mykb/app/agent-sidebar.tsx) | Agent 聊天界面 |
| [upload-folder-dialog.tsx](file:///e:/skills_test/mykb/app/upload-folder-dialog.tsx) | 上传文件夹对话框 |
| [page.tsx](file:///e:/skills_test/mykb/app/page.tsx) | 首页 Records 列表 |
| [records-client.tsx](file:///e:/skills_test/mykb/app/records-client.tsx) | 列表客户端组件 |
| [records/[id]/page.tsx](file:///e:/skills_test/mykb/app/records/%5Bid%5D/page.tsx) | 详情页 |
| [records/[id]/client.tsx](file:///e:/skills_test/mykb/app/records/%5Bid%5D/client.tsx) | 详情客户端组件 |
| [settings/page.tsx](file:///e:/skills_test/mykb/app/settings/page.tsx) | 设置页 |
| [globals.css](file:///e:/skills_test/mykb/app/globals.css) | 全局样式 |

### app/api/ — API 路由（5 个文件）

| 文件 | 职责 |
|------|------|
| [api/agent/chat/route.ts](file:///e:/skills_test/mykb/app/api/agent/chat/route.ts) | Agent SSE 流式 API |
| [api/cli/route.ts](file:///e:/skills_test/mykb/app/api/cli/route.ts) | CLI 命令 API |
| [api/auth/login/route.ts](file:///e:/skills_test/mykb/app/api/auth/login/route.ts) | 登录认证 |
| [api/tags/route.ts](file:///e:/skills_test/mykb/app/api/tags/route.ts) | Tags CRUD |
| [api/record-counts/route.ts](file:///e:/skills_test/mykb/app/api/record-counts/route.ts) | 记录统计 |

---

## 六、环境变量

```
LLM_API_KEY=your_key                    # Agent LLM + Embedding 共用
LLM_BASE_URL=https://api.siliconflow.cn/v1  # 可选，默认硅基流动
LLM_MODEL=Qwen/Qwen2.5-7B-Instruct         # 可选
EMBEDDING_MODEL=BAAI/bge-m3                # 可选
```

---

## 七、变更记录

| 日期 | 版本 | 内容 |
|------|------|------|
| 2026-06-29 | v1.0 | 初始项目搭建 |
| 2026-06-29 | v1.1 | CLI 工具 + GitHub 桥接 |
| 2026-06-29 | v1.2 | 三栏布局 + 上传文件夹 |
| 2026-06-29 | v1.3 | Agent 基础框架 + Zvec 向量检索 + Skill 导入 + 上下文压缩 |
