"use client";

import { useActionState } from "react";
import { createBrand, type BrandState } from "./actions";

const initial: BrandState = {};

export default function BrandAddForm() {
  const [state, formAction, pending] = useActionState(createBrand, initial);
  return (
    <form action={formAction}>
      {state.error && <div className="alert error">{state.error}</div>}
      {state.ok && <div className="alert success">{state.ok}</div>}
      <div className="row">
        <div>
          <label htmlFor="name">ชื่อเว็บ</label>
          <input id="name" name="name" type="text" placeholder="เช่น เป๋าตุง168" autoComplete="off" />
        </div>
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end" }}>
          <button type="submit" disabled={pending}>
            {pending ? "กำลังเพิ่ม…" : "เพิ่มเว็บ"}
          </button>
        </div>
      </div>
    </form>
  );
}
