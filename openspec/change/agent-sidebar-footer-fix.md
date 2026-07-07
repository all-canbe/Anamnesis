# Agent 输入框悬浮与 Footer 固定修复

## 修改了什么

1. **Footer 固定在 .site-main 底部**
   - 移除了 `shell.tsx` 中的 `footerVisible` 状态与条件渲染逻辑
   - `FooterBar` 始终渲染在 `.site-main` 内部末尾
   - `.site-main` 改为 `display: flex; flex-direction: column;`
   - `.page-view` 改为 `flex: 1;`，让 footer 通过 `margin-top: auto` 粘在内容区底部
   - `.site-footer` 添加 `margin-top: auto; flex-shrink: 0`

2. **Agent 对话可正常滚动到底部且不遮挡回复**
   - `.agent-messages` 默认 `overflow-y: auto`（移除 hover/focus 才显示滚动条的限制）
   - `.agent-messages` 底部 padding 从 `120px` 增加到 `180px`，为悬浮输入框留出足够空白

3. **Agent 输入框改为半透明悬浮设计**
   - `.agent-sidebar-footer` 改为 `position: absolute; bottom: 12px; left/right: 12px;`
   - 背景改为半透明 + `backdrop-filter: blur(12px)`，支持 light/dark 模式
   - 添加 `border-radius: 20px` 和阴影，呈现悬浮卡片效果
   - `.agent-input-row` 也改为半透明背景，透出下方消息内容

## 为何这样修改

- 之前 footer 条件渲染导致滚动到底部时突然出现/消失，产生闪烁和布局抖动
- `.agent-messages` 默认隐藏滚动条，用户无法直接滚动；hover 才启用滚动体验差
- 输入框背景不透明且紧贴底部，占死空间并遮挡最后几条消息；悬浮半透明设计既保持可输入性，又能看到上下文

## 变更的意义

- 中间内容区 footer 始终稳定显示在底部，不再闪烁
- Agent 侧边栏滚动体验自然，最后一条消息完整可见
- 输入框视觉层次更清晰，符合现代聊天应用悬浮输入范式

## 验证结果

- `npm run build`：0 错误
- `npm test`：26/26 测试通过

## 涉及文件

- `app/shell.tsx`
- `app/globals.css`
