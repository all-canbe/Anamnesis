# Agent 输入框 Slash Command 修复

## 修改了什么

1. **发送按钮移到右下角** — 输入框工具栏中按钮放入 `.toolbar-right` 容器，自然靠右对齐。

2. **引入 activeSlash 状态分离命令前缀与正文** — 选中命令/技能后，命令前缀渲染为 pill，`input` 状态只保存补充正文：
   - 发送时组合完整消息：`/command_name {body}`
   - Backspace 删空正文后可再按 Backspace 删除 pill 回到普通模式
   - `/` 键在光标位于开头时重新触发菜单（已有 pill 也算开头）

3. **光标跟踪** — 监听 textarea 的 `onKeyUp`/`onClick`/`onSelect`，根据 `selectionStart === 0` 更新 `cursorAtStart`，确保 slash 菜单仅在光标位于开头时触发。

4. **用户消息命令 pill 渲染** — `renderUserContent` 函数按命令名长度降序匹配，将匹配的前缀渲染为 `.agent-msg-command-pill` 包裹样式（无图标）。

5. **Slash 面板触发条件收紧** — 仅当 `activeSlash === null && slashOpen === true` 时显示面板，选中命令后不再重复弹出。

6. **CSS 新增** — `.agent-slash-pill-row`/`.agent-slash-pill`/`.agent-slash-pill-remove` 输入框 pill 样式、`.agent-msg-command-pill` 消息气泡 pill 样式、`.agent-input-row` min-height 从 100px 降至 80px。

7. **类型修复** — `chat/route.ts` 中补充 `skillId`/`tool` 的 TypeScript 类型注解。

## 为何这样修改

- 发送按钮在右下角符合主流聊天应用习惯（微信、Telegram 等）。
- 原逻辑在回车选中命令后将模板文本写入 input 框，导致后续输入任何字符都以 `/` 开头重新触发菜单，是本 bug 的核心原因。
- 分离状态后可精确控制触发条件：仅文字编辑中 `/` 在开头且无选中命令时才弹出菜单。
- 命令 pill 和消息 pill 提供视觉区分，让用户清晰感知当前处于「命令模式」。
- 光标位置条件确保用户输入 `hello /world` 时不会误弹出菜单。

## 变更的意义

- 消除重复弹出 slash 菜单的交互 bug
- 提供清晰的命令/技能视觉反馈（pill 包裹样式）
- Slash Command 交互更接近 IDE/编辑器直觉（仅在开头触发，选中后锁定）
- 测试 26/26 通过，构建 0 错误

## 涉及文件

- `app/agent-sidebar.tsx` — 核心逻辑
- `app/globals.css` — 样式
- `app/api/agent/chat/route.ts` — 类型修复