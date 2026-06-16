import { requirePermission } from "@/lib/auth";
import {
  getAllSettings,
  isTypeEnabled,
  SETTING_KEYS,
  NOTIFY_DEFS,
  type NotifyType,
} from "@/lib/telegram";
import NotificationForm from "./NotificationForm";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requirePermission("notification.manage");
  const settings = await getAllSettings();

  const notifyDefs = (Object.keys(NOTIFY_DEFS) as NotifyType[]).map((t) => ({
    type: t,
    label: NOTIFY_DEFS[t].label,
    group: NOTIFY_DEFS[t].group,
    on: isTypeEnabled(settings, t),
  }));

  return (
    <>
      <h1>แจ้งเตือน Telegram</h1>
      <p className="muted">
        ตั้ง chat id ของ 2 กลุ่ม, เกณฑ์, และเปิด/ปิดการแจ้งเตือนแต่ละประเภท — แก้ได้โดยไม่ต้อง deploy ใหม่
        (token เก็บใน .env)
      </p>

      <NotificationForm
        settings={{
          teamChatId: settings[SETTING_KEYS.teamChatId] ?? "",
          headChatId: settings[SETTING_KEYS.headChatId] ?? "",
          bigDeposit: settings[SETTING_KEYS.bigDepositThreshold] ?? "",
          minCalls: settings[SETTING_KEYS.minCallsBeforeNoon] ?? "",
        }}
        notifyDefs={notifyDefs}
      />
    </>
  );
}
