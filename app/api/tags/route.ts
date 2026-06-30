import { getTags } from "@/lib/content";
import { NextResponse } from "next/server";

export async function GET() {
  const tags = await getTags();
  return NextResponse.json(tags);
}
