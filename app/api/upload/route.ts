import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth, unauthorizedResponse } from "@/lib/api-auth";

const QINIU_ACCESS_KEY = process.env.QINIU_ACCESS_KEY || "";
const QINIU_SECRET_KEY = process.env.QINIU_SECRET_KEY || "";
const QINIU_BUCKET = process.env.QINIU_BUCKET || "";
const QINIU_DOMAIN = process.env.QINIU_DOMAIN || "";

// Allowed file types and max size
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "text/markdown",
  "text/plain",
]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "md", "txt"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function isQiniuConfigured(): boolean {
  return !!(QINIU_ACCESS_KEY && QINIU_SECRET_KEY && QINIU_BUCKET);
}

function base64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha1(key: string, data: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyData = enc.encode(key);
  const dataData = enc.encode(data);
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, dataData);
}

async function generateQiniuToken(key: string): Promise<string> {
  const putPolicy = JSON.stringify({
    scope: `${QINIU_BUCKET}:${key}`,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  });
  const encodedPutPolicy = base64URL(new TextEncoder().encode(putPolicy).buffer);
  const sign = await hmacSha1(QINIU_SECRET_KEY, encodedPutPolicy);
  const encodedSign = base64URL(sign);
  return `${QINIU_ACCESS_KEY}:${encodedSign}:${encodedPutPolicy}`;
}

export async function POST(request: NextRequest) {
  // Auth check
  const auth = await verifyRequestAuth(request);
  if (!auth) return unauthorizedResponse();

  try {
    if (!isQiniuConfigured()) {
      return NextResponse.json({ error: "Qiniu Kodo not configured" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 10MB." }, { status: 413 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    // Validate file extension
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File type ".${ext}" not allowed. Supported: ${[...ALLOWED_EXTENSIONS].join(", ")}` },
        { status: 400 }
      );
    }

    // Validate MIME type
    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `MIME type "${mimeType}" not allowed.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const token = await generateQiniuToken(key);
    const uploadUrl = `https://upload.qiniup.com`;

    const uploadFormData = new FormData();
    uploadFormData.append("token", token);
    uploadFormData.append("key", key);
    uploadFormData.append("file", new Blob([buffer], { type: mimeType }), file.name);

    const res = await fetch(uploadUrl, {
      method: "POST",
      body: uploadFormData,
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Upload failed: ${res.status} ${text}` }, { status: 500 });
    }

    const result = await res.json();
    const publicUrl = QINIU_DOMAIN
      ? `https://${QINIU_DOMAIN}/${result.key}`
      : `https://${QINIU_BUCKET}.qiniu.com/${result.key}`;

    return NextResponse.json({ url: publicUrl, key: result.key });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}