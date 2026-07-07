# Git 工作区清理与文档整理

## 修改了什么

1. **移动开发文档**：将 `docs/` 目录下的 6 个开发/规划文档移至 `openspec/change/`：
   - `sidebar-chat-theme-spec.md`（侧边栏对话主题配色规范）
   - `侧边对话栏.html`
   - `2026-06-29-agent-system-plan.md`（Agent 系统实现计划）
   - `2026-06-29-mykb-next-phase-plan.md`（下一阶段完善计划）
   - `2026-06-29-project-status.md`（项目完成情况与展示计划）
   - `mykb-showcase.html`

2. **删除临时文件**：
   - `fix_sidebar.py`（调试用的 Python 脚本）
   - `test_write.txt`（测试写入的临时文件）

3. **更新 `.gitignore`**：添加以下忽略规则：
   - `.trae/` — IDE 自动生成的文档目录
   - `.workbuddy/` — 工具自动生成的记忆目录
   - `PROJECT_BLUEPRINT.md` — 自动生成的项目蓝图
   - `QA-REPORT.md` — 自动生成的 QA 报告
   - `deliverables/` — 自动生成的交付物目录

## 为何这样修改

- `docs/` 目录应只存放面向用户的文档（如 `mykb-intro-article.md` 项目介绍），开发过程中的规划文档应归入 `openspec/change/`
- 临时文件不应进入版本控制
- 自动生成的文件（IDE 产物、工具报告）应被 gitignore 避免误提交

## 变更的意义

- 保持工作区整洁，区分用户文档与开发文档
- 避免自动生成文件污染 git 历史
- 后续 `git status` 将更清晰，只显示实际代码变更
