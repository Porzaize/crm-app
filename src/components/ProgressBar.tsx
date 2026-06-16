/**
 * แถบความคืบหน้า (เช่น เป้าโทรรายวัน) — เต็มเป็นสีเขียวเมื่อถึงเป้า
 * server component ล้วน ไม่ต้องใช้ client
 */
export default function ProgressBar({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const reached = max > 0 && value >= max;
  return (
    <div className="progress" title={`${value} / ${max}`}>
      <div
        className="progress-fill"
        style={{ width: `${ratio * 100}%`, background: reached ? "var(--green)" : "var(--primary)" }}
      />
    </div>
  );
}
