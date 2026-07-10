# 变更总结：退出登录菜单溢出修复与列表工具栏移除

## 修改了什么

### 1. 修复退出登录菜单溢出显示问题
- **文件**: [app/globals.css](file:///e:/skills_test/mykb/app/globals.css)
- **变更**: 将 `.nav-bar-avatar-menu` 的定位从头像上方居中改为头像右侧垂直居中：
  - `bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%)`
  - 改为 `left: calc(100% + 6px); top: 50%; transform: translateY(-50%)`
  - 新增 `white-space: nowrap` 防止文字折行

### 2. 移除列表页工具栏及相关功能
- **文件**: [app/records-client.tsx](file:///e:/skills_test/mykb/app/records-client.tsx)
- **移除内容**:
  - 工具栏 JSX（标签管理、草稿、图片上传、快速导入四个按钮及排序下拉框）
  - 上传结果提示、快速导入面板、草稿编辑器、标签管理器、标签过滤条
  - 对应的状态：`showTagManager`、`tags`、`tagFilter`、`tagLoading`、`showDraft`、`draftContent`、`draftSaved`、`uploading`、`uploadedUrl`、`showQuickImport`、`importUrl`、`importing`、`importResult`、`sortBy`
  - 对应的副作用：草稿自动恢复/保存、标签加载
  - 对应的处理函数：`updateTagColor`、`handleQuickImport`、`handleImageUpload`
  - 不再使用的图标导入：`SortIcon`、`ImageIcon`、`UploadIcon`、`CheckIcon`、`EditIcon`、`PaintIcon`、`TagIcon`、`CloseIcon`、`DownloadIcon`
- **调整**: `filteredRecords` 移除了 `tagFilter` 与 `sortBy` 的过滤/排序逻辑，仅保留关键词过滤。

- **文件**: [app/globals.css](file:///e:/skills_test/mykb/app/globals.css)
- **移除内容**: 整个 `SORTING` 区块的 CSS（`.list-toolbar`、`.list-toolbar-actions`、`.list-sort` 等），因对应 JSX 已删除，变为死代码。

## 为何这样修改

1. **退出菜单**: 左侧导航栏宽度仅 44px，原菜单在头像上方居中展开时，最小宽度 100px 的菜单会向左超出视口边缘，导致 "Logout" 文字被截断显示为 "gout"。改为在头像右侧水平弹出后，菜单完全位于可视区域内，不再被截断。
2. **列表工具栏**: 用户明确要求去掉图二所示的工具栏功能。该工具栏包含的四个按钮是这些功能的唯一入口，移除按钮后对应面板与状态函数均变为不可达代码，按项目规范一并清理，避免遗留死代码。

## 变更的意义

- 修复了视觉上的文字截断/溢出 bug，提升 UI 稳定性。
- 简化了列表页界面，移除了用户不需要的功能入口。
- 清理了因此次变更产生的死代码（未使用的 state、effect、函数、图标导入和 CSS），保持代码库整洁。
- 保留搜索、分类切换、分页等核心列表功能不变。

## 验证

- 运行 `npx tsc --noEmit` 通过，无 TypeScript 错误。
