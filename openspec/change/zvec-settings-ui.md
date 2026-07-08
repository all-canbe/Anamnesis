# Zvec 向量数据库设置 UI

## 修改了什么

在设置页面新增"Vector Search"配置组，包含 Zvec 开关和 Embedding 模型配置，以及完整的后端存储链路。

**涉及文件：**

| 文件 | 变更 |
|------|------|
| `src/lib/icons.tsx` | 新增 `InfoIcon`（`InformationCircleIcon`） |
| `src/lib/agent-config.ts` | `AgentConfig` 接口新增 `embeddingModel` 和 `zvecEnabled`；`saveAgentConfig`/`hasAgentConfig`/`getAgentConfig`/`writeEnvLocal` 均扩展支持新字段 |
| `app/api/settings/route.ts` | POST 请求体新增 `embeddingModel` 和 `zvecEnabled` 字段 |
| `app/settings-dialog.tsx` | 新增 Vector Search 设置组：Zvec 开关（带 `!` tooltip）+ Embedding 模型输入框（Zvec 开启时显示） |
| `app/globals.css` | 新增 `.info-tooltip-wrapper` / `.info-tooltip` 纯 CSS tooltip 样式 |
| `tests/agent-config.test.ts` | 修复 mock 签名，新增 `embeddingModel`/`zvecEnabled` 字段 |
| `tests/agent-loop.test.ts` | `makeConfig()` 新增缺失字段 |
| `tests/security-regression.test.ts` | `makeConfig()` 新增缺失字段 |

## 为何这样修改

- **Zvec 开关**默认关闭，保持现有行为不变（内存索引）
- **`!` 图标**悬停显示 tooltip 说明当前内存索引状态，降低用户理解门槛
- **Embedding 模型**字段仅在 Zvec 开启时显示，减少 UI 复杂度
- 使用**纯 CSS tooltip**，无额外依赖，与项目现有风格一致
- 配置存储复用现有 Turso `getSetting`/`setSetting` 机制，按用户隔离
- embedding 模型同时写入 `.env.local`，确保 `embedding.ts` 模块能通过环境变量读取

## 变更的意义

- 为后续**真实 Zvec 数据库集成**提供前端配置入口
- 用户可通过设置页控制是否启用向量检索持久化
- 向量模型可灵活配置（如切换 BGE、OpenAI embedding 等）
- 配置存储已就绪，后续只需在 `zvec.ts` 中根据 `zvecEnabled` 和 `embeddingModel` 切换真实 Zvec 数据库实现