// แจ้งเตือน Telegram (ข้อ 12)
// หมายเหตุ: ไม่ใส่ "server-only" เพราะสคริปต์ import (รันด้วย tsx นอก RSC) ก็ต้องเรียกได้ (เหมือน audit.ts)
// token อยู่ใน .env เท่านั้น (TELEGRAM_BOT_TOKEN) — chat id/เกณฑ์/สวิตช์ เก็บใน DB (NotificationSetting)
import { prisma } from "./db";

// ===== ส่งข้อความ =====
/**
 * ส่งข้อความเข้า chat — parse_mode HTML (จัดตัวหนา/บรรทัด)
 * ส่งไม่สำเร็จ: log error แล้วคืน false — ห้าม throw (งานหลักต้องไม่พังเพราะ Telegram ล่ม)
 */
export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("sendTelegram: ไม่ได้ตั้ง TELEGRAM_BOT_TOKEN");
    return false;
  }
  if (!chatId) {
    console.error("sendTelegram: chatId ว่าง");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`sendTelegram failed: HTTP ${res.status} ${body}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("sendTelegram error:", e);
    return false;
  }
}

/** escape อักขระพิเศษของ HTML parse_mode (& < >) */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ===== ตั้งค่า (NotificationSetting) =====
// คีย์ที่เป็น chat id / เกณฑ์ตัวเลข
export const SETTING_KEYS = {
  teamChatId: "team_chat_id",
  headChatId: "head_chat_id",
  bigDepositThreshold: "big_deposit_threshold",
  minCallsBeforeNoon: "min_calls_before_noon",
} as const;

export const SETTING_DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.bigDepositThreshold]: "5000",
  [SETTING_KEYS.minCallsBeforeNoon]: "30",
};

// ประเภทแจ้งเตือน: คีย์สวิตช์เปิด/ปิด + กลุ่มปลายทาง + ค่าเริ่ม
export type NotifyType =
  | "dnc"
  | "import"
  | "big_deposit"
  | "bonus"
  | "daily_summary"
  | "weekly_summary"
  | "morning_queue"
  | "slow_day";

export const NOTIFY_DEFS: Record<
  NotifyType,
  { label: string; group: "team" | "head"; defaultOn: boolean }
> = {
  dnc: { label: "ตั้งห้ามโทร (DNC)", group: "head", defaultOn: true },
  import: { label: "นำเข้าข้อมูลเสร็จ/พัง", group: "team", defaultOn: true },
  big_deposit: { label: "ยอดฝากใหญ่", group: "team", defaultOn: true },
  bonus: { label: "ปรับโบนัส", group: "head", defaultOn: true },
  daily_summary: { label: "สรุปรายวัน (20:00)", group: "team", defaultOn: true },
  weekly_summary: { label: "สรุปรายสัปดาห์ (จันทร์ 08:00)", group: "head", defaultOn: true },
  morning_queue: { label: "คิวเช้า (09:00)", group: "team", defaultOn: true },
  slow_day: { label: "เตือนโทรช้า (13:00)", group: "head", defaultOn: true },
};

const enabledKey = (t: NotifyType) => `notify_${t}`;

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await prisma.notificationSetting.findMany();
  const map: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.notificationSetting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key] ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.notificationSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export function isTypeEnabled(settings: Record<string, string>, type: NotifyType): boolean {
  const v = settings[enabledKey(type)];
  if (v == null) return NOTIFY_DEFS[type].defaultOn; // ยังไม่เคยตั้ง = ใช้ค่าเริ่ม
  return v !== "0";
}

export function chatIdFor(settings: Record<string, string>, group: "team" | "head"): string {
  return settings[group === "team" ? SETTING_KEYS.teamChatId : SETTING_KEYS.headChatId] ?? "";
}

/**
 * จุดส่งกลาง — เช็คว่าเปิดประเภทนี้ไหม + มี chat id ของกลุ่มไหม ก่อนส่งทุกครั้ง
 * (ปิดประเภทไหน = เงียบจริง; ไม่มี chat id = ข้าม + log)
 */
export async function notify(type: NotifyType, text: string): Promise<boolean> {
  const settings = await getAllSettings();
  if (!isTypeEnabled(settings, type)) return false;
  const chatId = chatIdFor(settings, NOTIFY_DEFS[type].group);
  if (!chatId) {
    console.warn(`notify(${type}): ยังไม่ได้ตั้ง chat id ของกลุ่ม ${NOTIFY_DEFS[type].group}`);
    return false;
  }
  return sendTelegram(chatId, text);
}

// ===== ป้องกัน /api/cron/* =====
/** ตรวจ header Authorization: Bearer <CRON_SECRET> — true ถ้าผ่าน */
export function checkCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("checkCronAuth: ไม่ได้ตั้ง CRON_SECRET");
    return false;
  }
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}
