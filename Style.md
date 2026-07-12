# 知忆 (Anamnesis) 设计风格指南

> 个人知识记录浏览系统的视觉与交互规范。基于 [globals.css](file:///workspace/app/globals.css) 与 [layout.tsx](file:///workspace/app/layout.tsx) 提炼。

---

## 1. 设计理念

**极简、内容优先、CJK 友好**。整体风格接近 Notion / Medium 的克制美学：

- **单色驱动**：主色即"近黑"（light）/ "近白"（dark），不依赖品牌色张扬
- **阅读中心**：主内容区固定 `--max-width: 760px`，长文行高 1.85
- **克制交互**：动效短促（0.15–0.35s），反馈以位移、透明度、下划线生长为主，避免鲜艳颜色
- **隐藏冗余**：全局隐藏滚动条（`scrollbar-width: none`），保留滚动功能
- **双主题**：通过 `[data-theme="dark"]` 切换，脚本在 `<head>` 内联避免 FOUC

---

## 2. 色彩系统

### 2.1 Light Theme（默认）

| Token | 值 | 用途 |
|---|---|---|
| `--color-bg` | `#ffffff` | 页面背景 |
| `--color-surface` | `#fafafa` | 卡片/弹层底色 |
| `--color-text` | `#1a1a1a` | 主文本（即 accent） |
| `--color-text-secondary` | `#666666` | 次级文本 |
| `--color-text-muted` | `#999999` | 元信息、占位 |
| `--color-border` | `#e8e8e8` | 分隔线、卡片边 |
| `--color-accent` | `#1a1a1a` | 强调（等于主文本色） |
| `--color-hover` | `#f5f5f5` | hover 底色 |
| `--color-badge-bg` | `#f0f0f0` | 徽章/标签底 |
| `--color-danger` | `#e53e3e` | 危险/删除 |
| `--color-success` | `#38a169` | 成功/在线点 |

### 2.2 Dark Theme（`[data-theme="dark"]`）

| Token | 值 |
|---|---|
| `--color-bg` | `#0f0f0f` |
| `--color-surface` | `#161616` |
| `--color-text` / `--color-accent` | `#e8e8e8` |
| `--color-border` | `#2a2a2a` |
| `--color-hover` | `#1e1e1e` |
| `--color-danger` | `#ef4444` |
| `--color-success` | `#22c55e` |

### 2.3 Agent 侧边栏（独立配色）

聊天侧边栏使用**独立的蓝色强调色**，与主站的极简单色形成区分：

- Light: `--chat-accent: #4f6ef7`，用户气泡 `#1a1a2e`（深蓝灰），AI 气泡 `#f0f0f5`
- Dark: `--chat-accent: #6b8aff`，用户气泡 `#e8e8f0`，AI 气泡 `#2a2a40`
- 侧边栏背景在 dark 模式下偏紫调（`#1e1e30`），与主站纯黑区分

### 2.4 可见性徽章（语义色，不随主题切换）

- **public**：绿底 `#dcfce7` / 绿字 `#16a34a` / 绿边 `#86efac`
- **private**：红底 `#fee2e2` / 红字 `#dc2626` / 红边 `#fca5a5`

---

## 3. 字体系统

```css
--font-sans: "Hiragino Sans", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
--font-mono: "SF Mono", "Fira Code", "Consolas", monospace;
```

- **CJK 优先**：字体栈首位为日/中文字体，保证中文渲染质感
- `html { font-size: 16px; -webkit-font-smoothing: antialiased; }`
- `body { line-height: 1.7; }`
- 长文阅读区 `.detail-content` 提升到 `line-height: 1.85`

### 字号层级

| 用途 | 字号 | 字重 |
|---|---|---|
| 详情页标题 `.detail-title` | 24px | 700 |
| 二级标题 h2 | 18px | 700 |
| 三级标题 h3 | 16px | 600 |
| 列表卡片标题 | 16px | 600 |
| 正文 | 15px | 400 |
| 次级/摘要 | 13px | 400 |
| 元信息 | 12px | 400 |
| 微标签/uppercase | 11px | 700 |
| Agent 消息 | 13.5px | 400 |

---

## 4. 间距与圆角

### 圆角

| Token | 值 | 用途 |
|---|---|---|
| `--radius-sm` | 4px | 输入框、按钮、徽章 |
| `--radius-md` | 6px | 卡片、弹层、缩略图 |
| `--radius-lg` | 10px | 大弹窗、表单容器 |

**例外**：胶囊形（category-tab 16px、agent 气泡 16px、输入区 20px、send 按钮 50%）。

### 间距节奏

常用值：`4 / 6 / 8 / 12 / 14 / 16 / 20 / 24 / 28 / 32px`。卡片纵向 padding 28px，弹窗 padding 24px，列表项 gap 8–12px。

---

## 5. 布局架构

### 5.1 Shell 三栏结构

```
┌─────────────────────────────────────────────────────┐
│ Header (sticky, 56px, backdrop-blur 12px)           │
├──────┬───────────────┬──────────────┬───────────────┤
│Nav   │ LeftPanel     │ Main         │ AgentSidebar  │
│44px  │ 0 / 220px     │ max 760px    │ 280px+        │
│icon  │ collapsible   │ scroll-y     │ resizable     │
│rail  │               │              │               │
└──────┴───────────────┴──────────────┴───────────────┘
```

- `Shell` 使用 `height: 100vh; overflow: hidden`，仅主区域滚动
- **Nav-bar**：44px 窄竖栏，圆角 `0 10px 10px 0`，激活项左侧 3px 竖条
- **LeftPanel**：宽度过渡 `0.25s cubic-bezier(0.16,1,0.3,1)`，展开 220px
- **Main**：`max-width: 760px` 居中，`padding: 32px 20px 0`
- **AgentSidebar**：最小 280px，左侧 4px 拖拽手柄，可折叠至 40px

### 5.2 视图模式

主列表支持三种视图，通过 `site-main.view-{list|grid|compact}` 切换：

- **list**（默认）：横向卡片，左缩略图 140×88
- **grid**：网格 `repeat(auto-fill, minmax(280px,1fr))`，纵向卡片
- **compact**：缩略图缩至 60×40，隐藏摘要

### 5.3 响应式（≤640px）

- `shell-body` 改为纵向，LeftPanel 与 AgentSidebar 全宽堆叠
- 卡片改纵向，缩略图全宽 180px
- 详情页导航改纵向，隐藏 `nav-title`

---

## 6. 动效规范

### 缓动

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);   /* 主力 */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

### 关键动画

| 名称 | 用途 | 时长 |
|---|---|---|
| `pageEnter` | 页面/详情进入：`translateY(12px)→0 + opacity` | 0.35s |
| `fadeIn` | 弹层淡入 | 0.2s |
| `modalSlideIn` | 弹窗：`translateY(16px) scale(0.97)→0,1` | 0.2s |
| `toastIn/Out` | Toast 右滑入/出 | 0.3s，2.2s 后自动消失 |
| `shimmer` | 骨架屏渐变滚动 | 1.5s infinite |
| `pulse-dot` | 在线状态点呼吸 | 2s infinite |
| `agent-dot-bounce` | 思考中三点跳动 | 1.4s，错峰 -0.32/-0.16s |
| `blink` | 流式输出光标 | 1s step-end |
| `staggerIn` | 卡片内子元素错峰进入 | 0.5s，每项 +0.1s |

### 交互微动效

- **卡片 hover**：`translateX(4px)` + 背景变 hover 色 + 缩略图 `scale(1.03)` + 标题下划线 `scaleX(0→1)`
- **按钮 hover**：`translateY(-1px)` + 阴影渐显
- **导航按钮 active**：左侧 3px 竖条 + 背景高亮
- **链接 hover**：`opacity: 0.7`（主站）/ 下划线偏移 2px（详情正文）

---

## 7. 组件库

### 7.1 Record Card（知识卡片）

横向布局：缩略图 + 主体（meta + title + summary + detail-btn）。hover 时整张卡片右移、加圆角与背景、标题底部下划线从左展开。

### 7.2 Category Tab（分类胶囊）

`border-radius: 16px`，默认 badge-bg 底，激活为 accent 底白字。hover `translateY(-1px)`。

### 7.3 Detail View（详情页）

- 顶部返回按钮 `.detail-back-link`（带阴影）
- 标题 24px/700，下方 meta 行（日期、分类徽章、格式徽章、可见性徽章）
- 正文 15px / line-height 1.85，h2 带下边框，blockquote 左 3px accent 边
- 浮动 TOC（`position: fixed`）+ 顶部 2px 阅读进度条
- 底部 prev/next 导航，hover 时 `translateX(±4px)`

### 7.4 Agent Sidebar（AI 对话栏）

- 独立配色（见 2.3），与主站视觉区分
- 气泡 `border-radius: 16px`，用户气泡右下角 4px，AI 气泡左下角 4px
- 头像 32px 圆形，AI 头像为 `linear-gradient(135deg, #6ee7b7, accent)`
- 输入区悬浮于底部，`border-radius: 20px`，focus 时 accent 描边 + 3px 阴影
- 流式输出带闪烁光标，工具调用显示 status pill
- 支持 `/` 斜杠命令面板（`.slash-panel`）

### 7.5 Nav-bar（图标导航栏）

44px 宽竖栏，32×32 图标按钮，hover 显示右侧 tooltip（黑底白字 11px）。底部头像支持弹出菜单。

### 7.6 Modal / Dialog

- 遮罩 `rgba(0,0,0,0.4)` + `backdrop-filter: blur(4px)`
- 内容 `border-radius: 10px`，`box-shadow: 0 8px 32px rgba(0,0,0,0.12)`
- 进场 `modalSlideIn 0.2s`

### 7.7 Toast

固定 `top: 72px; right: 20px`，accent 底白字，`border-radius: 6px`，2.5s 自动消失。

### 7.8 骨架屏

`.skeleton` 使用 `linear-gradient` + `shimmer` 动画，浅色 `surface→hover→surface` 渐变滚动。

---

## 8. 交互模式

- **主题切换**：`localStorage["zhiyi-theme"]` ∈ `light | dark | system`，`<html data-theme="dark">`，head 内联脚本防闪烁
- **语言切换**：`localStorage["kb-lang"]` ∈ `zh | en`，Cookie 同步
- **视图模式**：`localStorage["zhiyi-view-mode"]` ∈ `list | grid | compact`
- **键盘**：`Esc` 关闭所有弹层
- **登录态**：通过 `/api/auth/me` 探测，影响 private/public 列表与头像菜单

---

## 9. 内容渲染

`.detail-content` 与 `.agent-msg-html` 共享一套 Markdown 渲染样式：

- 行内 `code`：mono 字体，badge-bg 底，3px 圆角
- 代码块 `pre`：surface 底 + border，6px 圆角，横向滚动，右上角悬浮复制按钮（hover 显形）
- blockquote：左 3px accent 边 + hover 底色
- 表格：surface 表头，border 分隔
- 图片：`border-radius: 4px`

---

## 10. 设计原则速记

1. **单色优先**：用灰阶与字重制造层次，不引入额外色相
2. **蓝色仅留给 Agent**：聊天栏是唯一使用饱和色的区域
3. **动效克制**：所有过渡 ≤ 0.35s，使用 `--ease-out`
4. **隐藏 chrome**：滚动条、冗余边框一律隐藏
5. **CJK 友好**：字体栈、行高、字重均优先中文阅读
6. **暗色不只是反色**：dark 模式下 Agent 栏偏紫调，强调色翻转
7. **移动端堆叠**：≤640px 时三栏改纵向，保留功能不削减

---

## 参考文件

- [app/globals.css](file:///workspace/app/globals.css) — 主样式表（约 2900 行）
- [app/layout.tsx](file:///workspace/app/layout.tsx) — 主题/语言初始化
- [app/shell.tsx](file:///workspace/app/shell.tsx) — 三栏布局壳
- [app/nav-bar.tsx](file:///workspace/app/nav-bar.tsx) — 图标导航栏
- [app/agent-sidebar.tsx](file:///workspace/app/agent-sidebar.tsx) — AI 对话栏
- [openspec/change/sidebar-chat-theme-spec.md](file:///workspace/openspec/change/sidebar-chat-theme-spec.md) — 聊天主题规范
