"use client";

import { PERMISSION_GROUPS, PERMISSION_LABELS, type Permission } from "@/lib/permissions";

/** ตารางติ๊กสิทธิ์ (controlled) — checkbox ใช้ name="permissions" เพื่อ submit ตรงเข้า form action */
export default function PermissionGrid({
  checked,
  onToggle,
  disabled,
}: {
  checked: Set<Permission>;
  onToggle: (perm: Permission, on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: "0.9rem" }}>
      {PERMISSION_GROUPS.map((g) => (
        <div key={g.title}>
          <div className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: 4 }}>
            {g.title}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 1.2rem" }}>
            {g.perms.map((p) => (
              <label
                key={p}
                style={{
                  fontWeight: 400,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  margin: 0,
                  opacity: disabled ? 0.6 : 1,
                }}
              >
                <input
                  type="checkbox"
                  name="permissions"
                  value={p}
                  checked={checked.has(p)}
                  disabled={disabled}
                  onChange={(e) => onToggle(p, e.target.checked)}
                  style={{ width: "auto" }}
                />
                {PERMISSION_LABELS[p]}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
