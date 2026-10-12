/* หน้า "เวอร์ชันแว่น" — ท่านประธานสั่งเอง 11 ต.ค. 2569
 *   "ทำเวอร์ชันแว่นใส่นี้ด้วย  บอกวันที่ทำ · เวอร์ชันที่ทำได้ · โหลดได้"
 *
 * 🔑 เป็น **server component** โดยตั้งใจ — ดึงสารบัญจาก R2 ที่ฝั่งเซิร์ฟเวอร์
 *    ถ้าให้เบราว์เซอร์ดึงเอง จะต้องไปเติม CORS ให้ video.gucut.com ซึ่งเป็น
 *    ของที่ "วางทับของเดิมแล้วพังเงียบ" (ดูบทเรียน r2-cors-per-domain)
 *    ⇒ ฝั่งเซิร์ฟเวอร์ดึงแทน ไม่ต้องแตะ CORS เลย
 *
 * 🔑 รายการเวอร์ชันอยู่ใน **ไฟล์บน R2 ไม่ได้อยู่ในโค้ด**
 *    ⇒ ออกรุ่นใหม่แล้วแก้ `apk/glasses-versions.json` อย่างเดียว ไม่ต้อง deploy หน้านี้ใหม่
 *    ⚠️ แปลว่าหน้านี้จะ "เก่า" ตามไฟล์นั้น — ใครอัป APK แล้วลืมแก้ไฟล์สารบัญ
 *       หน้านี้จะไม่รู้จักรุ่นใหม่ และ**ไม่มีอะไรฟ้อง** จึงต้องโชว์ "อัปเดตเมื่อ" ให้เห็นเสมอ
 */

export const dynamic = 'force-dynamic'

const ฐาน = 'https://video.gucut.com/apk'

type รุ่นแอป = {
  เวอร์ชัน: string
  code: number
  วันที่: string
  ไฟล์: string
  ขนาด: number
  ล่าสุด: boolean
  ทำอะไรได้: string[]
  สิทธิ์: string[]
}
type สารบัญ = {
  อัปเดตเมื่อ: string
  แอป: string
  แพ็กเกจ: string
  หมายเหตุ?: string
  รุ่น: รุ่นแอป[]
}

async function ดึงสารบัญ(): Promise<{ ข้อมูล: สารบัญ | null; เหตุ?: string }> {
  try {
    // ⚠️ video.gucut.com มี Cache Rule ที่ขอบ **30 วัน และไม่สนใจ cache-control จากต้นทาง**
    //    ⇒ อัปทับชื่อเดิมแล้วอ่านได้ของเก่า (พิสูจน์ 11 ต.ค. 2569: ได้สารบัญ 3 รุ่นทั้งที่อัป 13 รุ่นไปแล้ว)
    //    ⇒ ต้องแนบ query ที่เปลี่ยนทุกนาที — Cloudflare แคชแยกตาม URL เต็มรวม query
    //    (ไม่ใช้วินาที เพราะจะไม่ได้ใช้แคชเลย · นาทีละครั้งพอ ข้อมูลนี้เปลี่ยนไม่บ่อย)
    const กันแคช = Math.floor(Date.now() / 60000)
    const r = await fetch(`${ฐาน}/glasses-versions.json?t=${กันแคช}`, { cache: 'no-store' })
    if (!r.ok) return { ข้อมูล: null, เหตุ: `อ่านสารบัญไม่ได้ (HTTP ${r.status})` }
    const d = (await r.json()) as สารบัญ
    // ⚠️ 200 ไม่ได้แปลว่าได้ของ — ต้องเช็กว่ามีรายการจริง (http-200-empty-payload)
    if (!Array.isArray(d?.รุ่น) || d.รุ่น.length === 0)
      return { ข้อมูล: null, เหตุ: 'สารบัญอ่านได้แต่ไม่มีรายการเวอร์ชันเลย' }
    return { ข้อมูล: d }
  } catch (e) {
    return { ข้อมูล: null, เหตุ: String((e as Error)?.message ?? e) }
  }
}

const วันไทย = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const เดือน = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return y && m && d ? `${d} ${เดือน[m - 1]} ${y + 543}` : iso
}
const กิโล = (b: number) => `${(b / 1024).toFixed(0)} KB`

export default async function หน้าเวอร์ชันแว่น() {
  const { ข้อมูล, เหตุ } = await ดึงสารบัญ()

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900">เวอร์ชันแอปแว่น</h1>
      <p className="mt-1 text-sm text-gray-600">
        {ข้อมูล ? `${ข้อมูล.แอป} · ${ข้อมูล.แพ็กเกจ}` : 'แอปบนแว่น Rokid'} — กดโหลดแล้วติดตั้งที่แว่นได้เลย
      </p>

      {!ข้อมูล && (
        /* 🔑 อ่านไม่ได้ = บอกตรง ๆ ว่า "ยังไม่รู้" ห้ามโชว์รายการค้างในโค้ดแทน
           ไม่งั้นหน้าจะดูปกติทั้งที่ของจริงอาจเปลี่ยนไปแล้ว */
        <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">ยังอ่านรายการเวอร์ชันไม่ได้</p>
          <p className="mt-1 text-sm text-amber-800">{เหตุ}</p>
          <p className="mt-2 text-xs text-amber-700">
            สารบัญอยู่ที่ <code>{ฐาน}/glasses-versions.json</code> — ตัวไฟล์ APK ยังโหลดได้ตามปกติ
          </p>
        </div>
      )}

      {ข้อมูล && (
        <>
          <div className="mt-5 space-y-3">
            {ข้อมูล.รุ่น.map((v) => (
              <div
                key={v.เวอร์ชัน}
                className={`rounded-lg border p-4 ${
                  v.ล่าสุด ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-gray-900">v{v.เวอร์ชัน}</span>
                  {/* 🔑 emerald-**700** ไม่ใช่ 600 — วัดแล้ว (12 ต.ค. 2569)
                      ขาวบน emerald-600 (#059669) = **3.77:1** ⇒ ตก 4.5:1 ของ WCAG AA
                      ขาวบน emerald-700 (#047857) = **5.48:1** ⇒ ผ่าน
                      ⚠️ ป้ายนี้เป็น text-xs font-bold ⇒ **ไม่ใช่ตัวใหญ่** ⇒ เกณฑ์ยัง 4.5:1 ไม่ใช่ 3:1 */}
                  {v.ล่าสุด && (
                    <span className="rounded bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white">
                      ล่าสุด
                    </span>
                  )}
                  <span className="text-sm text-gray-600">{วันไทย(v.วันที่)}</span>
                  <span className="text-xs tabular-nums text-gray-500">
                    code {v.code} · {กิโล(v.ขนาด)}
                  </span>
                  <a
                    href={`${ฐาน}/${v.ไฟล์}`}
                    className="ml-auto rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    ⬇ โหลด
                  </a>
                </div>

                <ul className="mt-2 space-y-1">
                  {v.ทำอะไรได้.map((t, i) => (
                    <li key={i} className="text-sm leading-relaxed text-gray-800">
                      • {t}
                    </li>
                  ))}
                </ul>

                <p className="mt-2 text-xs text-gray-500">
                  สิทธิ์ที่ขอ: {v.สิทธิ์.join(' · ')}
                  {!v.สิทธิ์.includes('RECORD_AUDIO') && ' (ไม่มีไมค์ ⇒ พูดใส่แว่นไม่ได้)'}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            {/* 🚫 เคยมีลิงก์ jor-claude-latest.apk ตรงนี้ — **ถอดออกแล้ว 11 ต.ค. 2569**
                เพราะ Cache Rule ที่ขอบจำชื่อไฟล์เดิมไว้ 30 วัน ⇒ อัปทับแล้วยังได้ของเก่า
                (พิสูจน์: อัป v5 ทับ latest แต่โหลดมาได้ v4.4) ⇒ ใช้ชื่อที่มีเลขเวอร์ชันเท่านั้น */}
            <p>
              <strong>ลิงก์ตัวล่าสุด:</strong>{' '}
              <a
                className="text-blue-700 underline"
                href={`${ฐาน}/${(ข้อมูล.รุ่น.find((x) => x.ล่าสุด) ?? ข้อมูล.รุ่น[0]).ไฟล์}`}
              >
                {ฐาน}/{(ข้อมูล.รุ่น.find((x) => x.ล่าสุด) ?? ข้อมูล.รุ่น[0]).ไฟล์}
              </a>
            </p>
            <p className="mt-2 text-xs text-gray-600">
              สารบัญอัปเดตเมื่อ {วันไทย(ข้อมูล.อัปเดตเมื่อ)} — หน้านี้อ่านจากไฟล์นั้น
              ออกรุ่นใหม่แล้วต้องแก้ไฟล์สารบัญด้วย ไม่งั้นรุ่นใหม่จะไม่ขึ้นที่นี่
            </p>
            {ข้อมูล.หมายเหตุ && (
              <p className="mt-2 text-xs text-gray-600">⚠️ {ข้อมูล.หมายเหตุ}</p>
            )}
            <p className="mt-2 text-xs text-gray-600">
              ซอร์สโค้ดอยู่ที่ GitHub <code>10jetli/gucut-macterm</code> (private) ·
              สำเนาที่สองบน g1 <code>~/repos/gucut-macterm</code> · สำเนาที่สามที่ Linode สิงคโปร์
            </p>
          </div>
        </>
      )}
    </div>
  )
}
