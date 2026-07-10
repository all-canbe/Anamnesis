# 分类图标替换为 Lucide

## 修改了什么
- 安装 `lucide-react` 依赖
- 将 `src/lib/icons.tsx` 中 6 个分类图标从自定义 SVG 路径替换为 Lucide 图标组件
- 更新 `getCategorySvgPath()` 函数，使用 Lucide 图标的真实 SVG 路径（用于文章详情页内联渲染）
- 移除了不再使用的单个分类图标导出（FrontendIcon、BackendIcon、AIIcon、ReadingIcon、DevOpsIcon、DesignIcon）

## 图标对照

| 分类 | 旧图标（自定义 SVG） | 新图标（Lucide） |
|---|---|---|
| Frontend | 浏览器窗口 | Code2 |
| Backend | 服务器机架 | Server |
| AI/ML | 星形火花 | BrainCircuit |
| Reading | 书本轮廓 | BookOpen |
| DevOps | 循环齿轮 | Container |
| Design | 菱形 | Palette |

## 为何这样修改
- 自定义 SVG 图标风格不统一，部分辨识度较低
- Lucide 与项目已有的 Heroicons 风格一脉相承，统一性更好
- Lucide 图标规范、辨识度高，且 tree-shake 友好
- 保留了 `CategoryIcon` 和 `getCategorySvgPath` 的 API 接口不变，对现有代码零侵入

## 变更的意义
- 提升分类图标的视觉一致性和专业感
- 为后续文章默认图素材替换（unDraw）奠定基础
- TypeScript 编译和 Next.js 构建均通过，无破坏性变更