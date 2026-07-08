# Zvec 真实数据库集成

## 修改了什么

将 Zvec 从"纯内存数组索引"升级为"可控双模式"：内存索引（默认）+ `@zvec/zvec` 持久化嵌入式向量数据库（开关开启时）。

**源文件变更：**

| 文件 | 变更 |
|------|------|
| `package.json` | 新增 `@zvec/zvec` 依赖 |
| `src/lib/agent-config.ts` | `writeEnvLocal()` 移除 `EMBEDDING_MODEL` 写入 |
| `src/lib/embedding.ts` | `EMBEDDING_MODEL` 改为可变变量；新增 `setEmbeddingModel()` / `getEmbeddingModel()` |
| `src/lib/zvec.ts` | 全面重构：双模式架构，保持 6 个导出函数签名不变 |
| `tests/zvec.test.ts` | 新增 `agent-config` 和 `@zvec/zvec` mock |

## 为何这样修改

- **不再写入 `.env.local`**：embedding 模型配置改为运行时从 agent config 读取，避免文件污染
- **双模式架构**：`zvecEnabled = false` 时走内存索引（零依赖、零文件），`true` 时走 Zvec 持久化数据库（WAL 保证、崩溃恢复、重启不丢数据）
- **延迟模式判断**：首次调用时才读取 agent config 确定模式，避免启动时强制依赖
- **幂等初始** 化：同一用户多次调用 `initIndex` 不会重复重建索引
- **Zvec 集合 Schema**：1024 维向量（BGE-M3）+ 4 个标量字段（title/category/text/user_id），数据路径 `./zvec_data/{userId}/`

## 变更的意义

- 用户可通过设置页开关**实时控制**是否使用持久化向量数据库
- 开启后向量数据**服务重启不丢失**，无需每次重新 embedding
- Embedding 模型可**运行时切换**（如 BGE-M3 → OpenAI embedding），无需修改环境变量
- 为后续 Agent 知识库持久化、增量索引更新等场景提供基础设施