import { NextResponse } from "next/server";
import { loadSlashCommands } from "@/lib/skill-registry";

export async function GET() {
  const commands = loadSlashCommands();
  return NextResponse.json({ commands });
}
