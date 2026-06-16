"use client";

import { useActionState } from "react";
import {
  updateCustomer,
  assignToAgent,
  addDeposit,
  addBonus,
  type StatusState,
} from "../actions";
import type { CustomerStatus } from "@prisma/client";

const initial: StatusState = {};
type Opt = { id: number; name: string };

function Feedback({ state }: { state: StatusState }) {
  return (
    <>
      {state.error && <div className="alert error">{state.error}</div>}
      {state.ok && <div className="alert success">{state.ok}</div>}
    </>
  );
}

export default function ManageCustomer({
  customerId,
  phone,
  brandId,
  status,
  currentAssignee,
  brands,
  agents,
  todayYMD,
}: {
  customerId: number;
  phone: string;
  brandId: number;
  status: CustomerStatus;
  currentAssignee: string | null;
  brands: Opt[];
  agents: Opt[];
  todayYMD: string;
}) {
  const [editState, editAction, editPending] = useActionState(updateCustomer, initial);
  const [assignState, assignAction, assignPending] = useActionState(assignToAgent, initial);
  const [depState, depAction, depPending] = useActionState(addDeposit, initial);
  const [bonState, bonAction, bonPending] = useActionState(addBonus, initial);
  const isDNC = status === "DO_NOT_CALL";

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {/* แก้ไขข้อมูล */}
      <form action={editAction}>
        <h3 style={{ fontSize: "0.95rem", marginTop: 0 }}>แก้ไขข้อมูลลูกค้า</h3>
        <Feedback state={editState} />
        <input type="hidden" name="customerId" value={customerId} />
        <div className="row">
          <div>
            <label htmlFor="phone">เบอร์โทร</label>
            <input id="phone" name="phone" type="text" inputMode="numeric" defaultValue={phone} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="brandId">เว็บ</label>
            <select id="brandId" name="brandId" defaultValue={brandId}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end" }}>
            <button type="submit" disabled={editPending}>
              {editPending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        </div>
      </form>

      {/* มอบหมายงานโทร */}
      <form action={assignAction} style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
        <h3 style={{ fontSize: "0.95rem", marginTop: 0 }}>
          มอบหมายงานโทร
          {currentAssignee && <span className="muted" style={{ fontWeight: 400 }}> · ปัจจุบัน: {currentAssignee}</span>}
        </h3>
        <Feedback state={assignState} />
        <input type="hidden" name="customerId" value={customerId} />
        {isDNC ? (
          <p className="muted">ลูกค้าห้ามโทร — มอบหมายงานไม่ได้</p>
        ) : (
          <div className="row">
            <div>
              <label htmlFor="assignedToId">พนักงาน</label>
              <select id="assignedToId" name="assignedToId" defaultValue="">
                <option value="" disabled>
                  — เลือกพนักงาน —
                </option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end" }}>
              <button type="submit" className="btn-secondary" disabled={assignPending}>
                {assignPending ? "กำลังมอบหมาย…" : "มอบหมาย / เข้าคิว"}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* บันทึกยอดฝาก / โบนัส */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <form action={depAction}>
          <h3 style={{ fontSize: "0.95rem", marginTop: 0 }}>บันทึกยอดฝาก</h3>
          <Feedback state={depState} />
          <input type="hidden" name="customerId" value={customerId} />
          <div className="field">
            <label htmlFor="dep-amount">จำนวนเงิน (บาท)</label>
            <input id="dep-amount" name="amount" type="number" step="0.01" min="0" placeholder="เช่น 1000" />
          </div>
          <div className="field">
            <label htmlFor="dep-date">วันที่</label>
            <input id="dep-date" name="date" type="date" defaultValue={todayYMD} />
          </div>
          <button type="submit" className="btn-secondary" disabled={depPending}>
            {depPending ? "กำลังบันทึก…" : "บันทึกยอดฝาก"}
          </button>
        </form>

        <form action={bonAction}>
          <h3 style={{ fontSize: "0.95rem", marginTop: 0 }}>บันทึกโบนัส</h3>
          <Feedback state={bonState} />
          <input type="hidden" name="customerId" value={customerId} />
          <div className="field">
            <label htmlFor="bon-amount">จำนวนเงิน (บาท)</label>
            <input id="bon-amount" name="amount" type="number" step="0.01" min="0" placeholder="เช่น 200" />
          </div>
          <div className="field">
            <label htmlFor="bon-date">วันที่</label>
            <input id="bon-date" name="date" type="date" defaultValue={todayYMD} />
          </div>
          <button type="submit" className="btn-secondary" disabled={bonPending}>
            {bonPending ? "กำลังบันทึก…" : "บันทึกโบนัส"}
          </button>
        </form>
      </div>
    </div>
  );
}
