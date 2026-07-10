# Footer 移出内容区修复

## 修改了什么
- 将 `app/shell.tsx` 中的 `<FooterBar />` 从 `<main className="site-main">` 内部移到 `shell-body` 外部。
- 修改前：footer 作为 `site-main` 的最后一个子元素，会随主内容区一起滚动。
- 修改后：footer 位于 `.shell` 的直接子级，固定在页面底部，不随内容列表滚动。

## 为何这样修改
- 原布局把 footer 放在可滚动的 `site-main` 内部，导致 footer 被包含在内容列表的滚动区域中。
- 当列表内容较短时，footer 会紧贴在分页器下方，视觉上像是“在内容列表里”；当内容较长时，需要滚动到底部才能看到 footer。
- 通过将 footer 提升到 `shell-body` 外部（与 `site-header`、`shell-body` 同级），`.shell` 的 `display: flex; flex-direction: column; height: 100vh` 会把 footer 推到底部，使其始终固定在视口底部。

## 变更的意义
- 页脚不再属于可滚动的主内容区，避免与记录列表、分页器混在一起。
- 页面整体布局符合常见的“header + body + footer”三段式结构。
- 记录列表较短时，footer 也不会上移进入内容区；记录较多时，用户无需滚动到底部即可看到固定的页脚。

## 涉及文件
- `app/shell.tsx`
