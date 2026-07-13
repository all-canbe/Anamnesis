import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth, unauthorizedResponse } from "@/lib/api-auth";
import { updateUsername, getUserById } from "@/lib/turso";

export async function GET(request: NextRequest) {
  const userId = await verifyRequestAuth(request);
  if (!userId) return unauthorizedResponse();
  if (userId === "admin") {
    return NextResponse.json({ username: "admin", email: "admin" });
  }
  try {
    const user = await getUserById(userId);
    return NextResponse.json({
      username: user?.username || userId,
      email: user?.email || userId,
    });
  } catch {
    return NextResponse.json({ username: userId, email: userId });
  }
}

export async function PATCH(request: NextRequest) {
  const userId = await verifyRequestAuth(request);
  if (!userId) return unauthorizedResponse();
  if (userId === "admin") {
    return NextResponse.json({ ok: false, error: "Admin 用户名不可修改" }, { status: 403 });
  }
  try {
    const { username } = await request.json();
    if (!username || typeof username !== "string" || username.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "用户名不能为空" }, { status: 400 });
    }
    if (username.length > 30) {
      return NextResponse.json({ ok: false, error: "用户名不能超过 30 个字符" }, { status: 400 });
    }
    await updateUsername(userId, username.trim());
    return NextResponse.json({ ok: true, username: username.trim() });
  } catch {
    return NextResponse.json({ ok: false, error: "修改失败" }, { status: 500 });
  }
}
