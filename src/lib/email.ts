// 邮箱验证码发送服务（基于 QQ 邮箱 SMTP）

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.qq.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || ""; // QQ邮箱授权码
const EMAIL_FROM = process.env.EMAIL_FROM || "";

export function isEmailConfigured(): boolean {
  return !!(SMTP_USER && SMTP_PASS);
}

/** 发送验证码邮件 */
export async function sendVerificationCode(email: string, code: string): Promise<{ ok: boolean; error?: string }> {
  if (!SMTP_USER || !SMTP_PASS) {
    return { ok: false, error: "邮件服务未配置" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // 465 使用 SSL，587 使用 STARTTLS
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: EMAIL_FROM || SMTP_USER,
      to: email,
      subject: "知忆 - 邮箱验证码",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a;">知忆 · 邮箱验证</h2>
          <p style="color: #666; font-size: 14px;">您的验证码是：</p>
          <div style="background: #f5f5f5; padding: 16px 24px; border-radius: 8px; text-align: center; margin: 16px 0;">
            <span style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #1a1a1a;">${code}</span>
          </div>
          <p style="color: #999; font-size: 12px;">验证码 10 分钟内有效，请勿泄露给他人。</p>
        </div>
      `,
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "邮件发送异常" };
  }
}