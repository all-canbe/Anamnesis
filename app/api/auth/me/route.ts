import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/api-auth";
import { getUserById } from "@/lib/turso";

export async function GET(request: NextRequest) {
  const userId = await verifyRequestAuth(request);
  if (!userId) {
    return NextResponse.json({ email: null }, { status: 401 });
  }
  if (userId === "admin") {
    return NextResponse.json({ email: "admin", username: "admin" });
  }
  try {
    const user = await getUserById(userId);
    return NextResponse.json({
      email: user?.email || userId,
      username: user?.username || userId,
    });
  } catch {
    return NextResponse.json({ email: userId, username: userId });
  }
}