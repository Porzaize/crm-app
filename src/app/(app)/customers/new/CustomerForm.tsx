"use client";

import { useActionState } from "react";
import { createCustomer, type StatusState } from "../actions";
import { CUSTOMER_STATUS_LABELS } from "@/lib/labels";

const initial: StatusState = {};

type Opt = { id: number; name: string };

export default function CustomerForm({ brands, agents }: { brands: Opt[]; agents: Opt[] }) {
  const [state, formAction, pending] = useActionState(createCustomer, initial);

  return (
    <form action={formAction}>
      {state.error && <div className="alert error">{state.error}</div>}

      <div className="row">
        <div>
          <label htmlFor="phone">เบอร์โทร</label>
          <input id="phone" name="phone" type="text" inputMode="numeric" placeholder="0891234567" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="brandId">เว็บ</label>
          <select id="brandId" name="brandId" defaultValue="">
            <option value="" disabled>
              — เลือกเว็บ —
            </option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status">สถานะ</label>
          <select id="status" name="status" defaultValue="LAPSED">
            {Object.entries(CUSTOMER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="assignedToId">มอบหมายให้ (ไม่บังคับ)</label>
          <select id="assignedToId" name="assignedToId" defaultValue="">
            <option value="">— ไม่สร้างงานในคิว —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <small className="muted">ถ้าเลือกพนักงาน ระบบจะสร้างงานโทรในคิวให้ทันที (ยกเว้นสถานะห้ามโทร)</small>

      <div style={{ marginTop: "1rem" }}>
        <button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก…" : "เพิ่มลูกค้า"}
        </button>
      </div>
    </form>
  );
}
