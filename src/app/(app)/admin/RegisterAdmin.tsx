"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createUser, type CreateUserState } from "./actions";
import { presetFor, type Permission } from "@/lib/permissions";
import type { Role } from "@prisma/client";
import PermissionGrid from "./PermissionGrid";

const initial: CreateUserState = {};

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "AGENT", label: "พนักงาน" },
  { value: "SUPERVISOR", label: "หัวหน้าทีม" },
  { value: "ADMIN", label: "ผู้ดูแลระบบ" },
];

export default function RegisterAdmin() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createUser, initial);

  // role + ชุดสิทธิ์ที่ติ๊ก (ค่าเริ่มต้นตามบทบาท ปรับเพิ่มได้รายคน)
  const [role, setRole] = useState<Role | "">("");
  const [checked, setChecked] = useState<Set<Permission>>(new Set());
  const [showPerms, setShowPerms] = useState(false);

  const isAdmin = role === "ADMIN";

  function onRoleChange(value: string) {
    const r = value as Role | "";
    setRole(r);
    // ตั้งสิทธิ์เริ่มต้นตาม preset ของบทบาทที่เลือก
    setChecked(r ? new Set(presetFor(r as Role)) : new Set());
  }

  function toggle(perm: Permission, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(perm);
      else next.delete(perm);
      return next;
    });
  }

  function resetToPreset() {
    if (role) setChecked(new Set(presetFor(role as Role)));
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* แบนเนอร์หัว */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1.1rem 1.4rem",
          background: "linear-gradient(90deg, var(--primary), #6366f1)",
          color: "#fff",
        }}
      >
        <div>
          <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>จัดการผู้ดูแลระบบ</div>
          <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>เพิ่ม/แก้ไขผู้ใช้งานและบทบาท</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "ปิดฟอร์ม" : "เพิ่มผู้ใช้"}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "1px solid rgba(255,255,255,0.45)",
            width: 40,
            height: 40,
            borderRadius: 10,
            fontSize: "1.4rem",
            lineHeight: 1,
            padding: 0,
            boxShadow: "none",
          }}
        >
          {open ? "×" : "+"}
        </button>
      </div>

      {open && (
        <div style={{ padding: "1.3rem 1.4rem" }}>
          <h3 style={{ marginTop: 0 }}>➕ ลงทะเบียนผู้ดูแลระบบ</h3>
          <form action={formAction}>
            {state.error && <div className="alert error">{state.error}</div>}
            {state.ok && <div className="alert success">{state.ok}</div>}

            <div className="field">
              <label htmlFor="reg-role">บทบาท</label>
              <select id="reg-role" name="role" value={role} onChange={(e) => onRoleChange(e.target.value)}>
                <option value="" disabled>
                  — เลือกบทบาท —
                </option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="reg-username">ชื่อผู้ใช้</label>
              <input id="reg-username" name="username" type="text" autoComplete="off" placeholder="ชื่อผู้ใช้" />
            </div>
            <div className="field">
              <label htmlFor="reg-displayName">ชื่อแสดง (ไม่บังคับ)</label>
              <input id="reg-displayName" name="displayName" type="text" autoComplete="off" placeholder="เว้นว่าง = ใช้ชื่อผู้ใช้" />
            </div>
            <div className="row">
              <div>
                <label htmlFor="reg-password">รหัสผ่าน</label>
                <input id="reg-password" name="password" type="password" autoComplete="new-password" placeholder="≥ 6 ตัว" />
              </div>
              <div>
                <label htmlFor="reg-confirm">ยืนยันรหัสผ่าน</label>
                <input id="reg-confirm" name="confirmPassword" type="password" autoComplete="new-password" placeholder="พิมพ์รหัสผ่านอีกครั้ง" />
              </div>
            </div>

            {/* สิทธิ์การเข้าถึง — ค่าเริ่มต้นตามบทบาท ปรับเฉพาะคนนี้ได้ */}
            {role && (
              <div className="field" style={{ marginTop: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <label style={{ margin: 0 }}>สิทธิ์การเข้าถึง</label>
                  <button type="button" className="btn-secondary" onClick={() => setShowPerms((v) => !v)}>
                    {showPerms ? "ซ่อน" : "ปรับสิทธิ์การเข้าถึง"}
                  </button>
                </div>
                {/* hidden ไว้แทนการ unmount เพื่อให้ checkbox ยัง submit แม้พับอยู่ */}
                <div
                  hidden={!showPerms}
                  style={{ marginTop: "0.7rem", padding: "0.9rem 1rem", border: "1px solid var(--border)", borderRadius: 12 }}
                >
                  {isAdmin ? (
                    <p className="muted" style={{ margin: 0 }}>
                      ผู้ดูแลระบบเข้าถึงได้ทุกฟังก์ชันเสมอ (ปรับไม่ได้)
                    </p>
                  ) : (
                    <>
                      <p className="muted" style={{ marginTop: 0, fontSize: "0.82rem" }}>
                        ค่าเริ่มต้นตามบทบาท — ติ๊กเพิ่ม/เอาออกเพื่อกำหนดเฉพาะผู้ใช้คนนี้
                      </p>
                      <PermissionGrid checked={checked} onToggle={toggle} />
                      <button type="button" className="btn-secondary" style={{ marginTop: "0.7rem" }} onClick={resetToPreset}>
                        คืนค่าตามบทบาท
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: "0.8rem" }}>
              <button type="submit" disabled={pending}>
                {pending ? "กำลังบันทึก…" : "✓ บันทึก"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
