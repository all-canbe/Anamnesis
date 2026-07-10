## 修复：公开文章不显示 + 登录API错误提示优化

### 修改了什么
- **src/lib/content.ts `getPublicRecords`**：Turso 未配置或无公开记录时，回退到本地 `content/index.json` 返回所有记录
- **app/api/auth/login/route.ts**：捕获 `JWT_SECRET` 缺失异常，给出明确错误提示

### 为何这样修改
- `getPublicRecords` 之前仅查询 Turso，Turso 未配置时直接返回 `[]`，没有回退到本地文件。而 `getRecords` 已有本地回退机制
- `createToken` 调用 `validateAuthEnv()` 抛出异常，被 catch 捕获后只返回模糊的"请求处理失败"，无法定位问题

### 变更的意义
- 未配置 Turso 时公开文章正常显示（从本地文件读取）
- 管理员登录时如果 `JWT_SECRET` 未配置，会显示"服务器认证配置错误，请联系管理员（JWT_SECRET 未配置）"