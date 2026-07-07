import { NextRequest, NextResponse } from "next/server";
import { semanticSearch } from "@/lib/zvec";
import { verifyRequestAuth, unauthorizedResponse } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const username = await verifyRequestAuth(req);
  if (!username) return unauthorizedResponse();

  try {
    const { query, limit } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const results = await semanticSearch(query, username, limit || 10);
    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}