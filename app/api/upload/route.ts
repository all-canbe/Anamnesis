import { NextRequest, NextResponse } from "next/server";

const R2_ENDPOINT = process.env.R2_ENDPOINT || "";
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || "";
const R2_SECRET_KEY = process.env.R2_SECRET_KEY || "";
const R2_BUCKET = process.env.R2_BUCKET || "zhiyi-uploads";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

function isR2Configured(): boolean {
  return !!(R2_ENDPOINT && R2_ACCESS_KEY && R2_SECRET_KEY);
}

export async function POST(request: NextRequest) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json({ error: "R2 not configured" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "bin";
    const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const url = `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `AWS ${R2_ACCESS_KEY}:${R2_SECRET_KEY}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: buffer,
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Upload failed: ${res.status}` }, { status: 500 });
    }

    const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : url;

    return NextResponse.json({ url: publicUrl, key });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
