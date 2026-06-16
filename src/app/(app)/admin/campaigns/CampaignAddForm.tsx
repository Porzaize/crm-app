"use client";

import { useActionState } from "react";
import { createCampaign, type CampaignState } from "./actions";

const initial: CampaignState = {};

export default function CampaignAddForm({ brands }: { brands: { id: number; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createCampaign, initial);
  return (
    <form action={formAction}>
      {state.error && <div className="alert error">{state.error}</div>}
      {state.ok && <div className="alert success">{state.ok}</div>}
      <div className="row">
        <div>
          <label htmlFor="name">ชื่อแคมเปญ</label>
          <input id="name" name="name" type="text" placeholder="เช่น ติดตามขาดฝาก ก.ค. 2026" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="brandId">เว็บ (ไม่บังคับ)</label>
          <select id="brandId" name="brandId" defaultValue="">
            <option value="">— ทุกเว็บ —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end" }}>
          <button type="submit" disabled={pending}>
            {pending ? "กำลังสร้าง…" : "สร้างแคมเปญ"}
          </button>
        </div>
      </div>
    </form>
  );
}
