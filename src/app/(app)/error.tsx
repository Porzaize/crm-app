"use client"; // error boundary ต้องเป็น Client Component

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // log ไป stderr → Vercel เก็บใน Function Logs (ใช้ digest จับคู่ฝั่ง server ได้)
    console.error("[app error boundary]", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="card" style={{ maxWidth: 560, margin: "3rem auto", textAlign: "center" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "0.4rem" }}>⚠️</div>
      <h2 style={{ marginTop: 0 }}>เกิดข้อผิดพลาด</h2>
      <p className="muted">
        ระบบทำงานผิดพลาดชั่วคราว ลองใหม่อีกครั้ง หากยังเป็นอยู่ กรุณาแจ้งผู้ดูแลระบบ
      </p>
      {error.digest && (
        <p className="muted" style={{ fontSize: "0.8rem" }}>
          รหัสอ้างอิง: <code>{error.digest}</code>
        </p>
      )}
      <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", marginTop: "1rem" }}>
        <button onClick={() => unstable_retry()}>ลองอีกครั้ง</button>
        <Link href="/" className="btn-secondary">
          กลับหน้าหลัก
        </Link>
      </div>
    </div>
  );
}
