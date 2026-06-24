import { NextResponse } from "next/server";
import { checkCronAuth, notify } from "@/lib/telegram";
import { buildWeeklySummary } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// สรุปรายสัปดาห์ (ตั้งเวลา จันทร์ 08:00 ไทย) -> กลุ่มหัวหน้า
export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const text = await buildWeeklySummary();
  const sent = await notify("weekly_summary", text);
  return NextResponse.json({ ok: true, sent });
}
