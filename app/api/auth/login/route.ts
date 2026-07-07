import { NextRequest, NextResponse } from "next/server";
import { validateCredentials, createToken } from "@/lib/auth";

// ─── 登录限流（IP + username 滑动窗口，5 次/5 分钟）───
const RATE_LIMIT_WINDOW = 5 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  // 清理所有已过期的条目，防止内存泄漏
  for (const [k, v] of loginAttempts) {
    if (now > v.resetAt) loginAttempts.delete(k);
  }
  const record = loginAttempts.get(key);
  if (!record) {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

function clearRateLimit(key: string): void {
  loginAttempts.delete(key);
}

/** 重置所有限流状态（仅供测试使用） */
export function _resetLoginRateLimit(): void {
  loginAttempts.clear();
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "username and password are required" },
        { status: 400 }
      );
    }

    // 限流：IP + username 双键
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipKey = `ip:${ip}`;
    const userKey = `user:${username}`;
    if (!checkRateLimit(ipKey) || !checkRateLimit(userKey)) {
      return NextResponse.json(
        { ok: false, error: "Too many login attempts, please try again later" },
        { status: 429 }
      );
    }

    const valid = await validateCredentials(username, password);
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // 登录成功：清除限流计数
    clearRateLimit(ipKey);
    clearRateLimit(userKey);

    const token = await createToken(username);
    const response = NextResponse.json({ ok: true, token, username });
    response.cookies.set("zhiyi_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60, // 24 hours
    });
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}