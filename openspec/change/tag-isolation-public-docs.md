# 标签隔离 + 公开/私有文档 + 附件系统 + 前端适配

## 修改了什么

### 数据库层
- `tags` 表增加 `user_id TEXT` 和 `is_public INTEGER` 列，实现标签用户隔离
- `records` 表增加 `visibility TEXT` 和 `attachments TEXT` 列，支持文档可见性和附件存储

### 类型系统 (`src/lib/types.ts`)
- 新增 `Visibility` 类型：`"private" | "public"`
- 新增 `Attachment` 接口：`{ path, content, type }`
- `RecordMeta` 增加 `visibility` 和 `attachments?` 字段

### 数据层
- `turso.ts`：`tursoGetTags` 按用户过滤标签，`tursoAddTag`/`tursoDeleteTag` 增加用户隔离，新增 `tursoGetPublicRecords` 查询公开文档，`tursoWriteRecord` 支持 visibility/attachments
- `content.ts`：`getTags`/`addTag`/`deleteTag` 透传 userId，新增 `getPublicRecords`
- `skill-importer.ts`：Skill 导入从 N 条记录改为 1 条记录 + attachments 附件数组

### API 层
- `app/api/tags/route.ts`：重写为完整 CRUD，GET 返回公开标签+用户标签，POST 创建用户标签，DELETE 仅删除自己的标签
- `app/api/records/public/route.ts`：新增公开文档列表 API
- `app/api/cli/route.ts`：publish 命令增加 visibility 参数
- `app/api/record-counts/route.ts`：增加 visibility 查询参数支持

### 前端
- `nav-bar.tsx`：侧边栏增加 Private/Public/Files 三个按钮，通过 URL `?mode=public` 切换
- `shell.tsx`：增加 `listMode` 状态管理
- `page.tsx`：根据 `mode` 参数加载私有或公开文档列表
- `left-panel.tsx`：动态分类列表（从 API 获取标签和计数），支持分类点击导航
- `records-client.tsx`：动态分类 tabs（从 CATEGORIES 常量生成）
- `records/[id]/page.tsx`：详情页显示 visibility 标签和附件列表
- `globals.css`：新增附件区域样式
- `actions.ts`、`import-article.ts`、`agent-tools.ts`：meta 对象增加 `visibility: "private"`

### 测试
- `tests/turso.test.ts`：新增 `RecordMeta` 类型导入
- `tests/content.test.ts`：meta 对象增加 `visibility` 字段

## 为何这样修改

1. **标签隔离**：`tags` 表增加 `user_id` 和 `is_public`，用户只能创建和删除自己的标签，可查看和使用公开标签。admin 创建公开标签供所有用户使用。

2. **文档可见性**：仅 `private`/`public` 两种，简化了原本的 `private`/`public`/`skill` 三态设计。所有文档仅作者有编辑权，public 文档所有人可读。

3. **Skill 作为附件**：不再为每个 .md 文件创建独立记录，改为一条记录 + N 个附件。`attachments` 字段存储 JSON 数组 `[{path, content, type}]`，简化了知识库结构。

4. **侧边栏三按钮**：Private（MenuIcon）、Public（GlobeIcon）、Files（FolderIcon），默认显示私有列表，通过 URL search param 切换模式。

5. **动态分类**：left-panel 从 API 获取实时标签和计数，records-client 从 CATEGORIES 常量动态生成 tabs，消除硬编码。

## 变更的意义

- **用户数据隔离**：每个用户只能看到自己的标签和私有文档，公开文档可被所有人查看
- **Skill 管理简化**：一个 Skill 对应一条记录，附件形式存储所有文件，便于管理和检索
- **前端导航清晰**：三个按钮明确区分私有/公开/文件三种视图
- **向后兼容**：旧数据默认 `visibility = 'private'`，旧标签默认 `is_public = 1`