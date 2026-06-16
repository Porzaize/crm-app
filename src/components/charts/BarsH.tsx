// แท่งแนวนอน (leaderboard) — server component ล้วน ใช้ CSS divs (ดู globals.css .bars-h*)

export default function BarsH({
  data,
  format,
  color = "#4f46e5",
  emptyText = "ไม่มีข้อมูล",
}: {
  data: { label: string; value: number }[];
  format: (v: number) => string;
  color?: string;
  emptyText?: string;
}) {
  if (data.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="bars-h">
      {data.map((d) => (
        <div className="bars-h-row" key={d.label} title={`${d.label}: ${format(d.value)}`}>
          <div className="bars-h-label">{d.label}</div>
          <div className="bars-h-track">
            <div
              className="bars-h-fill"
              style={{ width: `${(d.value / max) * 100}%`, background: color }}
            />
          </div>
          <div className="bars-h-value">{format(d.value)}</div>
        </div>
      ))}
    </div>
  );
}
