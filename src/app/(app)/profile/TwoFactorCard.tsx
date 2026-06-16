"use client";

import { useActionState } from "react";
import { twoFactorAction, type TwoFactorState } from "./actions";

const initial: TwoFactorState = {};

export default function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState(twoFactorAction, initial);
  const isEnabled = state.done === "enabled" ? true : state.done === "disabled" ? false : enabled;

  // ขั้นตั้งค่า — แสดง QR + ช่องกรอกรหัสยืนยัน
  if (state.setup && state.qr) {
    return (
      <div>
        {state.error && <div className="alert error">{state.error}</div>}
        <p className="muted">
          สแกน QR ด้านล่างด้วยแอป <b>Google Authenticator</b> / Authy แล้วกรอกรหัส 6 หลักเพื่อยืนยัน
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={state.qr}
          alt="QR code สำหรับ 2FA"
          width={180}
          height={180}
          style={{ borderRadius: 12, border: "1px solid var(--border)", background: "#fff", padding: 8 }}
        />
        <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
          หรือกรอกรหัสนี้ในแอปเอง:{" "}
          <code style={{ background: "var(--surface-3)", padding: "0.1rem 0.4rem", borderRadius: 6 }}>
            {state.secret}
          </code>
        </p>
        <form action={formAction} style={{ marginTop: "0.5rem" }}>
          <input type="hidden" name="action" value="enable" />
          <div className="field">
            <label htmlFor="code">รหัส 6 หลักจากแอป</label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
            />
          </div>
          <button type="submit" disabled={pending}>
            {pending ? "กำลังยืนยัน…" : "ยืนยันเปิดใช้ 2FA"}
          </button>
        </form>
      </div>
    );
  }

  // เปิดอยู่ — แสดงสถานะ + ปุ่มปิด (ต้องกรอกรหัสปัจจุบัน)
  if (isEnabled) {
    return (
      <div>
        {state.done === "enabled" && <div className="alert success">เปิดใช้ 2FA เรียบร้อยแล้ว</div>}
        {state.error && <div className="alert error">{state.error}</div>}
        <p>
          <span className="badge green">เปิดอยู่</span>{" "}
          <span className="muted">ต้องกรอกรหัสจากแอปทุกครั้งที่เข้าสู่ระบบ</span>
        </p>
        <form action={formAction} style={{ marginTop: "0.5rem" }}>
          <input type="hidden" name="action" value="disable" />
          <div className="field">
            <label htmlFor="dcode">กรอกรหัสปัจจุบันเพื่อปิด 2FA</label>
            <input id="dcode" name="code" inputMode="numeric" placeholder="123456" maxLength={6} />
          </div>
          <button type="submit" className="btn-secondary" disabled={pending}>
            {pending ? "กำลังปิด…" : "ปิด 2FA"}
          </button>
        </form>
      </div>
    );
  }

  // ยังไม่เปิด — ปุ่มเริ่มตั้งค่า
  return (
    <div>
      {state.done === "disabled" && <div className="alert success">ปิด 2FA เรียบร้อยแล้ว</div>}
      <p className="muted">
        เพิ่มความปลอดภัยอีกชั้น — เมื่อเปิดใช้ ต้องกรอกรหัส 6 หลักจากแอปยืนยันตัวตน (Google Authenticator)
        ทุกครั้งที่เข้าสู่ระบบ
      </p>
      <form action={formAction}>
        <input type="hidden" name="action" value="start" />
        <button type="submit" disabled={pending}>
          {pending ? "กำลังเตรียม…" : "เปิดใช้ 2FA"}
        </button>
      </form>
    </div>
  );
}
