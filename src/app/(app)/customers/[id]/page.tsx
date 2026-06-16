import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, can } from "@/lib/auth";
import {
  formatMoney,
  formatDate,
  formatDateTime,
  OUTCOME_LABELS,
  DISPOSITION_LABELS,
  CUSTOMER_STATUS_LABELS,
} from "@/lib/labels";
import StatusForm from "./StatusForm";
import ManageCustomer from "./ManageCustomer";
import ConfirmButton from "@/components/ConfirmButton";
import PhoneLink from "@/components/PhoneLink";
import { archiveCustomer, restoreCustomer } from "../actions";
import { auditActionLabel } from "@/lib/labels";
import { renderAuditDiff } from "@/lib/audit";
import { bangkokYMD } from "@/lib/dates";
import type { CustomerStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<CustomerStatus, string> = {
  ACTIVE: "green",
  LAPSED: "amber",
  DO_NOT_CALL: "red",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const customerId = Number(id);
  if (!customerId) notFound();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      brand: true,
      deposits: { orderBy: { date: "asc" } },
      bonuses: { orderBy: { date: "asc" } },
      contacts: {
        include: { callLogs: { include: { caller: true } }, assignedTo: true },
      },
      statusChanges: {
        include: { changedBy: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!customer) notFound();

  const calls = customer.contacts
    .flatMap((ct) => ct.callLogs)
    .sort((a, b) => b.calledAt.getTime() - a.calledAt.getTime());
  const depositTotal = customer.deposits.reduce((a, d) => a + d.amount, 0);
  const bonusTotal = customer.bonuses.reduce((a, b) => a + b.amount, 0);

  const canManage = can(session, "customer.manage");
  const canStatus = can(session, "customer.status");

  // Audit log ของลูกค้ารายนี้ (ข้อ 10) — เฉพาะผู้มีสิทธิ์จัดการลูกค้า
  const auditLogs = canManage
    ? await prisma.auditLog.findMany({
        where: { entity: "Customer", entityId: customerId },
        include: { user: { select: { displayName: true } } },
        orderBy: { id: "desc" },
        take: 50,
      })
    : [];

  // ข้อมูลสำหรับการ์ดจัดการลูกค้า (เฉพาะผู้มีสิทธิ์จัดการลูกค้า)
  const [brands, agents] = canManage
    ? await Promise.all([
        prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.user.findMany({
          where: { active: true },
          orderBy: { displayName: "asc" },
          select: { id: true, displayName: true },
        }),
      ])
    : [[], []];
  const currentAssignee = customer.contacts.find((c) => c.assignedTo)?.assignedTo?.displayName ?? null;

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>ลูกค้า <PhoneLink phone={customer.phone} /></h1>
        <Link href="/customers" className="btn-secondary">
          ← กลับ
        </Link>
      </div>

      <div className="card-grid">
        <div className="card stat">
          <div className="label">เว็บ</div>
          <div className="value" style={{ fontSize: "1.2rem" }}>{customer.brand.name}</div>
        </div>
        <div className="card stat">
          <div className="label">สถานะ</div>
          <div className="value" style={{ fontSize: "1.2rem" }}>
            {CUSTOMER_STATUS_LABELS[customer.status]}
          </div>
        </div>
        <div className="card stat">
          <div className="label">ยอดฝากรวม</div>
          <div className="value">{formatMoney(depositTotal)}</div>
        </div>
        <div className="card stat">
          <div className="label">โบนัสรวม</div>
          <div className="value">{formatMoney(bonusTotal)}</div>
        </div>
      </div>

      {canStatus && (
        <div className="card">
          <h2>เปลี่ยนสถานะ</h2>
          <StatusForm customerId={customer.id} current={customer.status} />
        </div>
      )}

      {canManage && (
        <div className="card">
          <h2>จัดการลูกค้า</h2>
          <ManageCustomer
            customerId={customer.id}
            phone={customer.phone}
            brandId={customer.brandId}
            status={customer.status}
            currentAssignee={currentAssignee}
            brands={brands}
            agents={agents.map((a) => ({ id: a.id, name: a.displayName }))}
            todayYMD={bangkokYMD()}
          />
          <div style={{ borderTop: "1px solid #e5e7eb", marginTop: "1rem", paddingTop: "1rem" }}>
            <h3 style={{ fontSize: "0.95rem", marginTop: 0 }}>เก็บลูกค้า (soft-delete)</h3>
            {customer.archived ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="badge gray">ถูกเก็บไว้ (ซ่อนจากรายการ/คิว)</span>
                <form action={restoreCustomer}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <button type="submit" className="btn-secondary">
                    กู้คืน
                  </button>
                </form>
              </div>
            ) : (
              <form action={archiveCustomer} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="hidden" name="customerId" value={customer.id} />
                <span className="muted">ซ่อนลูกค้าออกจากรายการและคิว แต่เก็บประวัติทั้งหมดไว้</span>
                <ConfirmButton
                  className="btn-secondary"
                  message="เก็บลูกค้ารายนี้? ลูกค้าจะถูกซ่อนจากรายการและคิว (กู้คืนได้ภายหลัง)"
                >
                  เก็บลูกค้า
                </ConfirmButton>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h2>ประวัติการเปลี่ยนสถานะ ({customer.statusChanges.length})</h2>
        {customer.statusChanges.length === 0 ? (
          <p className="muted">ยังไม่มีการเปลี่ยนสถานะ</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>เวลา</th>
                <th>จาก</th>
                <th>เป็น</th>
                <th>โดย</th>
                <th>เหตุผล</th>
              </tr>
            </thead>
            <tbody>
              {customer.statusChanges.map((s) => (
                <tr key={s.id}>
                  <td>{formatDateTime(s.createdAt)}</td>
                  <td>{CUSTOMER_STATUS_LABELS[s.fromStatus]}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[s.toStatus]}`}>
                      {CUSTOMER_STATUS_LABELS[s.toStatus]}
                    </span>
                  </td>
                  <td>{s.changedBy?.displayName ?? <span className="muted">ระบบ</span>}</td>
                  <td>{s.reason ?? <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canManage && (
        <div className="card">
          <h2>Audit Log ({auditLogs.length})</h2>
          {auditLogs.length === 0 ? (
            <p className="muted">ยังไม่มีบันทึก</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>ผู้ทำ</th>
                  <th>การกระทำ</th>
                  <th>การเปลี่ยนแปลง</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(log.createdAt)}</td>
                    <td>{log.user?.displayName ?? <span className="muted">ระบบ</span>}</td>
                    <td>{auditActionLabel(log.action)}</td>
                    <td style={{ fontSize: "0.85rem" }}>{renderAuditDiff(log.before, log.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        <div className="card">
          <h2>ประวัติการโทร ({calls.length})</h2>
          {calls.length === 0 ? (
            <p className="muted">ยังไม่มีประวัติการโทร</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>ผลสาย</th>
                  <th>โปร</th>
                  <th>ผู้โทร</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.calledAt)}</td>
                    <td>{OUTCOME_LABELS[log.outcome]}</td>
                    <td>{log.disposition === "PROMO_20" ? DISPOSITION_LABELS.PROMO_20 : "-"}</td>
                    <td>{log.caller?.displayName ?? <span className="muted">นำเข้า</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>การฝาก / โบนัส</h2>
          <h3 style={{ fontSize: "0.95rem" }}>ยอดกลับมาฝาก</h3>
          {customer.deposits.length === 0 ? (
            <p className="muted">ไม่มี</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th className="num">ยอด</th>
                </tr>
              </thead>
              <tbody>
                {customer.deposits.map((d) => (
                  <tr key={d.id}>
                    <td>{formatDate(d.date)}</td>
                    <td className="num">{formatMoney(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h3 style={{ fontSize: "0.95rem", marginTop: "1rem" }}>การปรับโบนัส</h3>
          {customer.bonuses.length === 0 ? (
            <p className="muted">ไม่มี</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th className="num">ยอด</th>
                </tr>
              </thead>
              <tbody>
                {customer.bonuses.map((b) => (
                  <tr key={b.id}>
                    <td>{formatDate(b.date)}</td>
                    <td className="num">{formatMoney(b.amount)}</td>
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
