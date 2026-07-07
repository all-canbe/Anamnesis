# 页面层与 API 数据隔离修复计划

## 问题概览

上一轮修复了 API/Server Action 层的数据隔离，但页面层（服务端渲染）和部分 API 仍然缺少认证和用户隔离。

---

## 修复清单

### 1. 首页无认证无隔离 — `app/page.tsx`

**现状**：服务端组件直接调用 `getFilteredRecords()` 不传 userId，所有用户看到同一份数据。

**方案**：从 cookie 读取 JWT 提取 username，传给 `getFilteredRecords`。未登录时返回空列表。

```tsx
// 伪代码
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

async function getUsernameFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("zhiyi_token")?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    return (payload.sub as string) || null;
  } catch { return null; }
}

// 在 HomePage 中
const username = await getUsernameFromCookie();
const allRecords = await getFilteredRecords(category, username);
```

### 2. 详情页无认证无隔离 — `app/records/[id]/page.tsx`

**现状**：`getRecord(id)` 和 `getFilteredRecords()` 不传 userId。

**方案**：同首页，提取 username 后传给 `getRecord(id, username)` 和 `getFilteredRecords(undefined, username)`。

### 3. 搜索 API 无认证 — `app/api/search/route.ts`

**现状**：`POST /api/search` 无任何认证，直接调用 `semanticSearch`。

**方案**：添加 `verifyRequestAuth`，并为 `semanticSearch` 增加 `userId` 参数（见问题 5）。

### 4. 标签 API 无认证 — `app/api/tags/route.ts`

**现状**：`GET /api/tags` 无认证。

**方案**：添加 `verifyRequestAuth` + `unauthorizedResponse`。

### 5. 向量索引跨用户污染 — `src/lib/zvec.ts`

**现状**：`initIndex` 调用 `getRecords()` 不传 userId，所有用户数据混在同一内存索引中。

**方案**：给索引和搜索函数增加 userId 支持。

具体改动：
- `VectorIndex` 增加 `userId: string` 字段
- `initIndex(userId?: string)` — 接受 userId，只加载该用户数据
- `initAgentIndex(userId: string)` — Agent 专用，替换 `initAgent` 中的调用
- `semanticSearch(query, userId?, limit?)` — 如果传了 userId 且索引不匹配则重新初始化
- `hybridSearch(query, options?)` — options 增加 `userId` 字段
- `findSimilar(recordId, userId?, limit?)` — 接受 userId
- 模块级变量 `indexUserId` 跟踪当前索引属于哪个用户

### 6. Agent 工具调用适配 — `src/lib/agent-tools.ts`

**现状**：`hybridSearch` 调用不传 userId。

**方案**：在 `search_kb` 工具中传 `currentUserId` 给 `hybridSearch`。

---

## 调用链影响分析

```
页面层 (page.tsx)
  └─ cookie → jwtVerify → username
     └─ getFilteredRecords(category, username)
        └─ tursoGetRecords(username) → SQL WHERE user_id = ?

API 层 (search/route.ts, tags/route.ts)
  └─ verifyRequestAuth(request) → username
     └─ semanticSearch(query, username)
        └─ initIndex(username) → 只加载该用户数据

Agent 层 (agent-tools.ts)
  └─ setAgentUserId(username) [已在上轮完成]
     └─ hybridSearch(query, { userId: currentUserId })
```

---

## 预计改动文件

| 文件 | 改动量 | 说明 |
|------|--------|------|
| `app/page.tsx` | +15 行 | 加 cookie 认证 + 传 username |
| `app/records/[id]/page.tsx` | +15 行 | 加 cookie 认证 + 传 username |
| `app/api/search/route.ts` | +5 行 | 加认证 + 传 userId |
| `app/api/tags/route.ts` | +5 行 | 加认证 |
| `src/lib/zvec.ts` | ~30 行 | initIndex/semanticSearch/hybridSearch/findSimilar 支持 userId |
| `src/lib/agent-tools.ts` | ~3 行 | hybridSearch 传 userId |

---

## 风险评估

- **低风险**：改动集中在认证层和参数透传，不涉及数据库 schema 变更
- **向量索引**：每次切换用户需重建索引（embedding 调用），但同一请求内只初始化一次，影响可接受
- **向后兼容**：所有 userId 参数均为可选，未传时行为不变