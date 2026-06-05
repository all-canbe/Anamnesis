import { getTags } from "@/lib/content";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(getTags());
}