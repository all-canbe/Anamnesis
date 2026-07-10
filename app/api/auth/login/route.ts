import { NextRequest, NextResponse } from "next/server";
import { validateEmailLogin, validateAdminLogin, createToken } from "@/lib/auth";
import { verifyCaptchaToken } from "@/lib/captcha";
import { checkRateLimit, clearRateLimit, resetAllRateLimits } from "@/lib/rate-limit";

/** 重置所有限流状态（仅供测试使用） */
export async function _resetLoginRateLimit(): Promise<void> {
  await resetAllRateLimits();
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, captchaToken } = await request.json();

    if (!email || !password || !captchaToken) {
      return NextResponse.json(
        { ok: false, error: "所有字段为必填项" },
        { status: 400 }
      );
    }

    // 验证滑块验证码（测试环境跳过）
    const captchaValid = process.env.NODE_ENV === "test" ? true : await verifyCaptchaToken(captchaToken);
    if (!captchaValid) {
      return NextResponse.json(
        { ok: false, error: "验证码已过期，请重新滑动验证" },
        { status: 400 }
      );
    }

    // 限流：IP + 邮箱（基于数据库，跨实例共享）
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const ipKey = `login:ip:${ip}`;
    const userKey = `login:user:${email.toLowerCase()}`;

    const [ipAllowed, userAllowed] = await Promise.all([
      checkRateLimit(ipKey),
      checkRateLimit(userKey),
    ]);

    if (!ipAllowed || !userAllowed) {
      return NextResponse.json(
        { ok: false, error: "登录尝试过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    // 尝试邮箱登录
    const userId = await validateEmailLogin(email, password);
    if (userId) {
      await Promise.all([clearRateLimit(ipKey), clearRateLimit(userKey)]);
      const token = await createToken(userId);
      const response = NextResponse.json({ ok: true, token, email });
      response.cookies.set("zhiyi_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 24 * 60 * 60,
      });
      return response;
    }

    // 兼容旧 admin 登录
    const adminValid = await validateAdminLogin(email, password);
    if (adminValid) {
      await Promise.all([clearRateLimit(ipKey), clearRateLimit(userKey)]);
      const token = await createToken("admin");
      const response = NextResponse.json({ ok: true, token, email: "admin" });
      response.cookies.set("zhiyi_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 24 * 60 * 60,
      });
      return response;
    }

    return NextResponse.json(
      { ok: false, error: "邮箱或密码错误" },
      { status: 401 }
    );
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("JWT_SECRET")
      ? "服务器认证配置错误，请联系管理员（JWT_SECRET 未配置）"
      : "请求处理失败";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 400 }
    );
  }
}