# 修复：重启后私有文章变为公开

## 问题

Agent 创建私有文章后，重启应用该文章变为公开（visibility 从 `private` 变为 `public`）。

## 根因

`src/lib/turso.ts` 的 `query` 函数对 Turso HTTP API 的错误响应处理不完整。

**调用链：**

1. 每次重启，`ensureTurso()` → `initTursoSchema()` 被调用
2. `initTursoSchema` 尝试 `ALTER TABLE ADD COLUMN visibility`（第86行），用 try/catch 包裹
3. 当列已存在时，Turso HTTP API 返回 **HTTP 200**，但响应体中包含错误：`{ error: { message: "duplicate column name: visibility" } }`
4. `query` 函数只检查了 `res.ok`（HTTP 状态码），**未检查响应体中的 SQL 错误**
5. 因此 `query` 返回 `[]` 而非抛出异常，try/catch 未捕获到错误
6. `visibilityAdded` 被错误地设为 `true`
7. 触发 `UPDATE records SET visibility = 'public' WHERE user_id = 'admin'`
8. 所有 admin 的私有文章被批量改为公开

## 修复

在 `query` 函数中增加对 Turso API 响应体中 SQL 错误的检测：

```typescript
const result = data?.[0];
if (result?.error) {
  throw new Error(`Turso query error: ${result.error.message || JSON.stringify(result.error)}`);
}
```

这样 `ALTER TABLE ADD COLUMN` 在列已存在时会正确抛出异常，`initTursoSchema` 的 try/catch 能正确捕获，`visibilityAdded` 保持 `false`，不会误执行批量 UPDATE。

## 影响范围

- 修复了 `query` 函数对所有 Turso SQL 错误的静默吞没问题
- 不影响现有功能，所有 68 个测试通过