import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import ImportUploader from "./ImportUploader";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requirePermission("import.run");
  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>นำเข้าข้อมูลจากไฟล์ Excel</h1>
        <Link href="/admin/import/history" className="btn-secondary">ประวัติการนำเข้า →</Link>
      </div>
      <p className="muted">
        อัปโหลดไฟล์ตามรูปแบบเดิม (ชีทแยกตามเว็บ + ชีทสรุป) — ระบบจะอ่านเบอร์/วันเวลาโทร/ผลสาย/ยอดฝาก/โบนัสให้อัตโนมัติ
      </p>
      <div className="card">
        <ImportUploader />
      </div>
    </>
  );
}
