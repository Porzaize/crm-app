import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { formatDate } from "@/lib/labels";
import TemplateForm from "./TemplateForm";
import { setTemplateActive, moveTemplate } from "./actions";

export const dynamic = "force-dynamic";

export default async function SmsTemplatesPage() {
  await requirePermission("sms.manage");
  const templates = await prisma.smsTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return (
    <>
      <h1>คลังข้อความ SMS</h1>
      <p className="muted">
        template กลางสำหรับส่ง SMS ตอนบันทึกผลสาย — รองรับตัวแปร <code>{"{{เว็บ}}"}</code>{" "}
        <code>{"{{เบอร์}}"}</code> <code>{"{{โปร}}"}</code>
      </p>

      <div className="card">
        <h2>เพิ่ม template ใหม่</h2>
        <TemplateForm mode="create" />
      </div>

      <div className="card">
        <h2>template ทั้งหมด ({templates.length})</h2>
        {templates.length === 0 ? (
          <p className="muted">ยังไม่มี template</p>
        ) : (
          templates.map((t, i) => (
            <div
              key={t.id}
              style={{
                borderTop: i === 0 ? "none" : "1px solid #e5e7eb",
                padding: "1rem 0",
                opacity: t.active ? 1 : 0.6,
              }}
            >
              <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`badge ${t.active ? "green" : "gray"}`}>
                    {t.active ? "ใช้งาน" : "ปิดใช้งาน"}
                  </span>
                  <strong>{t.name}</strong>
                  <span className="muted">· สร้าง {formatDate(t.createdAt)}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <form action={moveTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button type="submit" className="btn-secondary" disabled={i === 0} title="เลื่อนขึ้น">
                      ↑
                    </button>
                  </form>
                  <form action={moveTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button
                      type="submit"
                      className="btn-secondary"
                      disabled={i === templates.length - 1}
                      title="เลื่อนลง"
                    >
                      ↓
                    </button>
                  </form>
                  <form action={setTemplateActive}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="active" value={t.active ? "false" : "true"} />
                    <button type="submit" className="btn-secondary">
                      {t.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                  </form>
                </div>
              </div>
              <TemplateForm mode="edit" template={{ id: t.id, name: t.name, body: t.body }} />
            </div>
          ))
        )}
      </div>
    </>
  );
}
