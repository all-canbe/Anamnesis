# Agent 配置缓存预加载方案

## 修改了什么

修改了三个文件：

1. **`app/shell.tsx`** — 新增 `settingsConfig` 状态和 `loadSettingsConfig` 函数
2. **`app/agent-sidebar.tsx`** — 接收 `settingsConfig` prop，`sendMessage` 直接使用缓存值判断配置状态
3. **`app/settings-dialog.tsx`** — 接收 `initialConfig` prop，添加重试机制，保存时更新缓存

## 为何这样修改

**问题**：每次刷新页面后：
- 设置对话框打开时先显示默认值（baseUrl 空、model 默认），因为 dev-login 异步请求未完成，`/api/settings` 返回 401
- 发送消息时检查 `/api/settings` 也因认证未就绪而返回 401，被误判为"未配置"
- API Key 不能存浏览器缓存，但也不想每次发消息都请求服务端

**方案设计**：
1. 将 `/api/settings` 返回的**非敏感元数据**（configured、baseUrl、model、keyPreview、embeddingModel、zvecEnabled）缓存到 localStorage 的 `zhiyi-agent-config` 键
2. 缓存中**不含完整 API Key**，只有脱敏后的 keyPreview，安全
3. Shell 组件在初始化时从 localStorage 恢复缓存，auth 成功后异步重新加载并更新缓存
4. AgentSidebar 的 `sendMessage` 直接使用缓存的 `configured` 字段，不再发请求
5. SettingsDialog 打开时先用缓存值渲染（无闪烁），后台异步 revalidate，失败时自动重试最多 5 次

## 变更的意义

- **直接对话**：已配置的用户刷新页面后，`sendMessage` 直接从缓存读取 `configured: true`，无需等待 auth 完成即可对话
- **无闪烁设置**：设置对话框打开时立即显示缓存中的真实配置值，不会先闪默认值再加载
- **无安全风险**：缓存中只有脱敏的 keyPreview，完整 API Key 始终在服务端加密存储
- **自动同步**：保存配置后自动更新缓存，下次打开设置或发消息直接使用最新值