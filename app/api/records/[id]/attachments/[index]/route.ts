import { NextRequest, NextResponse } from "next/server";
import { getRecord } from "@/lib/content";
import { verifyRequestAuth } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const { id, index } = await params;
  const idx = parseInt(index, 10);
  if (isNaN(idx) || idx < 0) {
    return NextResponse.json({ error: "Invalid attachment index" }, { status: 400 });
  }

  // 获取登录用户身份，用于访问私有记录的附件
  const username = await verifyRequestAuth(request);

  // 先尝试用登录用户身份获取记录（可访问私有记录）
  let record = await getRecord(id, username || undefined);
  // 已登录用户查看他人公开文章时，回退到公开查询
  if (!record && username) {
    record = await getRecord(id, undefined);
  }
  if (!record) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  const attachments = record.meta.attachments || [];
  const att = attachments[idx];
  if (!att) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  // URL 类型附件：302 重定向到来源
  if (att.type === "url" || att.type === "image") {
    return NextResponse.redirect(att.content);
  }

  // 文本类型附件（md/txt）：内联返回内容
  const contentType = att.type === "md" ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8";
  return new NextResponse(att.content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${att.path}"`,
    },
  });
}