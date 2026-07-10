import { NextResponse } from "next/server";
import { isTursoConfigured, query } from "@/lib/turso";

export async function GET() {
  const envKeys = {
    TURSO_DB_URL: !!process.env.TURSO_DB_URL,
    TURSO_DB_TOKEN: !!process.env.TURSO_DB_TOKEN,
    JWT_SECRET: !!process.env.JWT_SECRET,
    SMTP_HOST: !!process.env.SMTP_HOST,
    SMTP_USER: !!process.env.SMTP_USER,
    SMTP_PASS: !!process.env.SMTP_PASS,
    EMAIL_FROM: !!process.env.EMAIL_FROM,
    DEFAULT_ADMIN_PASSWORD_HASH: !!process.env.DEFAULT_ADMIN_PASSWORD_HASH,
    ADMIN_USERNAME: !!process.env.ADMIN_USERNAME,
  };

  const configured = isTursoConfigured();

  let tursoStatus = "not_configured";
  let tursoRowCount = 0;
  let tursoError: string | null = null;

  if (configured) {
    try {
      const rows = await query("SELECT COUNT(*) as cnt FROM records");
      tursoRowCount = rows[0]?.[0] ?? 0;
      tursoStatus = "ok";
    } catch (e: any) {
      tursoStatus = "error";
      tursoError = e.message || String(e);
    }
  }

  return NextResponse.json({
    envKeys,
    tursoConfigured: configured,
    tursoStatus,
    tursoRowCount,
    tursoError,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || "not_vercel",
  });
}