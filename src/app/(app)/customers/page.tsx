import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, can } from "@/lib/auth";
import {
  formatPhone,
  formatMoney,
  CUSTOMER_STATUS_LABELS,
} from "@/lib/labels";
import PageBanner from "@/components/PageBanner";
import type { Prisma, CustomerStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const STATUS_BADGE: Record<CustomerStatus, string> = {
  ACTIVE: "green",
  LAPSED: "amber",
  DO_NOT_CALL: "red",
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; status?: string; page?: string; archived?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const brandId = sp.brand ? Number(sp.brand) : undefined;
  const status = sp.status && sp.status in CUSTOMER_STATUS_LABELS ? (sp.status as CustomerStatus) : undefined;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const showArchived = sp.archived === "1";

  const where: Prisma.CustomerWhereInput = {
    archived: showArchived, // ปกติแสดงเฉพาะที่ยังไม่ถูกเก็บ ; archived=1 = ดูถังที่เก็บไว้
    ...(brandId ? { brandId } : {}),
    ...(status ? { status } : {}),
    ...(q ? { phone: { contains: q.replace(/\D/g, "") } } : {}),
  };

  const [total, customers, brands] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: {
        brand: true,
        deposits: { select: { amount: true } },
        _count: { select: { deposits: true } },
      },
      orderBy: { id: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (brandId) u.set("brand", String(brandId));
    if (status) u.set("status", status);
    if (showArchived) u.set("archived", "1");
    u.set("page", String(p));
    return `/customers?${u.toString()}`;
  };

  // ลิงก์สลับมุมมอง ปกติ <-> ที่เก็บไว้ (พก filter q/brand/status)
  const toggleArchivedHref = (() => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (brandId) u.set("brand", String(brandId));
    if (status) u.set("status", status);
    if (!showArchived) u.set("archived", "1");
    const s = u.toString();
    return `/customers${s ? "?" + s : ""}`;
  })();

  // ลิงก์ดาวน์โหลด CSV — พก filter ปัจจุบันไปด้วย (เฉพาะหัวหน้าขึ้นไป)
  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (brandId) exportParams.set("brand", String(brandId));
  if (status) exportParams.set("status", status);
  const exportHref = `/api/customers/export?${exportParams.toString()}`;
  const canExport = can(session, "customer.export");

  return (
    <>
      <PageBanner
        title={showArchived ? "ลูกค้า (ที่เก็บไว้)" : "ลูกค้า"}
        subtitle="รายชื่อลูกค้าทั้งหมด · ค้นหา กรอง และส่งออกข้อมูล"
      >
        {canExport && (
          <a href={exportHref} className="btn-secondary" style={{ whiteSpace: "nowrap" }}>
            ⬇ ดาวน์โหลด CSV
          </a>
        )}
        {canExport && (
          <Link href={toggleArchivedHref} className="btn-secondary">
            {showArchived ? "← กลับรายการปกติ" : "🗂 ดูที่เก็บไว้"}
          </Link>
        )}
        {canExport && !showArchived && (
          <Link href="/customers/new" className="btn-primary">
            + เพิ่มลูกค้า
          </Link>
        )}
      </PageBanner>

      <div className="card">
        <form className="row" method="get">
          {showArchived && <input type="hidden" name="archived" value="1" />}
          <div>
            <label htmlFor="q">ค้นหาเบอร์</label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="เช่น 0891" />
          </div>
          <div>
            <label htmlFor="brand">เว็บ</label>
            <select id="brand" name="brand" defaultValue={brandId ?? ""}>
              <option value="">ทั้งหมด</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status">สถานะ</label>
            <select id="status" name="status" defaultValue={status ?? ""}>
              <option value="">ทั้งหมด</option>
              {Object.entries(CUSTOMER_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end" }}>
            <button type="submit">ค้นหา</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar">
          <span className="muted">ทั้งหมด {total.toLocaleString("th-TH")} ราย</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>เบอร์</th>
                <th>เว็บ</th>
                <th>สถานะ</th>
                <th className="num">ครั้งที่ฝาก</th>
                <th className="num">ยอดฝากรวม</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: "center" }}>
                    ไม่พบลูกค้า
                  </td>
                </tr>
              )}
              {customers.map((c) => {
                const sum = c.deposits.reduce((a, d) => a + d.amount, 0);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/customers/${c.id}`}>{formatPhone(c.phone)}</Link>
                    </td>
                    <td>{c.brand.name}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[c.status]}`}>
                        {CUSTOMER_STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="num">{c._count.deposits}</td>
                    <td className="num">{formatMoney(sum)}</td>
                    <td>
                      <Link href={`/customers/${c.id}`}>รายละเอียด →</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            {page > 1 && <Link href={qs(page - 1)} className="btn-link back"><span className="arr">←</span> ก่อนหน้า</Link>}
            <span className="muted">
              หน้า {page} / {totalPages}
            </span>
            {page < totalPages && <Link href={qs(page + 1)} className="btn-link">ถัดไป <span className="arr">→</span></Link>}
          </div>
        )}
      </div>
    </>
  );
}
