import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, can } from "@/lib/auth";
import { CUSTOMER_STATUS_LABELS } from "@/lib/labels";
import type { Prisma, CustomerStatus } from "@prisma/client";

// ข้อ 2: Export รายชื่อลูกค้าเป็น CSV (SUPERVISOR ขึ้นไป) — รับ filter เดียวกับหน้า /customers
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** escape ค่าตามมาตรฐาน CSV (RFC 4180) */
function csvCell(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("unauthorized", { status: 401 });
  if (!can(session, "customer.export")) return new NextResponse("forbidden", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const brandId = sp.get("brand") ? Number(sp.get("brand")) : undefined;
  const statusRaw = sp.get("status") ?? "";
  const status =
    statusRaw in CUSTOMER_STATUS_LABELS ? (statusRaw as CustomerStatus) : undefined;

  const where: Prisma.CustomerWhereInput = {
    ...(brandId ? { brandId } : {}),
    ...(status ? { status } : {}),
    ...(q ? { phone: { contains: q.replace(/\D/g, "") } } : {}),
  };

  const customers = await prisma.customer.findMany({
    where,
    include: {
      brand: { select: { name: true } },
      deposits: { select: { amount: true } },
      bonuses: { select: { amount: true } },
      contacts: { select: { _count: { select: { callLogs: true } } } },
    },
    orderBy: { id: "asc" },
  });

  const header = ["เบอร์โทร", "เว็บ", "สถานะ", "จำนวนครั้งที่โทร", "ยอดฝากหลังติดตามรวม", "โบนัสรวม"];
  const lines = [header.map(csvCell).join(",")];

  for (const c of customers) {
    const calls = c.contacts.reduce((a, ct) => a + ct._count.callLogs, 0);
    const depositTotal = c.deposits.reduce((a, d) => a + d.amount, 0);
    const bonusTotal = c.bonuses.reduce((a, b) => a + b.amount, 0);
    const phone = c.phone.replace(/\D/g, "").padStart(10, "0");
    lines.push(
      [
        // ="0xxxxxxxxx" บังคับให้ Excel มองเป็นข้อความ ไม่ตัดเลข 0 หน้า
        csvCell(`="${phone}"`),
        csvCell(c.brand.name),
        csvCell(CUSTOMER_STATUS_LABELS[c.status]),
        csvCell(String(calls)),
        csvCell(String(depositTotal)),
        csvCell(String(bonusTotal)),
      ].join(",")
    );
  }

  // UTF-8 BOM กัน Excel อ่านภาษาไทยเพี้ยน
  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="customers.csv"',
      "Cache-Control": "no-store",
    },
  });
}
