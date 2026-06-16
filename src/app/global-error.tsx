"use client"; // global-error แทนที่ root layout ทั้งหมด — ต้องมี <html>/<body> เอง และไม่พึ่ง globals.css

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="th">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, Segoe UI, Sarabun, sans-serif",
          background: "#f1f5f9",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e6e9f1",
            borderRadius: 14,
            padding: "2rem",
            maxWidth: 520,
            textAlign: "center",
            boxShadow: "0 8px 30px rgba(15,23,42,0.08)",
          }}
        >
          <div style={{ fontSize: "2.5rem" }}>⚠️</div>
          <h2 style={{ margin: "0.4rem 0", color: "#0f172a" }}>ระบบขัดข้อง</h2>
          <p style={{ color: "#64748b" }}>
            เกิดข้อผิดพลาดร้ายแรง กรุณาลองใหม่ หากยังเป็นอยู่ให้แจ้งผู้ดูแลระบบ
          </p>
          {error.digest && (
            <p style={{ color: "#94a3b8", fontSize: "0.8rem" }}>
              รหัสอ้างอิง: <code>{error.digest}</code>
            </p>
          )}
          <button
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1rem",
              background: "#4f46e5",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "0.6rem 1.4rem",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            ลองอีกครั้ง
          </button>
        </div>
      </body>
    </html>
  );
}
