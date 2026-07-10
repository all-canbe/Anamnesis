// 基于 Turso 数据库的登录限流（无状态，跨 Serverless 实例共享）

import { query } from "./turso";

const DEFAULT_WINDOW_MINUTES = 5;
const DEFAULT_MAX = 5;

/** 检查并记录限流。返回 true 表示允许，false 表示超限 */
export async function checkRateLimit(key: string, max: number = DEFAULT_MAX, windowSeconds?: number): Promise<boolean> {
  try {
    // 清理过期记录
    await query("DELETE FROM rate_limits WHERE reset_at <= datetime('now')");

    const windowExpr = windowSeconds
      ? `datetime('now', '+${windowSeconds} seconds')`
      : `datetime('now', '+${DEFAULT_WINDOW_MINUTES} minutes')`;

    // 原子 upsert：窗口内则 +1，否则重置为 1
    await query(
      `INSERT INTO rate_limits (key, count, reset_at)
       VALUES (?, 1, ${windowExpr})
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN reset_at <= datetime('now') THEN 1 ELSE count + 1 END,
         reset_at = CASE WHEN reset_at <= datetime('now') THEN ${windowExpr} ELSE reset_at END`,
      [key]
    );

    // 读取当前计数
    const rows = await query(
      "SELECT count FROM rate_limits WHERE key = ? AND reset_at > datetime('now')",
      [key]
    );

    if (rows.length === 0) return true;
    const count = Number(rows[0][0]);
    return count <= max;
  } catch {
    return true;
  }
}

/** 清除限流记录（登录成功后调用） */
export async function clearRateLimit(key: string): Promise<void> {
  try {
    await query("DELETE FROM rate_limits WHERE key = ?", [key]);
  } catch {}
}

/** 重置所有限流状态（仅供测试使用） */
export async function resetAllRateLimits(): Promise<void> {
  try {
    await query("DELETE FROM rate_limits");
  } catch {}
}