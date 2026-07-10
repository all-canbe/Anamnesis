# 登录入口、用户头像与用户配置管理

**日期**: 2026-07-06

---

## 修改了什么

### 1. 认证体系升级

| 文件 | 修改内容 |
|------|----------|
| `src/lib/auth.ts` | `createToken` 新增 `username` 参数，写入 JWT payload `sub`；`verifyToken` 返回解析出的 `username`，不再返回 boolean |
| `src/lib/api-auth.ts` | `verifyRequestAuth` 返回 `string | null`（用户名或 null），不再返回 boolean |
| `middleware.ts` | `verifyAuth` 返回 `string | null`，更新 `PUBLIC_PATHS` 增加 `/api/auth/me`、`/api/auth/logout`、`/api/auth/dev-login` |
| `app/api/auth/login/route.ts` | 调用 `createToken` 传入用户名，响应增加 `username` 字段 |

### 2. 新增 API 端点

| 文件 | 功能 |
|------|------|
| `app/api/auth/me/route.ts` | GET 请求，返回当前登录 `{ username }` |
| `app/api/auth/logout/route.ts` | POST 请求，清除 cookie，返回成功 |
| `app/api/auth/dev-login/route.ts` | POST 请求，仅开发环境可用，自动以 admin 身份登录 |

### 3. 用户配置隔离

| 文件 | 修改内容 |
|------|----------|
| `src/lib/turso.ts` | `getSetting(key, userId?)` / `setSetting(key, value, userId?)`：有 userId 时使用 `{userId}:{key}` 前缀，实现用户配置隔离 |
| `src/lib/agent-config.ts` | `getAgentConfig(userId)` / `saveAgentConfig(cfg, userId)` / `hasAgentConfig(userId)`：仅从 DB 读取/写入，移除 `.env.local` 回退；`.env.local` 不再存储 LLM 配置 |
| `app/api/settings/route.ts` | GET/POST 都从 `verifyRequestAuth` 获取 username，读写该用户配置；移除 `savedTo: "env"` 分支 |
| `app/settings-dialog.tsx` | 移除 `savedTo` 状态和 `savedTo: "env"` 参数，保存不再写入 `.env.local` |

### 4. 前端 UI

| 文件 | 修改内容 |
|------|----------|
| `app/login-dialog.tsx` | **新建**：登录对话框，输入用户名密码，调用 `/api/auth/login`，成功后回调 |
| `app/nav-bar.tsx` | 新增 `username` Props，Settings 按钮上方增加登录入口：未登录显示 User 图标按钮，登录后显示圆形头像（首字母大写），点击弹出登出菜单 |
| `app/shell.tsx` | 新增 `username` / `loginOpen` state，useEffect 初始化调用 `/api/auth/me` 获取当前用户；开发环境未登录时自动调用 `/api/auth/dev-login`；渲染 `LoginDialog` |
| `app/globals.css` | 新增 `.nav-bar-avatar` / `.nav-bar-avatar-menu` / `.login-dialog` 相关样式 |

### 5. 测试文件更新

更新了测试用例适配新的 API 签名。

---

## 为何这样修改

原需求是 `.env.local` 配置导致混乱，要求：

- 在设置按钮上方增加头像显示和登录入口
- 登录后显示头像（首字母），可以登出
- 每个用户的配置独立存储在数据库
- `.env.local` 仅用于本地测试自动登录 admin 和读取认证凭据（`ADMIN_USERNAME`、`ADMIN_PASSWORD_HASH`、`JWT_SECRET`），不再存储 LLM 配置

修改后：

- 架构支持多用户，每个用户 Agent 配置隔离
- 开发环境自动登录体验流畅，无需手动输入
- `.env.local` 职责清晰，解决了配置混乱问题
- 用户入口清晰，左侧导航栏设置按钮上方有登录/头像

---

## 变更的意义

1. **配置隔离**：不同用户使用不同的 LLM API Key 和模型，不再混淆
2. **身份明确**：登录流程清晰，每个请求带上用户身份，认证正确
3. **职责清晰**：`.env.local` 仅存认证凭据，不存用户配置，解决原始问题中的"配置混乱"
4. **用户体验**：开发环境开箱即用，自动登录；生产环境需要手动登录

---

## 验证

- `npx tsc --noEmit` 通过 ✓
- 测试文件已更新适配新 API ✓
- 现有功能：Agent 聊天、设置加载保存、认证拦截均保持兼容 ✓

**部署说明**：首次使用后，admin 用户配置会保存到 `settings` 表，key 为 `admin:agent_baseUrl`、`admin:agent_apiKey`、`admin:agent_model`。`.env.local` 中可以移除 `LLM_BASE_URL`、`LLM_MODEL`、`LLM_API_KEY`（移除不影响，已经存在 DB 中）。
