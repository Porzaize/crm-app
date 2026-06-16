"use client";

import { useActionState, useState } from "react";
import { logCall, type LogCallState } from "../actions";
import { OUTCOME_LABELS } from "@/lib/labels";
import { renderTemplate, type SmsContext } from "@/lib/sms";

const initial: LogCallState = {};

type Template = { id: number; name: string; body: string };

/** Date -> ค่าสำหรับ <input type="datetime-local"> โดยอ่านเป็นเวลาไทย (UTC+7) */
function toLocalInput(d: Date): string {
  const b = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${b.getUTCFullYear()}-${p(b.getUTCMonth() + 1)}-${p(b.getUTCDate())}T${p(b.getUTCHours())}:${p(b.getUTCMinutes())}`;
}

/** วันนี้เวลาไทย + เพิ่มวัน แล้วตั้งชั่วโมง:นาที (เวลาไทย) */
function bangkokAtHour(addDays: number, hour: number, minute = 0): Date {
  const b = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const target = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + addDays, hour, minute);
  return new Date(target - 7 * 60 * 60 * 1000); // กลับเป็น instant จริง
}

export default function LogCallForm({
  contactId,
  templates,
  smsContext,
}: {
  contactId: number;
  templates: Template[];
  smsContext: SmsContext;
}) {
  const [state, formAction, pending] = useActionState(logCall, initial);
  const [nextCallAt, setNextCallAt] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [copied, setCopied] = useState(false);

  const selected = templates.find((t) => String(t.id) === templateId);
  const smsText = selected ? renderTemplate(selected.body, smsContext) : "";

  const presets: { label: string; get: () => Date }[] = [
    { label: "+1 ชม.", get: () => new Date(Date.now() + 60 * 60 * 1000) },
    { label: "พรุ่งนี้ 10:00", get: () => bangkokAtHour(1, 10) },
    { label: "+3 วัน", get: () => bangkokAtHour(3, 10) },
  ];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(smsText);
      setSmsSent(true); // ติ๊ก "ส่ง SMS หลังโทร" อัตโนมัติเมื่อคัดลอกแล้ว
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="contactId" value={contactId} />

      {state.error && <div className="alert error">{state.error}</div>}

      <div className="field">
        <label htmlFor="outcome">ผลสาย</label>
        <select id="outcome" name="outcome" defaultValue="">
          <option value="" disabled>
            — เลือกผลสาย —
          </option>
          {Object.entries(OUTCOME_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label style={{ fontWeight: 400 }}>
          <input type="checkbox" name="promo" style={{ width: "auto", marginRight: 6 }} />
          เสนอโปร 20%
        </label>
        <label style={{ fontWeight: 400 }}>
          <input
            type="checkbox"
            name="smsSent"
            checked={smsSent}
            onChange={(e) => setSmsSent(e.target.checked)}
            style={{ width: "auto", marginRight: 6 }}
          />
          ส่ง SMS หลังโทร
        </label>
      </div>

      {/* ส่ง SMS: เลือก template -> แสดงข้อความที่แทนค่าของลูกค้ารายนี้ -> คัดลอก */}
      <div className="field">
        <label htmlFor="smsTemplate">ข้อความ SMS</label>
        {templates.length === 0 ? (
          <small className="muted">ยังไม่มี template (หัวหน้าเพิ่มได้ที่เมนู “คลังข้อความ SMS”)</small>
        ) : (
          <>
            <input type="hidden" name="smsTemplateId" value={smsSent && selected ? selected.id : ""} />
            <select
              id="smsTemplate"
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setCopied(false);
              }}
            >
              <option value="">— เลือกข้อความ —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {selected && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: "0.6rem 0.8rem",
                    whiteSpace: "pre-wrap",
                    color: "#374151",
                  }}
                >
                  {smsText}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: 6 }}
                  onClick={handleCopy}
                >
                  {copied ? "✓ คัดลอกแล้ว" : "📋 คัดลอกข้อความ"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="field">
        <label htmlFor="nextCallAt">นัดโทรอีกครั้ง (ไม่บังคับ)</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className="btn-secondary"
              style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
              onClick={() => setNextCallAt(toLocalInput(p.get()))}
            >
              {p.label}
            </button>
          ))}
          {nextCallAt && (
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
              onClick={() => setNextCallAt("")}
            >
              ล้าง
            </button>
          )}
        </div>
        <input
          id="nextCallAt"
          name="nextCallAt"
          type="datetime-local"
          value={nextCallAt}
          onChange={(e) => setNextCallAt(e.target.value)}
        />
        <small className="muted">ถ้ากรอก รายการจะกลับเข้าคิวตามเวลานัด (เวลาไทย)</small>
      </div>

      <div className="field">
        <label htmlFor="note">บันทึกเพิ่มเติม</label>
        <textarea id="note" name="note" rows={3} placeholder="รายละเอียดการคุย…" />
      </div>

      <button type="submit" disabled={pending}>
        {pending ? "กำลังบันทึก…" : "บันทึกผลสาย"}
      </button>
    </form>
  );
}
