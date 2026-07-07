# 文档详情骨架屏与实际详情展示对齐

## 修改了什么
- 重写了 `app/records/[id]/loading.tsx`：
  - 所有骨架占位统一使用 `div`，确保 `width`/`height` 作为块级元素生效。
  - 骨架容器与实际详情页共用 `.detail-view`，宽度由 `site-main` 的 `max-width` 一致约束。
  - 顶部 `Back` 返回按钮占位。
  - `detail-meta` 行保留 4 个占位：日期、分类 badge（Reading）、格式 badge（MD/HTML）、可见性 badge（Public/Private）。
  - `detail-title` 占位宽度改为 `100%`，与实际标题容器同宽。
  - `detail-thumbnail` 占位宽度 `100%`，保持 `minHeight: 200`。
  - `detail-attachments` 附件区域占位宽度 `100%`。
  - `detail-content` 正文占位全部改为 `100%` 宽度，避免视觉上过窄。
  - 底部 `detail-nav` 与 `similar-section` 占位均撑满容器宽度。

## 为何这样修改
- 上一版骨架屏的正文、标题等占位使用了 `75%`、`96%`、`92%` 等不饱满宽度，导致骨架屏看起来比实际详情页内容区窄。
- `detail-meta` 中格式 badge 的占位太窄，容易被误认为缺失。实际详情页 `page.tsx` 始终渲染日期、分类、格式、可见性 4 个标签，骨架屏需要与之对应。

## 变更的意义
- 骨架屏现在与实际详情页在容器宽度、结构层级和标签数量上保持一致，减少加载时的布局跳动。
- `next build` 通过，TypeScript 无错误。

## 验证
```bash
npm run build
# exit code 0
```

## 备注
- 实际详情页的 `.detail-meta` 经浏览器检查已包含 4 个子元素：`.detail-date`、`.category-badge`、`.detail-format-badge`（MD/HTML）、`.detail-format-badge`（Public/Private）。如用户截图中未看到格式标签，可能是该 badge 透明边框样式在特定截图/缩放下不易辨认，代码上已确认存在。
