"use client";

import { useActionState, useState } from "react";
import { createTemplate, updateTemplate, type TemplateState } from "./actions";
import { renderTemplate, buildSmsContext, TEMPLATE_VARS } from "@/lib/sms";

const initial: TemplateState = {};

// ตัวอย่างลูกค้าสำหรับพรีวิวสด ๆ ขณะพิมพ์
const SAMPLE = buildSmsContext({ brandName: "มรกต", phone: "0891234567" });

export default function TemplateForm({
  mode,
  template,
}: {
  mode: "create" | "edit";
  template?: { id: number; name: string; body: string };
}) {
  const action = mode === "create" ? createTemplate : updateTemplate;
  const [state, formAction, pending] = useActionState(action, initial);
  const [name, setName] = useState(template?.name ?? "");
  const [body, setBody] = useState(template?.body ?? "");

  const preview = renderTemplate(body, SAMPLE);

  return (
    <form action={formAction}>
      {mode === "edit" && <input type="hidden" name="id" value={template!.id} />}
      {state.error && <div className="alert error">{state.error}</div>}
      {state.ok && <div className="alert success">{state.ok}</div>}

      <div className="field">
        <label htmlFor={`name-${mode}-${template?.id ?? "new"}`}>ชื่อ template</label>
        <input
          id={`name-${mode}-${template?.id ?? "new"}`}
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น ทวงรัก + โปร 20%"
        />
      </div>

      <div className="field">
        <label htmlFor={`body-${mode}-${template?.id ?? "new"}`}>เนื้อความ</label>
        <textarea
          id={`body-${mode}-${template?.id ?? "new"}`}
          name="body"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="สวัสดีค่ะ ลูกค้า {{เว็บ}} รับ {{โปร}} วันนี้"
        />
        <small className="muted">
          ตัวแปร:{" "}
          {TEMPLATE_VARS.map((v) => (
            <code key={v.token} style={{ marginRight: 8 }} title={v.desc}>
              {v.token}
            </code>
          ))}
        </small>
      </div>

      <div className="field">
        <label>ตัวอย่าง (ลูกค้าเว็บมรกต)</label>
        <div
          style={{
            background: "var(--amber-bg, #fffbeb)",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: "0.6rem 0.8rem",
            whiteSpace: "pre-wrap",
            minHeight: "2.2rem",
            color: "#374151",
          }}
        >
          {preview || <span className="muted">— พิมพ์เนื้อความเพื่อดูตัวอย่าง —</span>}
        </div>
      </div>

      <button type="submit" disabled={pending}>
        {pending ? "กำลังบันทึก…" : mode === "create" ? "เพิ่ม template" : "บันทึก"}
      </button>
    </form>
  );
}
