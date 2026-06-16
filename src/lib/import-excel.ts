import * as XLSX from "xlsx";
import type { PrismaClient, CallOutcome, CallDisposition } from "@prisma/client";
import { bangkokDateTime, dateOnlyUTC } from "./dates";

export const CAMPAIGN_NAME = "ติดตามลูกค้าขาดฝาก มิถุนายน 2026";
const YEAR = 2026;
const MONTH = 6; // มิถุนายน

// header อยู่แถว index 3, data เริ่ม index 4
const HEADER_ROWS = 4;
// คอลัมน์
const COL_PHONE = 1;
const COL_CALL_DATE = 2; // excel serial
const COL_CALL_TIME = 3; // HH.MM decimal
const COL_SMS = 6; // boolean
const COL_DAY1_DEPOSIT = 8; // amount ของวันที่ 1; วันที่ d -> 8 + (d-1)*2
// header จริง: col70="ยอดฝากทั้งหมดหลังติดตาม" (ยอดฝากรวม ไม่ใช่โบนัส), col71="วันที่ปรับโบนัส",
// col72="ยอดที่ปรับ" = โบนัสจริง (ส่วนใหญ่ 20% ของยอดฝาก). เดิมใช้ col70 ทำให้โบนัส=ยอดฝาก 100% (บั๊ก)
const COL_BONUS_AMOUNT = 72; // ยอดที่ปรับ = โบนัสจริง
const COL_OUTCOME_TEXT = 73; // ข้อความผลสาย (ไม่มี header)

type ParsedOutcome = { outcome: CallOutcome; disposition: CallDisposition };

function mapOutcome(text: string | null, answered: unknown): ParsedOutcome {
  const t = (text ?? "").trim();
  switch (t) {
    case "รับสาย":
      return { outcome: "ANSWERED", disposition: "NONE" };
    case "รับแล้วตัดสาย":
      return { outcome: "ANSWERED_HUNG_UP", disposition: "NONE" };
    case "รับแล้วเงียบ":
      return { outcome: "ANSWERED_SILENT", disposition: "NONE" };
    case "ไม่รับสาย":
      return { outcome: "NO_ANSWER", disposition: "NONE" };
    case "ติดต่อไม่ได้":
    case "ติดต่อไม้ได้":
      return { outcome: "UNREACHABLE", disposition: "NONE" };
    case "ตัดสาย":
      return { outcome: "CALL_DROPPED", disposition: "NONE" };
    case "ฝากข้อความ":
      return { outcome: "VOICEMAIL", disposition: "NONE" };
    case "ไม่สนใจ":
    case "ไม่่สนใจ":
      return { outcome: "NOT_INTERESTED", disposition: "NONE" };
    case "ไม่สะดวก":
      return { outcome: "INCONVENIENT", disposition: "NONE" };
    case "เลิกเล่น":
      return { outcome: "QUIT_PLAYING", disposition: "NONE" };
    case "ไม่ได้สมัคร":
      return { outcome: "NOT_REGISTERED", disposition: "NONE" };
    case "ซ้ำ":
      return { outcome: "DUPLICATE", disposition: "NONE" };
    case "โปร20%":
      return { outcome: "ANSWERED", disposition: "PROMO_20" };
    default:
      // ไม่มีข้อความ → เดาจาก boolean รับสาย
      if (answered === true) return { outcome: "ANSWERED", disposition: "NONE" };
      return { outcome: "OTHER", disposition: "NONE" };
  }
}

// ผลสายที่ถือว่า "ปิดงานแล้ว" (ไม่ต้องโทรซ้ำ)
const CLOSED: CallOutcome[] = [
  "ANSWERED",
  "ANSWERED_HUNG_UP",
  "ANSWERED_SILENT",
  "NOT_INTERESTED",
  "QUIT_PLAYING",
  "NOT_REGISTERED",
  "DUPLICATE",
];

function normalizePhone(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(10, "0").slice(-10);
}

/** เวลาแบบ HH.MM (เช่น 12.49 = 12:49) -> {hour, minute} */
function decodeTime(v: unknown): { hour: number; minute: number } {
  if (typeof v !== "number" || !isFinite(v)) return { hour: 0, minute: 0 };
  const hour = Math.floor(v);
  const minute = Math.round((v - hour) * 100);
  return { hour: Math.min(hour, 23), minute: Math.min(minute, 59) };
}

export type ImportSummary = {
  brands: number;
  customers: number;
  contacts: number;
  callLogs: number;
  deposits: number;
  bonuses: number;
  duplicateRows: number;
  skippedDoNotCall: number; // ลูกค้าห้ามโทรที่ข้ามตอน re-import
  skippedExisting: number; // ลูกค้าที่มีอยู่แล้วและถูกข้าม (โหมดกันซ้ำ)
  deletedEvents: number; // event เดิมที่ถูกลบทิ้งก่อนสร้างใหม่ (โหมด replace)
};

/** ผลการตรวจไฟล์ก่อนนำเข้า (ไม่เขียน DB) — ไว้เตือนข้อมูลซ้ำ */
export type ImportPreview = {
  totalRows: number; // แถวข้อมูลในไฟล์ (หลังกรองเบอร์ว่าง)
  totalCustomers: number; // ลูกค้า unique ในไฟล์
  newCustomers: number; // ยังไม่มีในระบบ
  existingCustomers: number; // มีอยู่แล้วในระบบ (= ข้อมูลซ้ำ)
  newBrands: number; // เว็บที่ยังไม่มีในระบบ
  duplicateRows: number; // เบอร์ซ้ำภายในไฟล์เดียวกัน
  callLogs: number; // จำนวนบันทึกโทรในไฟล์
  deposits: number;
  bonuses: number;
};

// โหมดการนำเข้า:
//  - append      = บันทึกเพิ่มทุกแถว (พฤติกรรมเดิม — re-import จะได้ event ซ้ำ)
//  - skipExisting = ข้ามลูกค้าที่มีอยู่แล้วทั้งคน (ไม่บันทึก event ของเขาเลย)
//  - replace     = นำเข้าทับ: ลบ event จากการนำเข้าเดิม (ในเดือนของไฟล์ ของลูกค้าในไฟล์) แล้วสร้างใหม่ → idempotent
export type ImportMode = "append" | "skipExisting" | "replace";
export type ImportOptions = { mode?: ImportMode };

type RowData = {
  brand: string;
  phone: string;
  call?: { calledAt: Date; outcome: CallOutcome; disposition: CallDisposition; smsSent: boolean };
  deposits: { date: Date; amount: number }[];
  bonus?: { date: Date; amount: number };
};

async function chunkedCreate<T>(
  rows: T[],
  create: (chunk: T[]) => Promise<unknown>,
  size = 1000
) {
  for (let i = 0; i < rows.length; i += size) {
    await create(rows.slice(i, i + size));
  }
}

/** ลบเป็นชุดตาม id (เลี่ยง IN list ยาวเกิน) — คืนจำนวนที่ลบรวม */
async function chunkedDelete(
  ids: number[],
  del: (chunk: number[]) => Promise<{ count: number }>,
  size = 1000
): Promise<number> {
  let total = 0;
  for (let i = 0; i < ids.length; i += size) {
    const r = await del(ids.slice(i, i + size));
    total += r.count;
  }
  return total;
}

export async function importExcelFromFile(
  prisma: PrismaClient,
  filePath: string,
  opts?: ImportOptions
): Promise<ImportSummary> {
  return importWorkbook(prisma, XLSX.readFile(filePath), opts);
}

/** นำเข้าจาก buffer (อัปโหลดผ่านเว็บ) — ใช้ logic เดียวกับ importExcelFromFile */
export async function importExcelFromBuffer(
  prisma: PrismaClient,
  buf: Buffer | ArrayBuffer,
  opts?: ImportOptions
): Promise<ImportSummary> {
  return importWorkbook(prisma, XLSX.read(buf, { type: "buffer" }), opts);
}

/** ตรวจไฟล์ก่อนนำเข้า (ไม่เขียน DB) — นับลูกค้าใหม่ vs ซ้ำ เพื่อเตือนผู้ใช้ */
export async function analyzeExcelFromBuffer(
  prisma: PrismaClient,
  buf: Buffer | ArrayBuffer
): Promise<ImportPreview> {
  const { brandNames, customerKeys, rows, duplicateRows } = parseWorkbook(XLSX.read(buf, { type: "buffer" }));
  const existingKeys = await getExistingKeys(prisma, brandNames);
  let existing = 0;
  for (const k of customerKeys) if (existingKeys.has(k)) existing++;
  const existingBrands = await prisma.brand.count({ where: { name: { in: [...brandNames] } } });

  let callLogs = 0,
    deposits = 0,
    bonuses = 0;
  for (const r of rows) {
    if (r.call) callLogs++;
    deposits += r.deposits.length;
    if (r.bonus) bonuses++;
  }

  return {
    totalRows: rows.length,
    totalCustomers: customerKeys.size,
    newCustomers: customerKeys.size - existing,
    existingCustomers: existing,
    newBrands: brandNames.size - existingBrands,
    duplicateRows,
    callLogs,
    deposits,
    bonuses,
  };
}

type ParsedWorkbook = {
  brandNames: Set<string>;
  customerKeys: Set<string>;
  rows: RowData[];
  duplicateRows: number;
};

/** อ่านไฟล์เป็นโครงข้อมูล (ไม่แตะ DB) — ใช้ร่วมกันทั้ง analyze และ import */
function parseWorkbook(wb: XLSX.WorkBook): ParsedWorkbook {
  const dataSheets = wb.SheetNames.filter((n) => !n.startsWith("สรุป"));

  const brandNames = new Set<string>();
  const customerKeys = new Set<string>(); // `${brand}|${phone}`
  const rows: RowData[] = [];
  let duplicateRows = 0;

  for (const brand of dataSheets) {
    brandNames.add(brand);
    const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[brand], {
      header: 1,
      defval: null,
      raw: true,
    });
    for (let i = HEADER_ROWS; i < raw.length; i++) {
      const r = raw[i] || [];
      const phone = normalizePhone(r[COL_PHONE]);
      if (!phone) continue;

      const key = `${brand}|${phone}`;
      if (customerKeys.has(key)) duplicateRows++;
      customerKeys.add(key);

      const row: RowData = { brand, phone, deposits: [] };

      // call
      const outcomeText = typeof r[COL_OUTCOME_TEXT] === "string" ? (r[COL_OUTCOME_TEXT] as string) : null;
      const callSerial = r[COL_CALL_DATE];
      if (typeof callSerial === "number" || outcomeText) {
        let calledAt: Date;
        if (typeof callSerial === "number") {
          const d = XLSX.SSF.parse_date_code(callSerial);
          const { hour, minute } = decodeTime(r[COL_CALL_TIME]);
          calledAt = bangkokDateTime(d.y, d.m, d.d, hour, minute);
        } else {
          calledAt = bangkokDateTime(YEAR, MONTH, 1, 0, 0);
        }
        const { outcome, disposition } = mapOutcome(outcomeText, r[4]);
        row.call = { calledAt, outcome, disposition, smsSent: r[COL_SMS] === true };
      }

      // deposits รายวัน (วันที่ 1..30)
      for (let day = 1; day <= 30; day++) {
        const amt = r[COL_DAY1_DEPOSIT + (day - 1) * 2];
        if (typeof amt === "number" && amt > 0) {
          row.deposits.push({ date: dateOnlyUTC(YEAR, MONTH, day), amount: amt });
        }
      }

      // bonus
      const bonusAmt = r[COL_BONUS_AMOUNT];
      if (typeof bonusAmt === "number" && bonusAmt > 0) {
        const bonusDate =
          typeof callSerial === "number"
            ? (() => {
                const d = XLSX.SSF.parse_date_code(callSerial);
                return dateOnlyUTC(d.y, d.m, d.d);
              })()
            : dateOnlyUTC(YEAR, MONTH, 1);
        row.bonus = { date: bonusDate, amount: bonusAmt };
      }

      rows.push(row);
    }
  }

  return { brandNames, customerKeys, rows, duplicateRows };
}

/** Set ของ key "ชื่อเว็บ|เบอร์" ที่มีอยู่แล้วในระบบ (เฉพาะเว็บที่อยู่ในไฟล์) */
async function getExistingKeys(prisma: PrismaClient, brandNames: Set<string>): Promise<Set<string>> {
  const brands = await prisma.brand.findMany({
    where: { name: { in: [...brandNames] } },
    select: { id: true, name: true },
  });
  if (brands.length === 0) return new Set();
  const idToName = new Map(brands.map((b) => [b.id, b.name]));
  const existing = await prisma.customer.findMany({
    where: { brandId: { in: brands.map((b) => b.id) } },
    select: { brandId: true, phone: true },
  });
  return new Set(existing.map((c) => `${idToName.get(c.brandId)}|${c.phone}`));
}

async function importWorkbook(
  prisma: PrismaClient,
  wb: XLSX.WorkBook,
  opts: ImportOptions = {}
): Promise<ImportSummary> {
  const mode = opts.mode ?? "append";
  const skipExisting = mode === "skipExisting";
  const importedAt = new Date(); // เวลาที่นำเข้ารอบนี้ (ทำเครื่องหมาย event ว่ามาจากการนำเข้า)
  const { brandNames, customerKeys, rows, duplicateRows } = parseWorkbook(wb);

  // โหมดกันซ้ำ: จับ key ที่มีอยู่แล้ว "ก่อน" สร้าง เพื่อข้ามไม่ให้บันทึก event ซ้ำ
  const existingKeys = skipExisting ? await getExistingKeys(prisma, brandNames) : new Set<string>();

  // 1) brands
  await prisma.brand.createMany({
    data: [...brandNames].map((name) => ({ name })),
    skipDuplicates: true,
  });
  const brands = await prisma.brand.findMany({ where: { name: { in: [...brandNames] } } });
  const brandId = new Map(brands.map((b) => [b.name, b.id]));

  // 2) customers (dedupe ด้วย unique [brandId, phone])
  await chunkedCreate(
    [...customerKeys].map((k) => {
      const [brand, phone] = k.split("|");
      return { brandId: brandId.get(brand)!, phone, status: "LAPSED" as const };
    }),
    (chunk) => prisma.customer.createMany({ data: chunk, skipDuplicates: true })
  );
  const customers = await prisma.customer.findMany({
    where: { brandId: { in: brands.map((b) => b.id) } },
    select: { id: true, brandId: true, phone: true, status: true },
  });
  const customerId = new Map(customers.map((c) => [`${c.brandId}|${c.phone}`, c.id]));
  const keyToCustomerId = (brand: string, phone: string) =>
    customerId.get(`${brandId.get(brand)}|${phone}`)!;
  // ลูกค้าห้ามโทร (จาก re-import บนข้อมูลเดิม) — ห้ามสร้างคิว/บันทึกใหม่ให้
  const dncCustomerIds = new Set(
    customers.filter((c) => c.status === "DO_NOT_CALL").map((c) => c.id)
  );

  // โหมดกันซ้ำ: ลูกค้าที่มีอยู่แล้วก่อนนำเข้า — ข้ามไม่บันทึก contact/call/deposit/bonus (กัน event ซ้ำ)
  const existingCustomerIds = new Set<number>();
  if (skipExisting) {
    for (const k of customerKeys) {
      if (existingKeys.has(k)) {
        const [brand, phone] = k.split("|");
        const id = keyToCustomerId(brand, phone);
        if (id != null) existingCustomerIds.add(id);
      }
    }
  }
  const skipIds = new Set<number>([...dncCustomerIds, ...existingCustomerIds]);

  // 3) campaign + contacts
  const campaign = await prisma.campaign.upsert({
    where: { id: (await prisma.campaign.findFirst({ where: { name: CAMPAIGN_NAME } }))?.id ?? -1 },
    update: {},
    create: { name: CAMPAIGN_NAME },
  });
  await chunkedCreate(
    [...customerKeys]
      .map((k) => {
        const [brand, phone] = k.split("|");
        return { campaignId: campaign.id, customerId: keyToCustomerId(brand, phone) };
      })
      .filter((c) => !skipIds.has(c.customerId)), // ข้ามลูกค้าห้ามโทร + รายที่มีอยู่แล้ว (โหมดกันซ้ำ)
    (chunk) => prisma.campaignContact.createMany({ data: chunk, skipDuplicates: true })
  );
  const contacts = await prisma.campaignContact.findMany({
    where: { campaignId: campaign.id },
    select: { id: true, customerId: true },
  });
  const contactId = new Map(contacts.map((c) => [c.customerId, c.id]));

  // โหมด replace: ลบ event "จากการนำเข้า" เดิม (ในเดือนของไฟล์ ของลูกค้าในไฟล์ ยกเว้นห้ามโทร) ก่อนสร้างใหม่
  // → import ไฟล์เดิมซ้ำกี่รอบก็ได้ผลเท่ากัน และเก็บยอดใหม่ของลูกค้าเดิมได้ครบ
  // ไม่แตะ: สายที่พนักงาน log ในแอป (callerId != null) และยอดที่กรอกมือ (importedAt = null)
  let deletedEvents = 0;
  if (mode === "replace") {
    const scopeCustomerIds = [...customerKeys]
      .map((k) => {
        const [brand, phone] = k.split("|");
        return keyToCustomerId(brand, phone);
      })
      .filter((id): id is number => id != null && !dncCustomerIds.has(id));
    const scopeContactIds = scopeCustomerIds
      .map((id) => contactId.get(id))
      .filter((id): id is number => id != null);

    const depFrom = dateOnlyUTC(YEAR, MONTH, 1);
    const depTo = dateOnlyUTC(YEAR, MONTH + 1, 1); // ต้นเดือนถัดไป (exclusive)
    const callFrom = bangkokDateTime(YEAR, MONTH, 1, 0, 0);
    const callTo = bangkokDateTime(YEAR, MONTH + 1, 1, 0, 0);

    deletedEvents += await chunkedDelete(scopeCustomerIds, (chunk) =>
      prisma.depositEvent.deleteMany({
        where: { customerId: { in: chunk }, importedAt: { not: null }, date: { gte: depFrom, lt: depTo } },
      })
    );
    deletedEvents += await chunkedDelete(scopeCustomerIds, (chunk) =>
      prisma.bonusAdjustment.deleteMany({
        where: { customerId: { in: chunk }, importedAt: { not: null }, date: { gte: depFrom, lt: depTo } },
      })
    );
    deletedEvents += await chunkedDelete(scopeContactIds, (chunk) =>
      prisma.callLog.deleteMany({
        where: { contactId: { in: chunk }, callerId: null, calledAt: { gte: callFrom, lt: callTo } },
      })
    );
  }

  // 4) call logs + deposits + bonuses + รวบรวม contact ที่ต้องปิดงาน
  const callLogs: {
    contactId: number;
    calledAt: Date;
    outcome: CallOutcome;
    disposition: CallDisposition;
    smsSent: boolean;
  }[] = [];
  const deposits: { customerId: number; date: Date; amount: number; importedAt: Date }[] = [];
  const bonuses: { customerId: number; date: Date; amount: number; importedAt: Date }[] = [];
  const doneContactIds = new Set<number>();
  let skippedDoNotCall = 0;
  let skippedExisting = 0;

  for (const row of rows) {
    const cid = keyToCustomerId(row.brand, row.phone);
    // ลูกค้าห้ามโทร: ไม่สร้าง contact/บันทึกใหม่ (ดูด้านบน) จึงข้าม call/deposit/bonus ด้วย
    if (dncCustomerIds.has(cid)) {
      skippedDoNotCall++;
      continue;
    }
    // โหมดกันซ้ำ: ลูกค้าที่มีอยู่แล้ว — ข้ามทั้ง call/deposit/bonus
    if (existingCustomerIds.has(cid)) {
      skippedExisting++;
      continue;
    }
    const ctId = contactId.get(cid)!;
    if (row.call) {
      callLogs.push({ contactId: ctId, ...row.call });
      if (CLOSED.includes(row.call.outcome)) doneContactIds.add(ctId);
    }
    for (const d of row.deposits) deposits.push({ customerId: cid, ...d, importedAt });
    if (row.bonus) bonuses.push({ customerId: cid, ...row.bonus, importedAt });
  }

  await chunkedCreate(callLogs, (chunk) => prisma.callLog.createMany({ data: chunk }));
  await chunkedCreate(deposits, (chunk) => prisma.depositEvent.createMany({ data: chunk }));
  await chunkedCreate(bonuses, (chunk) => prisma.bonusAdjustment.createMany({ data: chunk }));

  // 5) ปิดงาน contact ที่คุยจบแล้ว
  await chunkedCreate(
    [...doneContactIds],
    (chunk) =>
      prisma.campaignContact.updateMany({
        where: { id: { in: chunk } },
        data: { status: "DONE" },
      }),
    500
  );

  return {
    brands: brandNames.size,
    customers: customerKeys.size,
    contacts: contacts.length,
    callLogs: callLogs.length,
    deposits: deposits.length,
    bonuses: bonuses.length,
    duplicateRows,
    skippedDoNotCall,
    skippedExisting,
    deletedEvents,
  };
}
