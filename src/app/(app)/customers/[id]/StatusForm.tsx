"use client";

import { useActionState } from "react";
import { updateCustomerStatus, type StatusState } from "../actions";
import { CUSTOMER_STATUS_LABELS } from "@/lib/labels";
import type { CustomerStatus } from "@prisma/client";

const initial: StatusState = {};

export default function StatusForm({
  customerId,
  current,
}: {
  customerId: number;
  current: CustomerStatus;
}) {
  const [state, formAction, pending] = useActionState(updateCustomerStatus, initial);

  return (
    <form action={formAction}>
      <input type="hidden" name="customerId" value={customerId} />
      {state.error && <div className="alert error">{state.error}</div>}
      {state.ok && <div className="alert success">{state.ok}</div>}

      <div className="field">
        <label htmlFor="status">สถานะ</label>
        <select id="status" name="status" defaultValue={current}>
          {Object.entries(CUSTOMER_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="reason">เหตุผล (บังคับเมื่อตั้งห้ามโทร)</label>
        <input id="reason" name="reason" type="text" placeholder="เช่น ลูกค้าขอไม่ให้โทร" />
      </div>
      <button type="submit" disabled={pending}>
        {pending ? "กำลังบันทึก…" : "บันทึกสถานะ"}
      </button>
    </form>
  );
}
