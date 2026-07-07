import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const username = await verifyRequestAuth(request);
  if (!username) {
    return NextResponse.json({ username: null }, { status: 401 });
  }
  return NextResponse.json({ username });
}