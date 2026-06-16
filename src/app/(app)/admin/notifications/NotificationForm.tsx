"use client";

import { useActionState } from "react";
import { saveNotificationSettings, testSend, type NotifState } from "./actions";

const initial: NotifState = {};

type NotifyDef = { type: string; label: string; group: string; on: boolean };

export default function NotificationForm({
  settings,
  notifyDefs,
}: {
  settings: { teamChatId: string; headChatId: string; bigDeposit: string; minCalls: string };
  notifyDefs: NotifyDef[];
}) {
  const [saveState, saveAction, savePending] = useActionState(saveNotificationSettings, initial);
  const [testState, testAction, testPending] = useActionState(testSend, initial);

  return (
    <>
      <form action={saveAction} className="card">
        <h2>กลุ่มปลายทาง & เกณฑ์</h2>
        {saveState.error && <div className="alert error">{saveState.error}</div>}
        {saveState.ok && <div className="alert success">{saveState.ok}</div>}

        <div className="field">
          <label htmlFor="team_chat_id">Chat ID กลุ่มทีม</label>
          <input
            id="team_chat_id"
            name="team_chat_id"
            type="text"
            defaultValue={settings.teamChatId}
            placeholder="เช่น -1001234567890"
          />
        </div>
        <div className="field">
          <label htmlFor="head_chat_id">Chat ID กลุ่มหัวหน้า</label>
          <input
            id="head_chat_id"
            name="head_chat_id"
            type="text"
            defaultValue={settings.headChatId}
            placeholder="เช่น -1009876543210"
          />
        </div>
        <div className="row">
          <div>
            <label htmlFor="big_deposit_threshold">เกณฑ์ยอดฝากใหญ่ (บาท)</label>
            <input
              id="big_deposit_threshold"
              name="big_deposit_threshold"
              type="text"
              defaultValue={settings.bigDeposit}
              placeholder="5000"
            />
          </div>
          <div>
            <label htmlFor="min_calls_before_noon">สายขั้นต่ำก่อนเที่ยง</label>
            <input
              id="min_calls_before_noon"
              name="min_calls_before_noon"
              type="text"
              defaultValue={settings.minCalls}
              placeholder="30"
            />
          </div>
        </div>

        <h2 style={{ marginTop: "1.5rem" }}>เปิด/ปิดการแจ้งเตือนรายประเภท</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {notifyDefs.map((d) => (
            <label key={d.type} style={{ fontWeight: 400, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                name={`notify_${d.type}`}
                defaultChecked={d.on}
                style={{ width: "auto" }}
              />
              {d.label}
              <span className="muted">→ {d.group === "team" ? "กลุ่มทีม" : "กลุ่มหัวหน้า"}</span>
            </label>
          ))}
        </div>

        <button type="submit" disabled={savePending} style={{ marginTop: "1rem" }}>
          {savePending ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
        </button>
      </form>

      <form action={testAction} className="card">
        <h2>ทดสอบส่ง</h2>
        {testState.error && <div className="alert error">{testState.error}</div>}
        {testState.ok && <div className="alert success">{testState.ok}</div>}
        <p className="muted">ส่งข้อความทดสอบไปยังกลุ่มที่ตั้ง chat id ไว้ (บันทึกการตั้งค่าก่อน)</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" name="group" value="team" className="btn-secondary" disabled={testPending}>
            ทดสอบกลุ่มทีม
          </button>
          <button type="submit" name="group" value="head" className="btn-secondary" disabled={testPending}>
            ทดสอบกลุ่มหัวหน้า
          </button>
        </div>
      </form>
    </>
  );
}
