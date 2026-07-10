# Phase 5 功能开发变更总结

## P3-1: Turso 主存储迁移

### 修改了什么
- `src/lib/content.ts`: `generateId()` 从同步静态计数器改为异步动态计算，从现有记录中读取最大 ID 后递增
- `app/api/cli/route.ts`: 删除所有 GitHub 冗余代码（`writeRecordGitHub`、`deleteRecordGitHub`、`buildFrontmatter`、`buildIndex`、`getContentDir`、`relPath`、`nextId`），删除 `fs`/`path`/`github-api` 导入，所有命令直接使用 `content.ts` 函数
- `actions.ts`: `generateId()` 调用添加 `await`
- `src/lib/skill-importer.ts`: `generateId()` 调用添加 `await`
- `src/lib/article-importer.ts`: `generateId()` 调用添加 `await`

### 为何这样修改
原有的 `content.ts` 已实现 Turso 优先 + 文件系统降级 + GitHub 降级的三层存储策略。但 `cli/route.ts` 重复实现了大量 GitHub 操作逻辑，与 `content.ts` 职责重叠。现在统一由 `content.ts` 管理所有存储层，`cli/route.ts` 只负责请求路由和参数解析。

### 变更的意义
- 存储层职责统一到 `content.ts`，消除代码重复
- `generateId` 改为动态计算，避免重启后 ID 冲突
- CLI 路由代码量减少约 60 行

## P3-2: 编排页增强

### 修改了什么
- `app/records-client.tsx`:
  - 图片上传：工具栏添加图片上传按钮，点击选文件 → 上传到 `/api/upload` → 显示 `![alt](url)` 格式可复制
  - 草稿自动保存：可折叠的草稿编辑器，每 30 秒自动保存到 localStorage，页面加载时恢复
  - 批量操作：记录卡片添加复选框，支持全选/取消全选，批量删除和批量修改分类

### 为何这样修改
编排页是记录管理的主要入口，增加图片上传、草稿和批量操作可提升日常使用效率。图片上传结果直接展示 Markdown 格式，方便粘贴到编辑器。草稿自动保存防止意外丢失。批量操作用来处理大量记录整理场景。

### 变更的意义
- 编排页成为完整的记录管理中心
- 用户无需离开页面即可完成图片上传、草稿编写、批量管理

## P3-3: Tags 页面增强

### 修改了什么
- `src/lib/turso.ts`: tags 表添加 `color` 列（默认 `#3b82f6`），`tursoGetTags`/`tursoAddTag` 支持 color 参数
- `src/lib/content.ts`: `getTags`/`addTag` 签名更新支持 color 返回值和参数
- `app/api/cli/route.ts`: `add-tag` 命令支持 color 参数
- `app/records-client.tsx`: 添加标签管理器面板（PaintIcon 按钮触发），显示所有标签及其记录数，每个标签有颜色选择器（input[type=color]），点击标签可筛选记录

### 为何这样修改
原有标签系统只有 label 和 icon，缺少视觉区分。添加 color 字段后，用户可以为不同标签设置不同颜色，提升视觉辨识度。标签管理器提供集中管理入口，标签点击筛选与分类筛选互补。

### 变更的意义
- 标签系统从二元组升级为三元组（label + icon + color），Turso 持久化
- 标签管理器让用户可视化管理标签颜色和筛选

## P3-4: 远程文章导入

### 修改了什么
- `app/records-client.tsx`: 工具栏添加"快速导入"按钮，展开内联导入表单（URL 输入 + 导入按钮），通过 CLI API 导入记录

### 为何这样修改
`import-dialog.tsx` 已存在且通过 `shell.tsx` 集成到 nav-bar，提供完整的 URL/RSS 导入功能。本次在 records-client 页面单独添加快速导入入口，作为主对话框的快捷替代，方便在浏览记录时快速导入。

### 变更的意义
- 提供双入口导入：nav-bar 完整对话框 + records 页面快速导入
- 快速导入简化流程，URL 输入即导入

## P3-5: Agent 前端增强

### 修改了什么
- `app/agent-sidebar.tsx`:
  - 来源标注卡片：解析 assistant 消息中的 `[k1]`/`[k2]` 等知识库引用，显示可点击的来源卡片（链接到 `/records/{id}`）
  - 清空对话二次确认：点击清除按钮第一次变为确认图标 + 提示文字"Click again to clear"，第二次点击才执行清空；切换会话时重置确认状态
  - 会话重命名：已存在（双击标题编辑）
  - 消息复制：已存在（每条消息旁复制按钮）

### 为何这样修改
Agent 回答中引用知识库记录时，用户需要能快速跳转到来源。清空对话是破坏性操作，需要二次确认防止误操作。重命名和复制功能已存在，无需额外开发。

### 变更的意义
- 来源卡片让 Agent 回答的知识引用可追溯、可点击跳转
- 二次确认防止误清空对话