# 数据隔离修复

## 修改了什么

修复了用户之间的数据隔离问题，确保每个用户只能看到/操作自己的知识文档，并移除了无效的前端 Database Configure 设置。

### 核心变更

| 文件 | 变更 |
|------|------|
| `actions.ts` | `requireAuth` 返回 `username`，所有 Server Actions 将 `username` 传递给 content 层函数 |
| `app/actions/import-article.ts` | 新增 `requireAuth` 认证，`generateId`/`writeRecord` 传递 `username` |
| `app/api/record-counts/route.ts` | 新增 `verifyRequestAuth` 认证，`getRecords` 传递 `username` |
| `src/lib/agent-tools.ts` | 新增 `setAgentUserId` 模块级函数，所有工具执行函数传递 `currentUserId` |
| `app/api/agent/chat/route.ts` | 在请求处理前调用 `setAgentUserId(username)` |
| `app/settings-dialog.tsx` | 移除无效的 Database Configure 区域及相关状态/函数 |
| `tests/turso.test.ts` | 测试用例适配新的函数签名（增加 `userId` 参数） |
| `tests/content.test.ts` | 测试断言适配新的调用参数 |

### 数据流

```
JWT token (sub=username)
  → actions.ts: requireAuth() 返回 username
  → agent/chat/route.ts: verifyRequestAuth() → setAgentUserId(username)
  → record-counts/route.ts: verifyRequestAuth() 返回 username
  → content.ts: getRecords/writeRecord/deleteRecord/getRecord 接收 userId 参数
  → turso.ts: SQL 查询增加 WHERE user_id = ? 过滤
```

## 为何这样修改

1. **`records` 表已有 `user_id` 列但未被使用**：之前的修改在 `turso.ts` 中增加了 `user_id` 列和迁移逻辑，但 `content.ts` 和所有调用方都没有传递 `username`，导致虽然数据有隔离列，但查询时未过滤，所有用户仍能看到全部数据。

2. **Agent 工具无用户隔离**：`agent-tools.ts` 中的工具函数（search_kb、get_record、write_record 等）直接调用 content 函数而不传 userId，Agent 可以操作任意用户的数据。采用模块级 `setAgentUserId` 注入方式，在请求处理前设置，避免改动 Tool 接口。

3. **Database Configure 设置无效**：前端设置面板中的 Database Configure 区域将配置保存在 localStorage 和 cookie 中，但服务端一直使用 `.env.local` 的 `TURSO_DB_URL`/`TURSO_DB_TOKEN`，前端设置对实际数据库连接无任何影响，属无效配置，予以移除。

4. **record-counts API 无认证**：该 API 直接返回所有记录的分类统计，任何未登录用户都可以访问，且未按用户过滤。

## 变更的意义

- **用户数据隔离生效**：每个用户只能看到、创建、编辑、删除自己的知识文档
- **Agent 工具安全**：Agent 通过工具函数操作知识库时，只能操作当前用户的数据
- **API 安全加固**：所有数据 API 均需认证，且按用户过滤
- **清理无效配置**：移除前端 Database Configure 设置，避免用户困惑
- **向后兼容**：旧数据（无 `user_id`）已通过迁移自动归属 `admin` 用户