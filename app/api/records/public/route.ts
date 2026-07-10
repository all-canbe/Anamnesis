import { getPublicRecords } from "@/lib/content";
import { NextResponse } from "next/server";

export async function GET() {
  const records = await getPublicRecords();
  return NextResponse.json({ records });
}