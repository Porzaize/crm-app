import { NextResponse } from "next/server";
import { checkCronAuth, notify } from "@/lib/telegram";
import { buildMorningQueue } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// คิวเช้า (ตั้งเวลา 09:00 ไทย) -> กลุ่มทีม
export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const text = await buildMorningQueue();
  const sent = await notify("morning_queue", text);
  return NextResponse.json({ ok: true, sent });
}
