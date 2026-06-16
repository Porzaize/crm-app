// กราฟเส้น/พื้นที่ แนวโน้มรายวัน — server component ล้วน (ไม่มี client JS)
// ใช้ SVG + <title> เป็น tooltip ของเบราว์เซอร์ ไม่ต้องพึ่ง chart library

export type TrendPoint = { ymd: string; value: number };

const W = 640;
const PAD = { top: 12, right: 12, bottom: 24, left: 12 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

export default function TrendChart({
  points,
  color = "#4f46e5",
  format,
  height = 170,
  fill = true,
}: {
  points: TrendPoint[];
  color?: string;
  format: (v: number) => string;
  height?: number;
  fill?: boolean;
}) {
  if (points.length === 0) {
    return <p className="muted">ไม่มีข้อมูลในช่วงนี้</p>;
  }

  const plotW = W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const max = niceMax(Math.max(...points.map((p) => p.value)));
  const n = points.length;

  // x: กระจายเท่ากันเต็มความกว้าง (จุดเดียว = กึ่งกลาง)
  const xOf = (i: number) => PAD.left + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const yOf = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const linePts = points.map((p, i) => `${xOf(i)},${yOf(p.value)}`).join(" ");
  const areaPts = `${PAD.left},${PAD.top + plotH} ${linePts} ${xOf(n - 1)},${PAD.top + plotH}`;

  // ป้ายแกน x: แสดงประมาณ 6 ป้าย (วัน-เดือน)
  const labelStep = Math.max(1, Math.ceil(n / 6));
  const dayLabel = (ymd: string) => {
    const [, m, d] = ymd.split("-");
    return `${Number(d)}/${Number(m)}`;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      width="100%"
      height={height}
      role="img"
      style={{ display: "block", overflow: "visible" }}
    >
      {/* เส้นกริดแนวนอน + ป้ายค่าสูงสุด */}
      <line x1={PAD.left} y1={PAD.top} x2={W - PAD.right} y2={PAD.top} stroke="#e5e7eb" strokeWidth={1} />
      <line
        x1={PAD.left}
        y1={PAD.top + plotH}
        x2={W - PAD.right}
        y2={PAD.top + plotH}
        stroke="#e5e7eb"
        strokeWidth={1}
      />
      <text x={PAD.left} y={PAD.top - 2} fontSize={11} fill="#6b7280">
        {format(max)}
      </text>

      {fill && (
        <polygon points={areaPts} fill={color} fillOpacity={0.12} stroke="none" />
      )}
      <polyline
        points={linePts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {points.map((p, i) => (
        <g key={p.ymd}>
          <circle cx={xOf(i)} cy={yOf(p.value)} r={2.5} fill={color} />
          {/* hit area กว้างขึ้นเพื่อ hover ง่าย + tooltip native */}
          <rect
            x={xOf(i) - plotW / (2 * n)}
            y={PAD.top}
            width={plotW / n}
            height={plotH}
            fill="transparent"
          >
            <title>{`${p.ymd}: ${format(p.value)}`}</title>
          </rect>
          {i % labelStep === 0 && (
            <text x={xOf(i)} y={height - 6} fontSize={10} fill="#6b7280" textAnchor="middle">
              {dayLabel(p.ymd)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
