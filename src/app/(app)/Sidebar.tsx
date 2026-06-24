"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { listHas, type Permission } from "@/lib/permissions";

type NavItem = { href: string; label: string; icon: string; perm?: Permission };
type NavGroup = { title: string | null; items: NavItem[] };

export default function Sidebar({
  permissions,
}: {
  permissions: readonly Permission[] | "*";
}) {
  const pathname = usePathname();

  // เมนูทั้งหมด + สิทธิ์ที่ต้องมีเพื่อเห็น (ไม่มี perm = เห็นได้ทุกบทบาท)
  const allGroups: NavGroup[] = [
    {
      title: null,
      items: [
        { href: "/", label: "แดชบอร์ด", icon: "📊" },
        { href: "/queue", label: "คิวโทร", icon: "📞" },
        { href: "/customers", label: "ลูกค้า", icon: "👥" },
      ],
    },
    {
      title: "เครื่องมือ",
      items: [
        { href: "/admin/notifications", label: "แจ้งเตือน Telegram", icon: "🔔", perm: "notification.manage" },
        { href: "/admin/campaigns", label: "แคมเปญ", icon: "🎯", perm: "campaign.manage" },
        { href: "/admin/import", label: "นำเข้าข้อมูล", icon: "📥", perm: "import.run" },
      ],
    },
    {
      title: "ผู้ดูแลระบบ",
      items: [
        { href: "/admin", label: "ผู้ใช้งาน", icon: "🛡️", perm: "user.manage" },
        { href: "/admin/brands", label: "จัดการเว็บ", icon: "🌐", perm: "brand.manage" },
        { href: "/admin/activity", label: "ตรวจสอบ/ทุจริต", icon: "🔎", perm: "activity.view" },
      ],
    },
  ];

  // กรองเมนูตามสิทธิ์ของบทบาท แล้วตัดกลุ่มที่ไม่เหลือเมนู
  const groups = allGroups
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.perm || listHas(permissions, it.perm)) }))
    .filter((g) => g.items.length > 0);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/reports") return pathname === "/reports"; // ไม่ให้ติดตอนอยู่ /reports/agents
    if (href === "/admin") return pathname === "/admin"; // ไม่ให้ติดตอนอยู่ /admin/audit
    return pathname.startsWith(href);
  };

  return (
    <aside className="sidebar">
      <nav>
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.title && <div className="nav-group">{g.title}</div>}
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} className={isActive(it.href) ? "active" : ""}>
                <span className="ico">{it.icon}</span>
                {it.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
