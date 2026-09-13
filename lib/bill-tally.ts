/* ตัวนับผลของตัวเก็บบิล — **แยกเหตุผลที่ "ข้าม" ออกจากกัน**
 *
 * 🔴 ปัญหาที่ไฟล์นี้เกิดมาแก้ (เจอ 12 ก.ย. 2569 ตอนตรวจหลัง deploy):
 *    ของเดิมมีตัวนับ `skipped` ตัวเดียว ใช้นับสามเหตุผลรวมกัน
 *      ① มีไฟล์นี้ในถังอยู่แล้ว  ② เลขบัญชีใน PDF ไม่ตรง  ③ เขียนลงถังไม่สำเร็จ
 *    ⇒ ผลของ meta เมื่อคืน (fetched 2 · skipped 2 · uploaded 0) **แปลได้สามแบบ**
 *       และเราต้องไปไล่โค้ดเอาเองถึงจะเดาได้ว่าเป็นแบบไหน
 *    ⇒ วันไหนตัวกรองเลขบัญชีเริ่มคัดผิดจนบิลจริงหายทุกใบ **ผลจะหน้าตาเหมือนคืนนั้นเป๊ะ**
 *       = ตัวเลขที่เปลี่ยนความหมายไปคนละขั้วโดยที่หน้าจอไม่ขยับสักหลัก
 *
 * 🔑 กฎที่ CEO สั่งไว้ตอนอนุมัติงานนี้ (12 ก.ย. 2569):
 *    **ผลรวมของสามตัวใหม่ต้องเท่ากับ `skipped` เดิมเสมอ และต้องมีเทสตรึงข้อนั้น**
 *    ไม่งั้นเราจะได้ตัวเลขที่บวกไม่ลงตัวแล้วไม่รู้ว่าหายไปทางไหน
 *    ⇒ `skipped` จึงไม่ใช่ตัวนับอีกต่อไป แต่เป็น **ผลบวกที่คิดจากสามตัวนั้น** (บวกไม่ลงตัวไม่ได้โดยโครงสร้าง)
 *
 * ⚠️ ห้ามเพิ่มตัวนับใหม่แล้วลืมใส่ใน skippedTotal — เทส bill-tally.test.mjs จับข้อนี้
 */

export type BillTally = {
  uploaded: number
  failed: number
  fetched: number
  /** มีไฟล์ชื่อนี้ในถังแล้ว ⇒ ไม่ต้องโหลดซ้ำ (ทางที่ถูกและดี ไม่ใช่ความผิดพลาด) */
  skippedExists: number
  /** โหลดมาแล้ว แต่ในเนื้อ PDF ไม่มีเลขบัญชีที่ตั้งไว้ ⇒ คัดทิ้ง */
  skippedWrongAccount: number
  /** เขียนลงถังแล้วได้ false (มีไฟล์ชื่อนั้นเกิดขึ้นระหว่างทาง) — ปกติแทบไม่เกิด */
  skippedNoWrite: number
  /** ใบที่ถูกคัดเพราะเลขบัญชีไม่ตรง — เก็บ "ใบไหนบ้าง" ไว้ตอบคำถามว่าเดือนอะไร
   *  ⚠️ เก็บแค่รหัสอ้างอิงกับเดือน **ห้ามใส่เนื้อความบิล** (เอกสารการเงินของร้าน) */
  rejected: { messageId: string; month: string; file: string }[]
}

export const emptyTally = (): BillTally => ({
  uploaded: 0, failed: 0, fetched: 0,
  skippedExists: 0, skippedWrongAccount: 0, skippedNoWrite: 0,
  rejected: [],
})

/** `skipped` ของเดิม = ผลบวกของสามเหตุผล — คิดจากตัวนับจริง ห้ามนับแยกอีกตัว */
export const skippedTotal = (t: BillTally): number =>
  t.skippedExists + t.skippedWrongAccount + t.skippedNoWrite

/** มีอยู่แล้วในถัง — `alreadyHave` กับ `skippedExists` คือเหตุการณ์เดียวกัน
 *  ⇒ บวกด้วยฟังก์ชันเดียวกันเสมอ จะได้ไม่มีวันเหลื่อมกัน (เดิมบวกสองบรรทัดแยกกัน) */
export function countExists(t: BillTally): void { t.skippedExists++ }

export function countWrongAccount(t: BillTally, ref: { messageId: string; month: string; file: string }): void {
  t.skippedWrongAccount++
  /* เก็บไว้ไม่เกิน 20 ใบพอ — ช่องนี้มีไว้ให้คนอ่านตามรอย ไม่ใช่ให้เอาไปตัดสินใจ
     ⚠️ ใครจะเอาไปนับ ให้ใช้ skippedWrongAccount เสมอ (เลขเพื่อการแสดงผล ห้ามใช้ตัดสินใจ) */
  if (t.rejected.length < 20) t.rejected.push(ref)
}

export function countNoWrite(t: BillTally): void { t.skippedNoWrite++ }

/** รูปร่างที่ส่งออกทาง API — `skipped` ยังอยู่ครบเพื่อไม่ให้ของเดิมที่อ่านค่านี้พัง
 *  `alreadyHave` = skippedExists (ชื่อเดิมที่คนนอกใช้อยู่) */
export function tallyReport(t: BillTally) {
  return {
    uploaded: t.uploaded,
    skipped: skippedTotal(t),
    alreadyHave: t.skippedExists,
    fetched: t.fetched,
    failed: t.failed,
    skippedExists: t.skippedExists,
    skippedWrongAccount: t.skippedWrongAccount,
    skippedNoWrite: t.skippedNoWrite,
    /* มีเฉพาะตอนมีของถูกคัดจริง — ไม่มีก็ไม่ต้องมีคีย์ให้คนเข้าใจผิดว่า "ตรวจแล้วไม่มี" */
    ...(t.rejected.length ? { rejectedSample: t.rejected } : {}),
  }
}
