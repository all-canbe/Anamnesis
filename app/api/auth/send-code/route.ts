import { NextRequest, NextResponse } from "next/server";
import { isEmailConfigured, sendVerificationCode } from "@/lib/email";
import { saveVerificationCodeWithInvalidate } from "@/lib/turso";
import { verifyCaptchaToken } from "@/lib/captcha";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";

function generateCode(): string {
  const arr = new Uint32Array(1);
  globalThis.crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

export async function POST(request: NextRequest) {
  try {
    const { email, captchaToken } = await request.json();

    if (!email || !captchaToken) {
      return NextResponse.json({ ok: false, error: "邮箱和验证码令牌为必填项" }, { status: 400 });
    }

    // 验证滑块验证码（测试环境跳过）
    const captchaValid = process.env.NODE_ENV === "test" ? true : await verifyCaptchaToken(captchaToken);
    if (!captchaValid) {
      return NextResponse.json({ ok: false, error: "验证码已过期，请重新滑动验证" }, { status: 400 });
    }

    // 简单邮箱格式校验
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ ok: false, error: "邮箱格式不正确" }, { status: 400 });
    }

    // 检查邮件服务是否配置
    if (!isEmailConfigured()) {
      return NextResponse.json({ ok: false, error: "邮件服务未配置，请联系管理员" }, { status: 500 });
    }

    // DB 限流：同一邮箱 60 秒内只能发送一次
    const rateKey = `sendcode:${email.toLowerCase()}`;
    const allowed = await checkRateLimit(rateKey, 1, 60);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "发送过于频繁，请 60 秒后再试" }, { status: 429 });
    }

    // 生成验证码
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // 保存到数据库（同时作废旧码）
    await saveVerificationCodeWithInvalidate(email, code, expiresAt);

    // 发送邮件
    const result = await sendVerificationCode(email, code);
    if (!result.ok) {
      clearRateLimit(rateKey);
      return NextResponse.json({ ok: false, error: result.error || "验证码发送失败" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "请求处理失败" }, { status: 500 });
  }
}