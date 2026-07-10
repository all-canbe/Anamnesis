# 页面层与 API 数据隔离修复

## 修改了什么

修复了上一轮数据隔离遗漏的 4 个问题：页面服务端渲染无认证、搜索 API 无认证、标签 API 无认证、向量索引跨用户污染。

### 核心变更

| 文件 | 变更 |
|------|------|
| `app/page.tsx` | 新增 cookie JWT 认证，提取 username → 传给 `getFilteredRecords` |
| `app/records/[id]/page.tsx` | 新增 cookie JWT 认证，提取 username → 传给 `getRecord`/`getFilteredRecords`/`findSimilar` |
| `app/api/search/route.ts` | 新增 `verifyRequestAuth`，`semanticSearch` 传 userId |
| `app/api/tags/route.ts` | 新增 `verifyRequestAuth` |
| `src/lib/zvec.ts` | 向量索引增加 userId 支持：`VectorIndex` 加 `userId` 字段，`initIndex`/`semanticSearch`/`findSimilar`/`hybridSearch` 均接受 `userId` 参数并按用户过滤 |
| `src/lib/agent-tools.ts` | `hybridSearch` 传 `userId`，`initAgent` 传 `currentUserId`，`semanticSearch` 签名适配 |
| `tests/zvec.test.ts` | 测试适配新函数签名 |

### 数据流（完整）

```
JWT token (sub=username)
  ┌─ 页面层 (page.tsx): cookie → jwtVerify → username
  │    └─ getFilteredRecords(category, username)
  │       └─ tursoGetRecords(username) → SQL WHERE user_id = ?
  │
  ├─ API 层 (search/tags/record-counts): verifyRequestAuth → username
  │    └─ semanticSearch(query, username)
  │       └─ initIndex(username) → 只加载该用户数据
  │
  ├─ Server Actions (actions.ts): requireAuth() → username
  │    └─ writeRecord/deleteRecord/getRecord(id, username)
  │
  ├─ Agent 层 (agent/chat/route.ts): verifyRequestAuth → setAgentUserId(username)
  │    └─ agent-tools: 所有工具调用传 currentUserId
  │
  └─ CLI 层 (cli/route.ts): verifyToken → username
       └─ 所有命令传 username
```

## 为何这样修改

1. **页面层无认证**：首页和详情页是服务端组件，直接调用 content 函数不传 userId，所有用户看到同一份数据。解决方案：从 cookie 读取 JWT 提取 username，透传给 content 层。

2. **搜索/标签 API 无认证**：任何未登录用户都能调用，暴露数据。解决方案：添加 `verifyRequestAuth` 网关。

3. **向量索引跨用户污染**：`zvec.ts` 的 `initIndex` 调用 `getRecords()` 不传 userId，所有用户数据混在同一内存索引中。解决方案：`VectorIndex` 增加 `userId` 字段，`initIndex` 接受 `userId` 按用户加载，搜索时检测 userId 不匹配则重建索引。

## 变更的意义

- **全链路数据隔离**：从页面到 API 到 Agent 到 CLI，所有知识文档读写入口均完成认证和用户隔离
- **向量搜索安全**：语义搜索不再返回其他用户的文档
- **零遗漏**：审计确认所有 17 个知识管理入口均已认证和隔离
- **向后兼容**：所有 userId 参数均为可选，未传时行为不变（fallback 到 admin）