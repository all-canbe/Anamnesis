# 修复构建错误：Module not found: Can't resolve 'fs'

## 问题

Next.js 构建时报错 `Module not found: Can't resolve 'fs'`，错误链路：

```
import-dialog.tsx (client component) → article-importer.ts → content.ts → fs
client-page.tsx (client component) → content.ts → fs
```

客户端组件（`"use client"`）通过 import 链间接引入了 Node.js 的 `fs` 模块，浏览器端无法解析。

## 修改内容

### 1. 新建 `app/actions/import-article.ts`（Server Action）

将 `importArticle` 函数从 `src/lib/article-importer.ts` 中提取为独立的 Server Action，使其仅在服务端执行。

### 2. 修改 `src/lib/article-importer.ts`

移除 `importArticle` 函数和对 `@/lib/content` 的 import，使其成为纯浏览器安全的模块（仅使用 `fetch`）。

### 3. 修改 `app/import-dialog.tsx`

- 将 `import { importArticle } from "@/lib/article-importer"` 替换为 `import { importArticleAction } from "./actions/import-article"`
- 将 `importArticle(...)` 调用替换为 `importArticleAction(...)`

### 4. 修改 `actions.ts`

添加 `getRecordAction`，将 `getRecord` 封装为 Server Action，避免 `client-page.tsx` 直接 import `content.ts`。

### 5. 修改 `client-page.tsx`

- 移除 `import { getRecord } from "@/lib/content"`
- 改用 `getRecordAction` from `./actions`

### 6. 修改 `tests/article-importer.test.ts`

更新测试，从 `../app/actions/import-article` 导入 `importArticleAction`。

### 7. 修改 `app/api/upload/route.ts`

修复预存的 Uint8Array 类型错误：`new TextEncoder().encode(putPolicy)` 返回 `Uint8Array`，需要 `.buffer` 才能传给接受 `ArrayBuffer` 的 `base64URL` 函数。

## 原因

Next.js 中客户端组件（`"use client"`）的代码会在浏览器端执行，不能直接使用 Node.js 原生模块（如 `fs`）。Server Actions（`"use server"`）始终在服务端运行，是安全地桥接客户端和服务端的方式。

## 影响

- 构建成功，无类型错误或模块解析错误
- 客户端组件不再依赖 Node.js 模块
- 导入功能通过 Server Action 正常工作