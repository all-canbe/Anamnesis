# Agent 功能测试与修复总结

**日期**: 2026-07-06

---

## 修改了什么

### 1. Turso 数据库连接修复（2 个 Bug）

**Bug 1: `libsql://` 协议不支持原生 fetch**
- 文件: `src/lib/turso.ts`
- 修改: `config.url` → `config.url.replace(/^libsql:\/\//, "https://")`
- 原因: Turso HTTP API 需要 `https://` 协议，原生 fetch 不支持 `libsql://`

**Bug 2: Turso 响应解析路径错误**
- 文件: `src/lib/turso.ts`
- 修改: `data?.results?.[0]?.response?.result?.rows` → `data?.[0]?.results?.rows`
- 原因: Turso HTTP API 返回的是数组 `[{results: ...}]`，原代码将数组当对象解析，导致永远返回空数组 `[]`

**Bug 3: Turso 查询参数格式错误**
- 文件: `src/lib/turso.ts`
- 修改: `params: { ...args }` → `params: args`
- 原因: 数组展开为对象 `{0: val1, 1: val2}` 而非数组 `[val1, val2]`，导致 Turso 写入虽不报错但数据未持久化

### 2. Agent 功能增强

**增加 max_tokens**
- 文件: `src/lib/agent-llm.ts`
- 修改: `max_tokens: 2048` → `4096`
- 原因: 生成文档时内容过长容易超出限制

**强化 system prompt**
- 文件: `app/api/agent/chat/route.ts`
- 修改: 将 `write_record` 指令提升为 `CRITICAL` 级别，明确要求「不要先搜索，直接写」
- 原因: 模型倾向于先搜索再写，但知识库为空时搜索无果导致浪费轮次

### 3. 认证配置补充
- 文件: `.env.local`
- 新增: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`
- 原因: 缺少这些配置导致 middleware 拦截所有 API 请求

### 4. 测试文件修复
- `tests/content.test.ts`: `storedRecords` 类型从 `{ id: string }[]` 放宽为 `Record<string, any>[]`
- `vitest.config.ts`: 同步更新密码哈希

### 5. 文档更新
- `.trae/documents/pre-launch-action-plan.md`: P3-1 至 P3-5 状态从 ⬜ 更新为 ✅

---

## 为何这样修改

1. **Turso 三连 Bug**: 之前的 Turso 集成从未经过端到端测试。`libsql://` 协议转换、响应解析路径、参数格式三个问题叠加，导致写入「成功」（不报错但数据未持久化）而读取「成功」（返回空数组）。修复后 Turso 成为真正可用的主存储。

2. **Agent prompt 优化**: 模型（step-3.5-flash-2603）在收到「写文章」指令时倾向于先搜索知识库，但知识库为空时搜索无果，浪费轮次。强化 prompt 后模型直接调用 `write_record`。

3. **bcrypt 哈希**: PowerShell 环境下 `$` 符号在 .env 中被解释为变量，导致哈希值被破坏。通过 Node.js 直接写入文件解决。

---

## 变更的意义

- **Agent 上传文档功能**: 验收通过。Agent 能自主调用 `write_record` 创建文档，文档出现在列表中，详情页正常展示 Markdown 格式内容。
- **Agent 导入 Skill 功能**: 验收通过。Agent 能自主调用 `import_skill` 从 GitHub 导入 skill 包（测试导入 `code-review-skill`，创建 40 条知识记录）。
- **Turso 主存储**: 从「名义上配置了但实际不可用」变为真正可用的主存储。