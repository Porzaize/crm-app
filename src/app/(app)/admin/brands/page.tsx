import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import BrandAddForm from "./BrandAddForm";
import ConfirmButton from "@/components/ConfirmButton";
import { renameBrand } from "./actions";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  await requirePermission("brand.manage");
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { customers: true } } },
  });

  return (
    <>
      <h1>จัดการเว็บ / แบรนด์</h1>

      <div className="card">
        <h2>เพิ่มเว็บใหม่</h2>
        <BrandAddForm />
      </div>

      <div className="card">
        <h2>เว็บทั้งหมด ({brands.length})</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>ชื่อเว็บ (แก้ไขได้)</th>
                <th className="num">จำนวนลูกค้า</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.id}>
                  <td>
                    <form action={renameBrand} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="hidden" name="id" value={b.id} />
                      <input name="name" type="text" defaultValue={b.name} style={{ width: 200 }} />
                      <ConfirmButton
                        className="btn-secondary"
                        message={`เปลี่ยนชื่อเว็บ "${b.name}"? ชื่อใหม่จะมีผลกับลูกค้าทุกรายในเว็บนี้`}
                      >
                        เปลี่ยนชื่อ
                      </ConfirmButton>
                    </form>
                  </td>
                  <td className="num">{b._count.customers.toLocaleString("th-TH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
