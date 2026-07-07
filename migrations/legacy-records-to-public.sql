-- 为旧表添加缺失的列（对已存在的列会自动跳过，不会报错）
-- 如果 Drizzle Studio 报 "no such column: user_id"，执行以下 SQL 即可

-- records 表
ALTER TABLE records ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE records ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE records ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
ALTER TABLE records ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE records ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]';

-- 将已有记录归属到 admin 并设为 public
UPDATE records SET user_id = 'admin' WHERE user_id = '';
UPDATE records SET visibility = 'public' WHERE user_id = 'admin';

-- tags 表
ALTER TABLE tags ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE tags ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
UPDATE tags SET user_id = 'admin', is_public = 1 WHERE user_id = '';