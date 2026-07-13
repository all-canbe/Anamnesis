import { NextRequest, NextResponse } from "next/server";
import { hasAgentConfig, saveAgentConfig } from "@/lib/agent-config";
import { resetZvecMode } from "@/lib/zvec";
import { verifyRequestAuth, unauthorizedResponse } from "@/lib/api-auth";

/** 服务端向量搜索总开关；设置为 false 时强制关闭 Zvec，避免线上部署误用本地向量数据库 */
const VECTOR_SEARCH_ENABLED = process.env.ENABLE_VECTOR_SEARCH !== "false";

export async function GET(request: NextRequest) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();

  try {
    const cfg = await hasAgentConfig(username);
    return NextResponse.json({
      ...cfg,
      zvecEnabled: VECTOR_SEARCH_ENABLED ? cfg.zvecEnabled : false,
    });
  } catch {
    return NextResponse.json({ configured: false, baseUrl: "", model: "" });
  }
}

export async function POST(request: NextRequest) {
  const username = await verifyRequestAuth(request);
  if (!username) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { baseUrl, apiKey, model, embeddingBaseUrl, embeddingApiKey, embeddingModel, zvecEnabled } = body as {
      baseUrl: string;
      apiKey?: string;
      model: string;
      embeddingBaseUrl?: string;
      embeddingApiKey?: string;
      embeddingModel?: string;
      zvecEnabled?: boolean;
    };

    if (!baseUrl) {
      return NextResponse.json(
        { error: "baseUrl is required" },
        { status: 400 }
      );
    }

    const effectiveZvecEnabled = VECTOR_SEARCH_ENABLED && !!zvecEnabled;

    await saveAgentConfig(
      {
        baseUrl,
        apiKey: apiKey || "",
        model: model || "",
        embeddingBaseUrl: embeddingBaseUrl || "",
        embeddingApiKey: embeddingApiKey || "",
        embeddingModel: embeddingModel || "",
        zvecEnabled: effectiveZvecEnabled,
      },
      username,
      !apiKey,
    );
    resetZvecMode();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}