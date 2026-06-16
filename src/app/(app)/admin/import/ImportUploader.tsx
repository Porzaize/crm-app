"use client";

import { useState } from "react";

type Preview = {
  totalRows: number;
  totalCustomers: number;
  newCustomers: number;
  existingCustomers: number;
  newBrands: number;
  duplicateRows: number;
  callLogs: number;
  deposits: number;
  bonuses: number;
};

type ImportMode = "append" | "skipExisting" | "replace";

type Summary = {
  brands: number;
  customers: number;
  contacts: number;
  callLogs: number;
  deposits: number;
  bonuses: number;
  duplicateRows: number;
  skippedDoNotCall: number;
  skippedExisting: number;
  deletedEvents: number;
};

const SUMMARY_ROWS: { key: keyof Summary; label: string }[] = [
  { key: "customers", label: "ลูกค้า (รวมในไฟล์)" },
  { key: "deletedEvents", label: "ลบของเดิม (นำเข้าทับ)" },
  { key: "skippedExisting", label: "ข้ามรายที่มีอยู่แล้ว" },
  { key: "callLogs", label: "บันทึกการโทรที่เพิ่ม" },
  { key: "deposits", label: "รายการฝากที่เพิ่ม" },
  { key: "bonuses", label: "รายการโบนัสที่เพิ่ม" },
  { key: "skippedDoNotCall", label: "ข้าม (ห้ามโทร)" },
  { key: "duplicateRows", label: "แถวซ้ำในไฟล์" },
];

type Phase = "idle" | "analyzing" | "preview" | "importing" | "done";

export default function ImportUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<{ summary: Summary; secs: string } | null>(null);

  function reset() {
    setPhase("idle");
    setError(null);
    setPreview(null);
    setResult(null);
  }

  async function analyze() {
    if (!file) return;
    setPhase("analyzing");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "analyze");
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "อ่านไฟล์ไม่สำเร็จ");
        setPhase("idle");
      } else {
        setPreview(data.preview);
        setPhase("preview");
      }
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
      setPhase("idle");
    }
  }

  async function doImport(mode: ImportMode) {
    if (!file) return;
    setPhase("importing");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "นำเข้าล้มเหลว");
        setPhase("preview");
      } else {
        setResult({ summary: data.summary, secs: data.secs });
        setPhase("done");
      }
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
      setPhase("preview");
    }
  }

  const hasDup = preview && preview.existingCustomers > 0;

  return (
    <>
      {error && <div className="alert error">{error}</div>}

      {/* ขั้นที่ 1: เลือกไฟล์ + ตรวจสอบ */}
      {(phase === "idle" || phase === "analyzing") && (
        <>
          <div className="field">
            <label htmlFor="file">เลือกไฟล์ Excel (.xlsx)</label>
            <input
              id="file"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                reset();
              }}
            />
          </div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            ระบบจะ <b>ตรวจสอบก่อน</b> ว่ามีข้อมูลซ้ำหรือไม่ แล้วค่อยให้ยืนยันการนำเข้า
          </p>
          <button type="button" onClick={analyze} disabled={!file || phase === "analyzing"}>
            {phase === "analyzing" ? "กำลังตรวจสอบ…" : "🔍 ตรวจสอบไฟล์"}
          </button>
        </>
      )}

      {/* ขั้นที่ 2: ผลตรวจสอบ + เตือนซ้ำ + เลือกนำเข้า */}
      {phase !== "idle" && phase !== "analyzing" && preview && (
        <div className="card" style={{ background: "var(--surface-2)", marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>ผลการตรวจสอบไฟล์</h3>
          <div className="card-grid" style={{ marginBottom: "1rem" }}>
            <div className="card stat" style={{ margin: 0 }}>
              <div className="label">ลูกค้าในไฟล์</div>
              <div className="value">{preview.totalCustomers.toLocaleString("th-TH")}</div>
            </div>
            <div className="card stat" style={{ margin: 0 }}>
              <div className="label">ลูกค้าใหม่</div>
              <div className="value" style={{ color: "var(--green)" }}>
                {preview.newCustomers.toLocaleString("th-TH")}
              </div>
            </div>
            <div className="card stat" style={{ margin: 0 }}>
              <div className="label">ซ้ำกับในระบบ</div>
              <div className="value" style={{ color: hasDup ? "var(--amber)" : undefined }}>
                {preview.existingCustomers.toLocaleString("th-TH")}
              </div>
            </div>
            <div className="card stat" style={{ margin: 0 }}>
              <div className="label">เว็บใหม่</div>
              <div className="value">{preview.newBrands.toLocaleString("th-TH")}</div>
            </div>
          </div>

          {hasDup ? (
            <div className="alert" style={{ background: "var(--amber-bg)", color: "var(--amber)", border: "1px solid #fde68a" }}>
              ⚠️ <b>พบข้อมูลซ้ำ {preview.existingCustomers.toLocaleString("th-TH")} ราย</b> (ลูกค้าเหล่านี้มีอยู่ในระบบแล้ว)
              <br />
              แนะนำ <b>“นำเข้าทับ (อัปเดต)”</b> — จะลบข้อมูลโทร/ฝาก/โบนัส<b>จากการนำเข้าเดิม</b>ของเดือนนี้ทิ้งแล้วสร้างใหม่จากไฟล์
              (ไม่ซ้ำ + อัปเดตยอดใหม่ของลูกค้าเดิมครบ · ไม่แตะสายที่พนักงานบันทึกในแอปและยอดที่กรอกมือ)
            </div>
          ) : (
            <div className="alert success">✓ ไม่พบข้อมูลซ้ำ — นำเข้าได้ทันที</div>
          )}

          {phase !== "done" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "0.5rem" }}>
              {hasDup ? (
                <>
                  <button type="button" onClick={() => doImport("replace")} disabled={phase === "importing"}>
                    {phase === "importing" ? "กำลังนำเข้า…" : "นำเข้าทับ (อัปเดต) — แนะนำ"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => doImport("skipExisting")} disabled={phase === "importing"}>
                    {phase === "importing" ? "กำลังนำเข้า…" : `เฉพาะรายใหม่ (${preview.newCustomers.toLocaleString("th-TH")} ราย)`}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => doImport("append")} disabled={phase === "importing"}>
                    {phase === "importing" ? "กำลังนำเข้า…" : "เพิ่มทั้งหมด (ยอมให้ซ้ำ)"}
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => doImport("replace")} disabled={phase === "importing"}>
                  {phase === "importing" ? "กำลังนำเข้า…" : "นำเข้าข้อมูล"}
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={reset} disabled={phase === "importing"}>
                ยกเลิก
              </button>
            </div>
          )}
        </div>
      )}

      {/* ขั้นที่ 3: ผลนำเข้า */}
      {phase === "done" && result && (
        <div>
          <div className="alert success">นำเข้าสำเร็จ ({result.secs}s)</div>
          <table>
            <tbody>
              {SUMMARY_ROWS.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td className="num">{result.summary[r.key].toLocaleString("th-TH")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={reset} style={{ marginTop: "1rem" }}>
            นำเข้าไฟล์อื่น
          </button>
        </div>
      )}
    </>
  );
}
