import { NextResponse } from "next/server";
import { createToken } from "@/lib/auth";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { ok: false, error: "Only available in development mode" },
      { status: 403 }
    );
  }

  const username = process.env.ADMIN_USERNAME || "admin";
  const token = await createToken(username);
  const response = NextResponse.json({ ok: true, username });
  response.cookies.set("zhiyi_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60,
  });
  return response;
}