import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { hashPassword, createToken } from "@/lib/auth";
import { verifyCode, getUserByEmail, createUser } from "@/lib/turso";
import { verifyCaptchaToken } from "@/lib/captcha";

export async function POST(request: NextRequest) {
  try {
    const { email, password, code, captchaToken } = await request.json();

    if (!email || !password || !code || !captchaToken) {
      return NextResponse.json({ ok: false, error: "所有字段为必填项" }, { status: 400 });
    }

    // 验证滑块验证码（测试环境跳过）
    const captchaValid = process.env.NODE_ENV === "test" ? true : await verifyCaptchaToken(captchaToken);
    if (!captchaValid) {
      return NextResponse.json({ ok: false, error: "验证码已过期，请重新滑动验证" }, { status: 400 });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ ok: false, error: "邮箱格式不正确" }, { status: 400 });
    }

    // 密码长度检查
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "密码至少 6 位" }, { status: 400 });
    }

    // 检查邮箱是否已注册
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ ok: false, error: "该邮箱已注册，请直接登录" }, { status: 409 });
    }

    // 验证邮箱验证码
    const codeValid = await verifyCode(email, code);
    if (!codeValid) {
      return NextResponse.json({ ok: false, error: "验证码错误或已过期" }, { status: 400 });
    }

    // 创建用户
    const userId = randomUUID();
    const passwordHash = await hashPassword(password);
    await createUser(userId, email, passwordHash);

    // 生成 JWT 并自动登录
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
  } catch {
    return NextResponse.json({ ok: false, error: "注册失败，请重试" }, { status: 500 });
  }
}