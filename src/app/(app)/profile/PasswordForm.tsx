"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "./actions";

const initial: ChangePasswordState = {};

export default function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initial);

  return (
    <form action={formAction} key={state.ok ? "done" : "form"}>
      {state.error && <div className="alert error">{state.error}</div>}
      {state.ok && <div className="alert success">{state.ok}</div>}

      <div className="field">
        <label htmlFor="current">รหัสผ่านเดิม</label>
        <input id="current" name="current" type="password" autoComplete="current-password" />
      </div>
      <div className="field">
        <label htmlFor="next">รหัสผ่านใหม่</label>
        <input id="next" name="next" type="password" autoComplete="new-password" />
        <small className="muted">อย่างน้อย 6 ตัวอักษร</small>
      </div>
      <div className="field">
        <label htmlFor="confirm">ยืนยันรหัสผ่านใหม่</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" />
      </div>

      <button type="submit" disabled={pending}>
        {pending ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
      </button>
    </form>
  );
}
