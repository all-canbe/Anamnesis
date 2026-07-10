import { getRecords } from "@/lib/content";
import { verifyRequestAuth, unauthorizedResponse } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();
  const { searchParams } = new URL(request.url);
  const visibility = searchParams.get("visibility") || undefined;
  const records = await getRecords(username, visibility);
  const counts: Record<string, number> = {};
  records.forEach((r: any) => {
    if (visibility && r.visibility !== visibility) return;
    counts[r.category] = (counts[r.category] || 0) + 1;
  });
  return NextResponse.json(counts);
}
