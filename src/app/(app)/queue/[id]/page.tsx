import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, can } from "@/lib/auth";
import {
  formatDateTime,
  OUTCOME_LABELS,
  DISPOSITION_LABELS,
  CUSTOMER_STATUS_LABELS,
} from "@/lib/labels";
import { buildSmsContext } from "@/lib/sms";
import PhoneLink from "@/components/PhoneLink";
import LogCallForm from "./LogCallForm";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const contactId = Number(id);
  if (!contactId) notFound();

  const contact = await prisma.campaignContact.findUnique({
    where: { id: contactId },
    include: {
      customer: { include: { brand: true } },
      callLogs: {
        orderBy: { calledAt: "desc" },
        include: { caller: true, smsTemplate: { select: { name: true } } },
      },
    },
  });
  if (!contact) notFound();

  // agent ดูได้เฉพาะงานของตัวเอง
  if (!can(session, "queue.call_any") && contact.assignedToId !== session.userId) {
    redirect("/queue");
  }

  const c = contact.customer;
  const isDNC = c.status === "DO_NOT_CALL";

  // คลังข้อความ SMS (ข้อ 11): เฉพาะที่เปิดใช้งาน + context ของลูกค้ารายนี้
  const templates = await prisma.smsTemplate.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, body: true },
  });
  const smsContext = buildSmsContext({ brandName: c.brand.name, phone: c.phone });

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>บันทึกผลสาย</h1>
        <Link href="/queue" className="btn-secondary">
          ← กลับคิว
        </Link>
      </div>

      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <div>
            <div className="muted">เบอร์โทร</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>
              <PhoneLink phone={c.phone} />
            </div>
          </div>
          <div>
            <div className="muted">เว็บ</div>
            <div>{c.brand.name}</div>
          </div>
          <div>
            <div className="muted">สถานะลูกค้า</div>
            <div>
              <span className={`badge ${isDNC ? "red" : "gray"}`}>
                {CUSTOMER_STATUS_LABELS[c.status]}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        <div className="card">
          <h2>บันทึกผลการโทรครั้งนี้</h2>
          {isDNC ? (
            <div className="alert error">ลูกค้ารายนี้อยู่ในสถานะห้ามโทร — บันทึกผลสายไม่ได้</div>
          ) : (
            <LogCallForm contactId={contact.id} templates={templates} smsContext={smsContext} />
          )}
        </div>

        <div className="card">
          <h2>ประวัติการโทร ({contact.callLogs.length})</h2>
          {contact.callLogs.length === 0 ? (
            <p className="muted">ยังไม่มีประวัติ</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>ผลสาย</th>
                  <th>โปร</th>
                  <th>SMS</th>
                  <th>ผู้โทร</th>
                </tr>
              </thead>
              <tbody>
                {contact.callLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.calledAt)}</td>
                    <td>{OUTCOME_LABELS[log.outcome]}</td>
                    <td>{log.disposition === "PROMO_20" ? DISPOSITION_LABELS.PROMO_20 : "-"}</td>
                    <td>
                      {log.smsSent ? "✓" : "-"}
                      {log.smsTemplate && (
                        <span className="muted" style={{ marginLeft: 4 }}>
                          {log.smsTemplate.name}
                        </span>
                      )}
                    </td>
                    <td>{log.caller?.displayName ?? <span className="muted">นำเข้า</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
