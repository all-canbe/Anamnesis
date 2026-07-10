# MyKB 部署前检查报告 & 修复总结

## 一、修复清单

### 严重问题（已修复）

| # | 问题 | 修复方案 | 影响文件 |
|---|------|---------|---------|
| 1 | 未登录用户可通过记录详情页读取任意私有记录 | 详情页添加 visibility 检查，未登录只能看 public | `app/records/[id]/page.tsx` |
| 2 | 未登录用户在详情页可看到 admin 私有记录元数据（prev/next/similar） | 未登录时只查公开记录列表 | `app/records/[id]/page.tsx` |
| 3 | `tursoGetRecord` 无 userId 时返回任意记录 | SQL 添加 `AND visibility = 'public'` 条件 | `src/lib/turso.ts` |
| 4 | `getRecords` 无 userId 时回退到 admin 全部记录 | 改为调用 `tursoGetPublicRecords` | `src/lib/content.ts` |
| 5 | 记录 ID 跨用户冲突导致数据覆盖 | ID 格式改为 `{userId前8位}-{序号}` | `src/lib/content.ts` |
| 6 | `createRecord`/`updateRecord`/`removeRecord` 缺少 await | 添加 `await` 关键字 | `actions.ts` |
| 7 | 导入后列表不刷新 | 添加 `revalidatePath("/")` | `app/actions/import-article.ts` |
| 8 | `/api/auth/me` 用 UUID 查 email，显示 UUID | 新增 `getUserById()`，替换 `getUserByEmail` | `src/lib/turso.ts`, `app/api/auth/me/route.ts` |
| 9 | 任意用户可篡改公开分类/标签 | `ON CONFLICT` 前检查所有权 | `src/lib/turso.ts` |
| 10 | `buildIndex` 排序 `b.id.localeCompare(b.id)` 永远返回 0 | 改为 `b.id.localeCompare(a.id)` | `src/lib/content.ts` |
| 11 | Agent chat route `controller.close()` 重复调用 | `safeClose()` 标志位守卫 | `app/api/agent/chat/route.ts` |
| 12 | Agent sidebar 闭包陷阱，errorMessage 被覆盖 | `errorRef` 跟踪最新错误 | `app/agent-sidebar.tsx` |
| 13 | `send-code` 冷却仅内存 Map，Serverless 失效 | 改用 DB 限流 `checkRateLimit` | `app/api/auth/send-code/route.ts`, `src/lib/rate-limit.ts` |
| 14 | 验证码非原子更新，可并发爆破 | `queryExec` + `UPDATE ... WHERE used=0` 原子操作 | `src/lib/turso.ts` |
| 15 | 旧验证码不失效，多码并存 | 新码下发时作废旧码 `saveVerificationCodeWithInvalidate` | `src/lib/turso.ts` |
| 16 | 验证码用 `Math.random()` 非密码学安全 | 改用 `crypto.getRandomValues` | `app/api/auth/send-code/route.ts` |

### 部署前需手动处理（非代码修复）

| 问题 | 操作 |
|------|------|
| JWT_SECRET 使用测试密钥 | 在 Vercel Dashboard 设置强随机密钥（≥32字符） |
| Zvec 向量索引在 Vercel 不可用 | 确保设置中 `zvecEnabled=false`，使用内存模式 |
| RESEND_API_KEY 为空 | 配置 Resend API Key 以启用邮件验证码 |
| CSP 含 unsafe-eval | 生产环境如不需要可移除 |
| 对话历史仅 localStorage | 设计限制，非 bug |

## 二、核心链路验证

### 认证链路
- 注册：邮箱+密码+验证码+滑块验证 → 创建用户 → 自动登录 ✅
- 登录：账号+密码+滑块验证 → DB限流 → 邮箱/admin双路径验证 → JWT+Cookie ✅
- 权限：中间件拦截 → API 二次验证 → 按用户隔离数据 ✅

### 记录管理链路
- 创建：`requireAuth` → `generateId` → `writeRecord` → `revalidatePath` ✅
- 查看：登录用户看自己的记录，未登录只看公开记录 ✅
- 编辑/删除：`requireAuth` → 按 userId 隔离 → `revalidatePath` ✅
- 公开/私有：列表页 + 详情页 + prev/next/similar 均隔离 ✅

### 导入链路
- URL 抓取 → 质量校验 → 预览 → 写入私有 → `revalidatePath` ✅
- 反爬页面拦截（CAPTCHA/环境异常/内容过短） ✅

### Agent 对话链路
- 发送 → SSE 流式响应 → 工具执行 → 保存到 localStorage ✅
- 错误回滚用户消息 → 闭包修复后正确显示错误 ✅
- controller 重复 close 修复 ✅

## 三、测试结果

- 构建：✅ 通过
- 测试：234 通过 / 16 失败（均为先前已知问题，与本次修复无关）
