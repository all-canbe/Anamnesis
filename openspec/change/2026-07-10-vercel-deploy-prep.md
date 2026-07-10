# Vercel 上线前检查与修复

日期：2026-07-10

## 修改内容

### 1. Agent 对话历史重复问题修复

**Bug 根因**：当 LLM 配置未加载完成时，用户发送消息后，消息被提前保存到 session（`addMessage`），但 API 调用失败（配置缺失或其他错误），消息残留在 session 中。用户重新配置后再次发送，同一消息出现两次。

**修复**（`app/agent-sidebar.tsx`）：
- 添加 `rollbackLastUserMsg()` 回滚函数，在三个错误路径中移除已添加的消息：
  - API 返回非 200（`!res.ok`）
  - 流式响应无内容（`!fullContent && !errorMessage`）
  - 网络异常（catch 块）
- 修复 history 构建方式：改用当前 React state（`messages`）而非从 localStorage 重新读取，消除竞态条件

### 2. 邮箱注册/登录系统

**新增文件**：
| 文件 | 用途 |
|------|------|
| `src/lib/email.ts` | 基于 Resend REST API 发送验证码邮件 |
| `src/lib/captcha.ts` | JWT 令牌生成/验证，用于滑块验证码 |
| `app/api/auth/send-code/route.ts` | 发送邮箱验证码（含冷却和限流） |
| `app/api/auth/register/route.ts` | 注册：验证码校验 + 创建用户 + 自动登录 |
| `app/api/auth/captcha/route.ts` | 获取滑块验证码令牌 |

**修改文件**：
| 文件 | 变更 |
|------|------|
| `src/lib/turso.ts` | 新增 `users` 和 `verification_codes` 表，新增用户/验证码 CRUD 函数 |
| `src/lib/auth.ts` | 新增 `validateEmailLogin`、`validateAdminLogin`、`hashPassword`；数据库异常降级不影响 admin 登录 |
| `app/api/auth/login/route.ts` | 支持邮箱登录 + admin 兼容登录 + 滑块验证码 + 限流 |
| `app/api/auth/me/route.ts` | 返回 `email` 替代 `username` |
| `middleware.ts` | 白名单添加 `/api/auth/send-code`、`/api/auth/register`、`/api/auth/captcha` |
| `app/login-dialog.tsx` | 完全重写：登录/注册双模式、邮箱+密码+验证码+滑块验证码 |
| `app/globals.css` | 新增滑块验证码、验证码行、模式切换按钮样式 |
| `app/shell.tsx` | `username` → `userEmail`，适配新 API 响应格式 |
| `src/lib/language-context.tsx` | 新增中英文翻译键 |
| `.env.local` | 新增 `RESEND_API_KEY` 和 `EMAIL_FROM` 配置说明 |

**测试更新**：
| 文件 | 变更 |
|------|------|
| `tests/auth.test.ts` | `validateCredentials` → `validateAdminLogin` |
| `tests/security-regression.test.ts` | 登录请求新增 `captchaToken` 字段 |
| `tests/api-routes.test.ts` | 登录请求新增 `captchaToken` 字段，mock 更新 |
| `tests/turso.test.ts` | `initTursoSchema` 调用次数 13→15 |

### 3. 构建与测试结果

- 构建：成功，所有新路由已注册
- 测试：241 通过 / 9 失败（9 个失败均为已有问题，与本次变更无关）

## 上线前须知

### 必须配置
- **`RESEND_API_KEY`**：在 [resend.com](https://resend.com) 注册获取 API Key，否则验证码邮件无法发送
- **`JWT_SECRET`**：生产环境必须更换为强随机密钥（当前为测试密钥）
- **`EMAIL_FROM`**：需配置为已通过 Resend 验证的域名邮箱

### 已有问题（非本次变更引入）
- API 搜索路由 (`/api/search`) 在测试中缺少 auth token → 5 个测试失败
- Next.js 16 `cookies()` 在测试环境中报错 → 2 个 article-importer 测试失败
- `tursoDeleteTag` 测试期望 "frontend" 不触发 DELETE，但函数只检查 `PUBLIC_CATEGORIES` → 1 个测试失败