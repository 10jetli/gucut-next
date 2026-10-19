/** 🥧 วงกลมแบ่งสัดส่วนแบบ ZORT (โหมดเหมือน ZORT · ภาพ /Dashboard/ContactReport · /Dashboard/ProductReport 19 ต.ค. 2569: % เขียนสีขาวในชิ้น)
 *  ใช้ร่วม: รายงานลูกค้า · รายงานสินค้า
 *  ⚠️ วาดจากเลขชุดเดียวกับบรรทัดคำอธิบายข้าง ๆ เท่านั้น — ไม่มีเลขใหม่ · ชิ้นที่ศูนย์ไม่วาด
 *  ⚠️ % คิดจากผลรวมของชิ้นที่ส่งมา (ถ้ามีก้อน "นอก 500 รายแรก" ก็รวมด้วย) */
export default function ZortPie({ ชิ้น, ป้าย, ขนาด = 260 }: { ชิ้น: { ค่า: number; สี: string }[]; ป้าย: string; ขนาด?: number }) {
  const รวม = ชิ้น.reduce((n, x) => n + Math.max(0, x.ค่า), 0)
  if (!รวม) return null
  let มุม = -Math.PI / 2
  const R = 48, cx = 50, cy = 50
  return (
    <svg viewBox="0 0 100 100" className="shrink-0" style={{ width: ขนาด, height: ขนาด }} role="img" aria-label={ป้าย}>
      {ชิ้น.filter((x) => x.ค่า > 0).map((x, i) => {
        const ส่วน = x.ค่า / รวม
        const a0 = มุม, a1 = มุม + ส่วน * 2 * Math.PI
        มุม = a1
        const กลาง = (a0 + a1) / 2
        const d = ส่วน >= 0.9999
          ? `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R} Z`
          : `M ${cx} ${cy} L ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 ${ส่วน > 0.5 ? 1 : 0} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)} Z`
        return (
          <g key={i}>
            <path d={d} fill={x.สี} stroke="#fff" strokeWidth="0.6" />
            {ส่วน >= 0.05 && (
              <text x={cx + R * 0.62 * Math.cos(กลาง)} y={cy + R * 0.62 * Math.sin(กลาง)} fill="#fff" fontSize="5.2" fontWeight="600"
                textAnchor="middle" dominantBaseline="middle">{(Math.round(ส่วน * 1000) / 10).toFixed(1)}%</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
