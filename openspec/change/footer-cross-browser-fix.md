# Footer 跨浏览器定位修复

## 修改了什么

1. **CSS 布局加固（app/globals.css）**
   - `.page-view` 从 `flex: 1; min-height: 0` 改为 `flex: 1 0 auto`，移除了可能在部分浏览器引发高度计算异常的 `min-height: 0`。
   - `.site-footer` 添加 `margin-top: auto`，在 `.site-main` 这个 flex 列容器中把 footer 稳定推到剩余空间底部。

2. **修复 viewMode 的 hydration 不一致（app/layout.tsx + app/shell.tsx）**
   - 服务端在 `layout.tsx` 中读取 `zhiyi-view-mode` cookie，解析为 `initialViewMode` 透传给 `Shell`。
   - `Shell` 使用 `initialViewMode` 作为 `viewMode` 的初始状态，并在切换视图时同步写入 cookie 和 localStorage。
   - 避免服务端渲染与客户端首屏因视图模式不同产生 DOM 差异，进而降低 React hydration 后 DOM 错乱的概率。

## 为何这样修改

之前 footer 出现在内容卡片里，本质是两件事叠加：

- **flex 高度计算在浏览器间存在差异**：`.page-view` 使用 `flex: 1; min-height: 0` 在某些浏览器下没有把内容区撑满，导致 footer 没有沉底，视觉上“漂”到卡片区域。
- **hydration 不匹配可能让 React 补丁出错**：`viewMode`  previously 硬编码初始值为 `list`，客户端再从 localStorage 覆盖。若用户保存的是 grid/compact，服务端和客户端首屏 DOM 结构不同，React 复用节点时容易把 footer 插到错误位置。

通过 `flex: 1 0 auto` + `margin-top: auto` 的双重保险，以及服务端同步初始视图模式，可以从布局和 DOM 一致性两个维度消除 footer 错位。

## 变更的意义

- footer 在 Chrome/Firefox/Safari/Edge 等主流浏览器中稳定位于中间列表底部，不再漂入内容卡片。
- 消除一项潜在 hydration mismatch，减少未来因状态不同步导致的 DOM 结构异常。
- 视图模式现在通过 cookie 与服务端保持一致，首屏不再出现视图切换的闪烁。

## 相关文件

- [app/globals.css](/app/globals.css)
- [app/layout.tsx](/app/layout.tsx)
- [app/shell.tsx](/app/shell.tsx)
