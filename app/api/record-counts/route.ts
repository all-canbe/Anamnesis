import { getRecords } from "@/lib/content";
import { NextResponse } from "next/server";

export async function GET() {
  const records = getRecords();
  const counts: Record<string, number> = {};
  records.forEach((r) => { counts[r.category] = (counts[r.category] || 0) + 1; });
  return NextResponse.json(counts);
}