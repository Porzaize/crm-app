import { NextResponse } from "next/server";
import { checkCronAuth, notify } from "@/lib/telegram";
import { buildDailySummary } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// สรุปรายวัน (ตั้งเวลา 20:00 ไทย) -> กลุ่มทีม
export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const text = await buildDailySummary();
  const sent = await notify("daily_summary", text);
  return NextResponse.json({ ok: true, sent });
}
