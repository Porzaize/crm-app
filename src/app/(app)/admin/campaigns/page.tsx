import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/labels";
import CampaignAddForm from "./CampaignAddForm";
import { renameCampaign, setCampaignActive } from "./actions";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  await requirePermission("campaign.manage");
  const [campaigns, brands] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: { id: "asc" },
      include: { brand: true, _count: { select: { contacts: true } } },
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <h1>จัดการแคมเปญ</h1>

      <div className="card">
        <h2>สร้างแคมเปญใหม่</h2>
        <CampaignAddForm brands={brands} />
      </div>

      <div className="card">
        <h2>แคมเปญทั้งหมด ({campaigns.length})</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>ชื่อ (แก้ไขได้)</th>
                <th>เว็บ</th>
                <th>สถานะ</th>
                <th className="num">งานในคิว</th>
                <th>สร้างเมื่อ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <form action={renameCampaign} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="hidden" name="id" value={c.id} />
                      <input name="name" type="text" defaultValue={c.name} style={{ width: 220 }} />
                      <button type="submit" className="btn-secondary">
                        บันทึก
                      </button>
                    </form>
                  </td>
                  <td>{c.brand?.name ?? <span className="muted">ทุกเว็บ</span>}</td>
                  <td>
                    <span className={`badge ${c.active ? "green" : "gray"}`}>
                      {c.active ? "เปิด" : "ปิด"}
                    </span>
                  </td>
                  <td className="num">{c._count.contacts.toLocaleString("th-TH")}</td>
                  <td>{formatDate(c.createdAt)}</td>
                  <td>
                    <form action={setCampaignActive}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="active" value={c.active ? "false" : "true"} />
                      <button type="submit" className="btn-secondary">
                        {c.active ? "ปิด" : "เปิด"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
