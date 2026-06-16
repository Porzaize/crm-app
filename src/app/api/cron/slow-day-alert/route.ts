import { NextResponse } from "next/server";
import { checkCronAuth, notify, getSetting, SETTING_KEYS } from "@/lib/telegram";
import { buildSlowDayAlert } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// เตือนโทรช้า (ตั้งเวลา 13:00 ไทย) -> กลุ่มหัวหน้า (ส่งเฉพาะเมื่อมีคนต่ำกว่าเกณฑ์)
export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const threshold = Number((await getSetting(SETTING_KEYS.minCallsBeforeNoon)) ?? "30") || 30;
  const text = await buildSlowDayAlert(threshold);
  if (!text) return NextResponse.json({ ok: true, sent: false, reason: "ทุกคนถึงเกณฑ์" });
  const sent = await notify("slow_day", text);
  return NextResponse.json({ ok: true, sent });
}
