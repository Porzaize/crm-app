"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  setSetting,
  sendTelegram,
  getAllSettings,
  chatIdFor,
  escapeHtml,
  SETTING_KEYS,
  NOTIFY_DEFS,
  type NotifyType,
} from "@/lib/telegram";
import { formatDateTime } from "@/lib/labels";

export type NotifState = { error?: string; ok?: string };

const NOTIFY_TYPES = Object.keys(NOTIFY_DEFS) as NotifyType[];

export async function saveNotificationSettings(
  _prev: NotifState,
  formData: FormData
): Promise<NotifState> {
  await requirePermission("notification.manage");

  const team = String(formData.get("team_chat_id") ?? "").trim();
  const head = String(formData.get("head_chat_id") ?? "").trim();
  const bigDeposit = String(formData.get("big_deposit_threshold") ?? "").trim();
  const minCalls = String(formData.get("min_calls_before_noon") ?? "").trim();

  // ตรวจเกณฑ์ตัวเลข
  if (bigDeposit && !/^\d+(\.\d+)?$/.test(bigDeposit)) return { error: "เกณฑ์ยอดฝากใหญ่ต้องเป็นตัวเลข" };
  if (minCalls && !/^\d+$/.test(minCalls)) return { error: "เกณฑ์สายขั้นต่ำต้องเป็นจำนวนเต็ม" };

  await setSetting(SETTING_KEYS.teamChatId, team);
  await setSetting(SETTING_KEYS.headChatId, head);
  if (bigDeposit) await setSetting(SETTING_KEYS.bigDepositThreshold, bigDeposit);
  if (minCalls) await setSetting(SETTING_KEYS.minCallsBeforeNoon, minCalls);

  // สวิตช์เปิด/ปิดรายประเภท — checkbox ติ๊ก = "1", ไม่ติ๊ก = "0"
  for (const t of NOTIFY_TYPES) {
    const on = formData.get(`notify_${t}`) === "on";
    await setSetting(`notify_${t}`, on ? "1" : "0");
  }

  revalidatePath("/admin/notifications");
  return { ok: "บันทึกการตั้งค่าแล้ว" };
}

export async function testSend(_prev: NotifState, formData: FormData): Promise<NotifState> {
  await requirePermission("notification.manage");
  const group = String(formData.get("group") ?? "") as "team" | "head";
  if (group !== "team" && group !== "head") return { error: "กลุ่มไม่ถูกต้อง" };

  const settings = await getAllSettings();
  const chatId = chatIdFor(settings, group);
  if (!chatId) return { error: `ยังไม่ได้ตั้ง chat id ของกลุ่ม${group === "team" ? "ทีม" : "หัวหน้า"}` };

  const label = group === "team" ? "ทีม" : "หัวหน้า";
  const text =
    `🔔 <b>ทดสอบการแจ้งเตือน</b>\n` +
    `กลุ่ม: ${escapeHtml(label)}\n` +
    `เวลา: ${escapeHtml(formatDateTime(new Date()))}\n` +
    `ระบบ CRM ติดตามลูกค้า`;

  const ok = await sendTelegram(chatId, text);
  return ok
    ? { ok: `ส่งข้อความทดสอบไปกลุ่ม${label}แล้ว` }
    : { error: `ส่งไม่สำเร็จ — ตรวจ chat id/token (ดู log)` };
}
