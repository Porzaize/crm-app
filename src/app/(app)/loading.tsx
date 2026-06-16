// Skeleton ระหว่างเปลี่ยนหน้า — Next แสดงทันทีขณะ server component รอ query DB
// ทำให้คลิกเปลี่ยนหน้าแล้วเห็นผลทันที (ไม่ค้างรอ) — sidebar คงอยู่จาก layout
export default function Loading() {
  return (
    <div className="page-skeleton" aria-busy="true" aria-label="กำลังโหลด">
      <div className="skeleton skel-title" />
      <div className="card-grid" style={{ marginBottom: "1.3rem" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card stat">
            <div className="skeleton skel-line short" />
            <div className="skeleton skel-line value" />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="skeleton skel-line" style={{ width: "30%" }} />
        <div className="skeleton skel-line" />
        <div className="skeleton skel-line" />
        <div className="skeleton skel-line" style={{ width: "70%" }} />
      </div>
    </div>
  );
}
