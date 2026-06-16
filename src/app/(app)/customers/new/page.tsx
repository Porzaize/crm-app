import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import CustomerForm from "./CustomerForm";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  await requirePermission("customer.manage");
  const [brands, agents] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
  ]);

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>เพิ่มลูกค้าใหม่</h1>
        <Link href="/customers" className="btn-secondary">
          ← กลับ
        </Link>
      </div>
      <div className="card">
        <CustomerForm brands={brands} agents={agents.map((a) => ({ id: a.id, name: a.displayName }))} />
      </div>
    </>
  );
}
