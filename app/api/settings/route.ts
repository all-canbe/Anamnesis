import { NextRequest, NextResponse } from "next/server";
import { hasAgentConfig, saveAgentConfig } from "@/lib/agent-config";
import { verifyRequestAuth, unauthorizedResponse } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();

  try {
    const cfg = await hasAgentConfig(username);
    return NextResponse.json(cfg);
  } catch {
    return NextResponse.json({ configured: false, baseUrl: "", model: "" });
  }
}

export async function POST(request: NextRequest) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { baseUrl, apiKey, model } = body as {
      baseUrl: string;
      apiKey?: string;
      model: string;
    };

    if (!baseUrl) {
      return NextResponse.json(
        { error: "baseUrl is required" },
        { status: 400 }
      );
    }

    await saveAgentConfig(
      { baseUrl, apiKey: apiKey || "", model: model || "" },
      username,
      !apiKey,
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}