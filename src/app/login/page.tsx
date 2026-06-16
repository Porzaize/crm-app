"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initial: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initial);
  const totpStep = state.step === "totp";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div className="card" style={{ width: 360, maxWidth: "100%" }}>
        <h1 style={{ textAlign: "center" }}>CRM โทรติดตามลูกค้า</h1>
        <p className="muted" style={{ textAlign: "center", marginTop: "-0.5rem" }}>
          {totpStep ? "ยืนยันตัวตน 2 ชั้น" : "เข้าสู่ระบบเพื่อใช้งาน"}
        </p>

        {state.error && <div className="alert error">{state.error}</div>}

        {totpStep ? (
          <form action={formAction} key="totp">
            <input type="hidden" name="step" value="totp" />
            <input type="hidden" name="pending" value={state.pending ?? ""} />
            <p className="muted" style={{ fontSize: "0.88rem" }}>
              กรอกรหัส 6 หลักจากแอปยืนยันตัวตน (Google Authenticator)
            </p>
            <div className="field">
              <label htmlFor="code">รหัส 6 หลัก</label>
              <input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                maxLength={6}
              />
            </div>
            <button type="submit" disabled={pending} style={{ width: "100%" }}>
              {pending ? "กำลังยืนยัน…" : "ยืนยัน"}
            </button>
          </form>
        ) : (
          <form action={formAction} key="login">
            <div className="field">
              <label htmlFor="username">ชื่อผู้ใช้</label>
              <input id="username" name="username" type="text" autoFocus autoComplete="username" />
            </div>
            <div className="field">
              <label htmlFor="password">รหัสผ่าน</label>
              <input id="password" name="password" type="password" autoComplete="current-password" />
            </div>
            <button type="submit" disabled={pending} style={{ width: "100%" }}>
              {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
