// 简单滑块验证码：基于 JWT 的会话令牌机制

import { SignJWT, jwtVerify } from "jose";

const CAPTCHA_SECRET = process.env.JWT_SECRET || "captcha-fallback-secret";

/** 生成验证码令牌（有效期 5 分钟） */
export async function generateCaptchaToken(): Promise<string> {
  const secret = new TextEncoder().encode(CAPTCHA_SECRET);
  return new SignJWT({ type: "captcha" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);
}

/** 验证滑块验证码令牌 */
export async function verifyCaptchaToken(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(CAPTCHA_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload.type === "captcha";
  } catch {
    return false;
  }
}