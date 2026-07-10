# Agent 设置检查认证时序修复

## 修改了什么
修改了 `app/agent-sidebar.tsx` 中 `sendMessage` 函数的 API 配置检查逻辑。

## 为何这样修改
**问题**：每次重启应用后，Agent 对话无法直接使用，需要先打开设置对话框读取配置后才能正常对话。

**根因**：`sendMessage` 中检查 API 配置的 `fetch("/api/settings")` 存在两个问题：
1. 缺少 `credentials: "same-origin"`，与设置对话框的调用方式不一致
2. 未正确处理 401 响应——页面加载时 `shell.tsx` 的 `checkAuth()` 中的 dev-login 尚未完成，cookie 还未设置。此时 `GET /api/settings` 返回 401，解析后的 `data.configured` 为 `undefined`，被当作"未配置"处理，显示错误提示并阻止对话

而当用户打开设置对话框时，dev-login 已完成、cookie 已就绪，所以能正常读取配置。

## 变更的意义
- 修复后，当 settings 接口返回非 ok 响应（如 401）时，不再显示"Agent 未配置"的错误，而是继续将请求传递给 `/api/agent/chat` 服务端处理
- 只有接口返回正常的 200 且 `configured` 为 false 时，才显示配置错误提示
- 用户不再需要在重启后先打开设置对话框"激活"配置才能使用 Agent 对话
