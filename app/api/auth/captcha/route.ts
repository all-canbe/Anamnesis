import { NextResponse } from "next/server";
import { generateCaptchaToken } from "@/lib/captcha";

/** 获取滑块验证码令牌 */
export async function GET() {
  const token = await generateCaptchaToken();
  return NextResponse.json({ ok: true, token });
}