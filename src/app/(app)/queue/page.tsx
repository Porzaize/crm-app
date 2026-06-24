import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, can } from "@/lib/auth";
import ConfirmButton from "@/components/ConfirmButton";
import { bulkAssignContacts } from "./actions";
import { OUTCOME_LABELS, CONTACT_STATUS_LABELS } from "@/lib/labels";
import PhoneLink from "@/components/PhoneLink";
import PageBanner from "@/components/PageBanner";
import type { Prisma, CallOutcome } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type CallsBucket = "0" | "1" | "2" | "3+";
const CALLS_BUCKETS: { value: CallsBucket; label: string }[] = [
  { value: "0", label: "ยังไม่เคยโทร" },
  { value: "1", label: "1 ครั้ง" },
  { value: "2", label: "2 ครั้ง" },
  { value: "3+", label: "3 ครั้งขึ้นไป" },
];

/** contactId ที่ "การโทรครั้งล่าสุด" มีผลสายตามที่เลือก (DISTINCT ON ฝั่ง Postgres) */
async function lastOutcomeContactIds(oc: CallOutcome): Promise<number[]> {
  const rows = await prisma.$queryRaw<{ contactId: number }[]>`
    WITH last_call AS (
      SELECT DISTINCT ON (cl."contactId") cl."contactId" AS "contactId", cl.outcome AS outcome
      FROM "CallLog" cl
      ORDER BY cl."contactId", cl."calledAt" DESC, cl.id DESC
    )
    SELECT "contactId" FROM last_call WHERE outcome = ${oc}::"CallOutcome"`;
  return rows.map((r) => r.contactId);
}

/** contactId ตามจำนวนครั้งที่โทร (1 / 2 / 3 ครั้งขึ้นไป) */
async function callCountContactIds(bucket: "1" | "2" | "3+"): Promise<number[]> {
  const rows =
    bucket === "1"
      ? await prisma.$queryRaw<{ contactId: number }[]>`SELECT "contactId" FROM "CallLog" GROUP BY "contactId" HAVING COUNT(*) = 1`
      : bucket === "2"
        ? await prisma.$queryRaw<{ contactId: number }[]>`SELECT "contactId" FROM "CallLog" GROUP BY "contactId" HAVING COUNT(*) = 2`
        : await prisma.$queryRaw<{ contactId: number }[]>`SELECT "contactId" FROM "CallLog" GROUP BY "contactId" HAVING COUNT(*) >= 3`;
  return rows.map((r) => r.contactId);
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; page?: string; outcome?: string; calls?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const brandId = sp.brand ? Number(sp.brand) : undefined;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const outcome =
    sp.outcome && sp.outcome in OUTCOME_LABELS ? (sp.outcome as CallOutcome) : undefined;
  const calls = CALLS_BUCKETS.some((b) => b.value === sp.calls)
    ? (sp.calls as CallsBucket)
    : undefined;

  // กรองตามผลสายล่าสุด / จำนวนครั้งที่โทร → รวมเป็นเงื่อนไขชุด contactId แล้ว intersect
  const extraFilter: Prisma.CampaignContactWhereInput = {};
  const idLists: number[][] = [];
  if (outcome) idLists.push(await lastOutcomeContactIds(outcome));
  if (calls === "0") {
    extraFilter.callLogs = { none: {} };
    if (outcome) idLists.push([]);
  } else if (calls) {
    idLists.push(await callCountContactIds(calls));
  }
  if (idLists.length) {
    const inter = idLists.reduce((a, b) => {
      const s = new Set(b);
      return a.filter((x) => s.has(x));
    });
    extraFilter.id = { in: inter };
  }

  const where: Prisma.CampaignContactWhereInput = {
    status: "PENDING",
    customer: {
      status: { not: "DO_NOT_CALL" },
      archived: false,
      ...(brandId ? { brandId } : {}),
      ...(q ? { phone: { contains: q.replace(/\D/g, "") } } : {}),
    },
    ...(session.role === "AGENT" ? { assignedToId: session.userId } : {}),
    ...extraFilter,
  };

  const [total, contacts, brands] = await Promise.all([
    prisma.campaignContact.count({ where }),
    prisma.campaignContact.findMany({
      where,
      include: {
        customer: { include: { brand: true } },
        callLogs: { orderBy: { calledAt: "desc" }, take: 1 },
        _count: { select: { callLogs: true } },
      },
      orderBy: { id: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);

  const canBulk = can(session, "queue.assign");
  const agents = canBulk
    ? await prisma.user.findMany({
        where: { active: true },
        orderBy: { displayName: "asc" },
        select: { id: true, displayName: true },
      })
    : [];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (brandId) u.set("brand", String(brandId));
    if (outcome) u.set("outcome", outcome);
    if (calls) u.set("calls", calls);
    u.set("page", String(p));
    return `/queue?${u.toString()}`;
  };

  return (
    <>
      <PageBanner title="คิวโทร" subtitle="รายชื่อลูกค้าที่ต้องโทรติดตาม · กรองตามผลสาย/จำนวนครั้งที่โทร" />

      <div className="card">
        <form className="row" method="get" style={{ flexWrap: "wrap" }}>
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
            <label htmlFor="outcome">ผลสายล่าสุด</label>
            <select id="outcome" name="outcome" defaultValue={outcome ?? ""}>
              <option value="">ทั้งหมด</option>
              {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="calls">จำนวนครั้งที่โทร</label>
            <select id="calls" name="calls" defaultValue={calls ?? ""}>
              <option value="">ทั้งหมด</option>
              {CALLS_BUCKETS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
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
          <span className="muted">แสดง {total.toLocaleString("th-TH")} รายการ</span>
        </div>
        {canBulk && (
          <form
            id="bulkForm"
            action={bulkAssignContacts}
            className="toolbar"
            style={{ gap: 8, margin: "0 0 0.75rem", flexWrap: "wrap" }}
          >
            <span className="muted">เลือกรายการแล้วมอบหมายให้:</span>
            <select name="agentId" defaultValue="">
              <option value="" disabled>
                — เลือกพนักงาน —
              </option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </select>
            <ConfirmButton
              className="btn-secondary"
              message="มอบหมายรายการที่เลือกทั้งหมดให้พนักงานคนนี้?"
            >
              มอบหมายที่เลือก
            </ConfirmButton>
          </form>
        )}
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                {canBulk && <th></th>}
                <th>เบอร์</th>
                <th>เว็บ</th>
                <th>สถานะ</th>
                <th className="num">ครั้งที่โทร</th>
                <th>ผลล่าสุด</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={canBulk ? 7 : 6} className="muted" style={{ textAlign: "center" }}>
                    ไม่มีรายการในคิว
                  </td>
                </tr>
              )}
              {contacts.map((c) => {
                const last = c.callLogs[0];
                return (
                  <tr key={c.id}>
                    {canBulk && (
                      <td>
                        <input type="checkbox" name="contactIds" value={c.id} form="bulkForm" />
                      </td>
                    )}
                    <td><PhoneLink phone={c.customer.phone} /></td>
                    <td>{c.customer.brand.name}</td>
                    <td>
                      <span className="badge amber">{CONTACT_STATUS_LABELS[c.status]}</span>
                    </td>
                    <td className="num">{c._count.callLogs}</td>
                    <td>{last ? OUTCOME_LABELS[last.outcome] : <span className="muted">—</span>}</td>
                    <td>
                      <Link href={`/queue/${c.id}`} className="btn-primary" style={{ padding: "0.35rem 0.8rem" }}>
                        บันทึกผลสาย
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            {page > 1 && <Link href={qs(page - 1)} className="btn-secondary">← ก่อนหน้า</Link>}
            <span className="muted">
              หน้า {page} / {totalPages}
            </span>
            {page < totalPages && <Link href={qs(page + 1)} className="btn-secondary">ถัดไป →</Link>}
          </div>
        )}
      </div>
    </>
  );
}
