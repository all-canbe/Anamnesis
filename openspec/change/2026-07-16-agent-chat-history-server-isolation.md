# Agent 会话历史服务端化隔离

## 修改了什么

将 agent 会话历史从浏览器 localStorage 迁移至 Turso DB，按 user_id 严格隔离，所有读写经鉴权 API。

### 新增文件
- `src/lib/chat-repo.ts` — 数据访问层，所有查询强制 `WHERE user_id = ?`，`assertSessionOwned` 集中归属校验
- `app/api/agent/sessions/route.ts` — GET 会话列表 / POST 创建会话
- `app/api/agent/sessions/[id]/route.ts` — GET 消息 / PATCH 重命名 / DELETE 删除会话
- `app/api/agent/sessions/[id]/messages/route.ts` — POST 追加消息 / DELETE 清空消息

### 修改文件
- `src/lib/turso.ts` — 新增 `chat_sessions` / `chat_messages` 表（按 user_id 隔离 + 索引）
- `src/lib/chat-store.ts` — 移除 localStorage 读写，改为服务端 API 封装 + 旧数据一次性迁移
- `app/agent-sidebar.tsx` — isLoggedIn 闸门加载、懒加载消息、事件驱动持久化、tool 消息渲染
- `app/api/agent/chat/route.ts` — 服务端从 DB 加载权威历史，精简持久化中间消息（tool content 截断 800 字符）
- `app/globals.css` — tool 消息样式

## 为何这样修改

**根因**：历史完全存储在 localStorage（全局 key `zhiyi-chat-sessions`），无 user_id 分桶、无登录校验、登出/掉线不清除。未登录用户可直接查看之前的对话历史，多用户在共享设备上互相泄露。

**设计决策**：
1. 服务端权威源 — 服务端从 DB 加载历史，忽略客户端传入的 history，消除篡改攻击面
2. 精简持久化 — tool 消息 content 截断到 800 字符，跳过 system 注入和空 assistant，平衡上下文完整性与存储成本
3. 一次性迁移 — 首次登录检测旧 localStorage 数据并批量上传，成功后删除本地 key
4. 归属校验统一在 chat-repo — 越权访问返回 404（不泄露会话存在性）

## 变更的意义

- **隔离**：未登录看不到任何历史；跨用户严格隔离（user_id WHERE）；越权 404
- **持久化**：user → tool（精简）→ assistant 按序写入 DB，支持多轮工具调用上下文
- **增删**：新建、删除、重命名、清空均有完整鉴权链路
- **前端适配**：system 消息跳过，tool 消息特殊样式（工具名 + 状态标签）
