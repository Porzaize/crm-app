"use client";

import { useState } from "react";
import { presetFor, type Permission } from "@/lib/permissions";
import type { Role } from "@prisma/client";
import PermissionGrid from "./PermissionGrid";
import { setUserPermissions } from "./actions";

/** ตัวแก้สิทธิ์รายคนในตารางจัดการผู้ใช้ — พับ/กางได้, submit เข้า setUserPermissions */
export default function RowPermissions({
  userId,
  role,
  effective,
  custom,
}: {
  userId: number;
  role: Role;
  effective: Permission[]; // สิทธิ์ที่มีผลจริงตอนนี้
  custom: boolean; // กำหนดเองอยู่หรือไม่ (แสดงป้าย)
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<Permission>>(new Set(effective));

  if (role === "ADMIN") {
    return <span className="muted">ทุกฟังก์ชัน</span>;
  }

  function toggle(perm: Permission, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(perm);
      else next.delete(perm);
      return next;
    });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button type="button" className="btn-secondary" onClick={() => setOpen((v) => !v)}>
          {open ? "ซ่อน" : "🔑 สิทธิ์"}
        </button>
        <span className={`badge ${custom ? "blue" : ""}`}>{custom ? "กำหนดเอง" : "ตามบทบาท"}</span>
      </div>

      {open && (
        <form action={setUserPermissions} style={{ marginTop: "0.7rem", padding: "0.9rem 1rem", border: "1px solid var(--border)", borderRadius: 12, minWidth: 320 }}>
          <input type="hidden" name="userId" value={userId} />
          <PermissionGrid checked={checked} onToggle={toggle} />
          <div style={{ display: "flex", gap: 8, marginTop: "0.8rem" }}>
            <button type="submit">บันทึกสิทธิ์</button>
            <button type="button" className="btn-secondary" onClick={() => setChecked(new Set(presetFor(role)))}>
              คืนค่าตามบทบาท
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
