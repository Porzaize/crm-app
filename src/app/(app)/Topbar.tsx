"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { ROLE_LABELS } from "@/lib/labels";
import { listHas, type Permission } from "@/lib/permissions";
import type { Role } from "@prisma/client";

type QuickAction = { href: string; label: string; icon: string; perm?: Permission };

const QUICK_ACTIONS: QuickAction[] = [
  { href: "/queue", label: "คิวโทร", icon: "📞" },
  { href: "/customers/new", label: "เพิ่มลูกค้า", icon: "➕", perm: "customer.manage" },
  { href: "/admin/import", label: "นำเข้าข้อมูล", icon: "📥", perm: "import.run" },
];

export default function Topbar({
  displayName,
  username,
  role,
  permissions,
}: {
  displayName: string;
  username: string;
  role: Role;
  permissions: readonly Permission[] | "*";
}) {
  const actions = QUICK_ACTIONS.filter((a) => !a.perm || listHas(permissions, a.perm));
  const initial = (displayName || username || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="topbar">
      <Link href="/" className="topbar-brand">
        📞 CRM ติดตามลูกค้า
      </Link>

      <nav className="topbar-actions">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className="topbar-action">
            <span className="ico">{a.icon}</span>
            {a.label}
          </Link>
        ))}
      </nav>

      <div className="topbar-right">
        <ThemeToggle />
        <Link href="/profile" className="topbar-user" title="โปรไฟล์ / เปลี่ยนรหัสผ่าน">
          <span className="avatar">{initial}</span>
          <span className="topbar-userwrap">
            <span className="u-name">{displayName}</span>
            <span className="u-role">
              {ROLE_LABELS[role]} · {username}
            </span>
          </span>
        </Link>
        <a href="/logout" className="topbar-icon" aria-label="ออกจากระบบ" title="ออกจากระบบ">
          ⏻
        </a>
      </div>
    </header>
  );
}
