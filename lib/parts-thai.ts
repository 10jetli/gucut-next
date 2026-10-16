/* แปลชื่ออะไหล่เป็นไทย — ท่านประธานสั่ง 17 ต.ค. 2569 ("แปลไทย")

   ชื่ออะไหล่ในคู่มือมี **2,863 แบบ** แต่คำศัพท์จริงมีแค่ **477 คำ**
   ⇒ แปลเป็น "คำ" ไม่ใช่ "ประโยค" · ครอบทั้ง 17 รุ่นด้วยพจนานุกรมชุดเดียว
     และรุ่นที่เพิ่มมาใหม่ก็ได้คำแปลฟรีทันทีถ้าใช้คำเดิม

   🔴 **สามข้อห้ามของไฟล์นี้**
   1. **คำที่ไม่รู้จักต้องคงภาษาอังกฤษไว้ ห้ามตัดทิ้ง ห้ามเดา**
      ตัดทิ้ง = ชื่อเพี้ยนเงียบ ๆ ("Spline screw IS-M5x20" → "สกรู" แล้วขนาดหาย
      ซึ่งอันตรายมากเพราะสกรูต่างขนาดหน้าตาเหมือนกัน) · เดา = คนสั่งของผิดตัว
   2. **ต้องโชว์ชื่ออังกฤษเดิมคู่กันเสมอ** ห้ามแทนที่
      คนที่กรอกหน้านี้ถือ **คู่มือภาษาอังกฤษ** อยู่ในมือ ถ้าจอโชว์แต่ไทย
      เขาจะหาแถวในคู่มือไม่เจอ ⇒ คำแปลที่ทำให้ทำงานช้าลงคือคำแปลที่ผิดหน้าที่
   3. **ห้ามรายงานว่า "แปลไทยแล้ว" ถ้าแปลได้บางคำ** — มีตัววัดความครอบคลุมจริง
      (`scripts/วัดคำแปลอะไหล่.mjs`) และคำที่ยังไม่รู้จักต้องถูกพิมพ์ออกมาเป็นรายชื่อ
      ไม่ใช่กลบด้วยค่าเฉลี่ยสวย ๆ

   ⚠️ รหัสขนาด (IS-M5x20 · M4x12 · 3.9x9.5) กับชื่อประเทศ/ยี่ห้อ (USA · CDN · NGK · Bosch)
      **ตั้งใจไม่แปล** — เป็นรหัสที่ต้องตรงกับของจริง แปลแล้วเสียความหมาย */

/** พจนานุกรมอะไหล่เลื่อยยนต์ — คำ/วลี → ไทย
 *  เรียงยาวก่อนสั้นตอนใช้ ("torsion spring" ต้องชนะ "spring")
 *  🔑 เพิ่มคำใหม่ที่นี่ที่เดียว แล้วทุกรุ่นได้ตามทันที */
export const พจนานุกรมอะไหล่: Record<string, string> = {
  // ── วลี (ต้องจับก่อนคำเดี่ยว) ──
  /* เติมรอบสอง 17 ต.ค. 2569 — คัดจาก 55 รูปชื่อที่พบบ่อยที่สุด
     🔴 **เหตุที่ต้องมีวลี ไม่ใช่แค่คำ**: ไทยเรียงขยายหลังคำหลัก อังกฤษเรียงก่อน
        แปลคำต่อคำจะได้ "ซีล แหวน" (ควรเป็น "แหวนซีล") · "หัวกลมแบน หัว สกรูเกลียวปล่อย"
        ⇒ ตัววัดขึ้น 100% ได้ทั้งที่ภาษาอ่านไม่รู้เรื่อง เพราะมันวัดแค่ "ไม่มีอังกฤษค้าง"
           **ตัววัดนี้ไม่ได้วัดลำดับคำ และวัดไม่ได้** ⇒ ต้องอ่านด้วยตาเสมอ */
  'pan head self-tapping screw': 'สกรูเกลียวปล่อยหัวกลมแบน',
  'pan head screw': 'สกรูหัวกลมแบน',
  'hexagon head screw': 'สกรูหัวหกเหลี่ยม',
  'cylindrical pin': 'สลักทรงกระบอก',
  'cylindrical screw': 'สกรูทรงกระบอก',
  'lock nut': 'น็อตล็อก',
  'spring washer': 'แหวนสปริง',
  'sealing washer': 'แหวนซีล',
  'o-ring': 'โอริง',
  'e-clip': 'คลิปตัวอี',
  'grooved ball bearing': 'ลูกปืนเม็ดกลมร่องลึก',
  'insulating hose': 'ท่อยางฉนวน',
  'valve jet': 'นมหนูวาล์ว',
  'fixed jet': 'นมหนูตายตัว',
  'pump diaphragm': 'ไดอะแฟรมปั๊ม',
  'inlet control lever': 'คันคุมน้ำมันเข้า',
  'throttle shaft with lever': 'แกนคันเร่งพร้อมคัน',
  'choke shaft with lever': 'แกนโช้กพร้อมคัน',
  'idle speed adjustment screw': 'สกรูปรับรอบเดินเบา',
  'high speed adjustment screw': 'สกรูปรับรอบสูง',
  'low speed adjustment screw': 'สกรูปรับรอบต่ำ',
  'speed adjustment screw': 'สกรูปรับรอบ',
  'terminal socket': 'เบ้าขั้วสาย',
  'ignition lead': 'สายหัวเทียน',
  'chain scabbard': 'ปลอกหุ้มโซ่',
  'cylinder gasket': 'ปะเก็นกระบอกสูบ',
  'cylinder with piston': 'กระบอกสูบพร้อมลูกสูบ',
  'model plate': 'แผ่นป้ายรุ่น',
  'set of gaskets': 'ชุดปะเก็น',
  'set of grommets': 'ชุดยางรอง',
  'set of carburetor parts': 'ชุดอะไหล่คาร์บูเรเตอร์',
  'rim sprocket kit': 'ชุดสเตอร์แบบถอดได้',
  'tool roll': 'ซองเครื่องมือ',
  'combination wrench': 'ประแจรวมสองหัว',
  'air filter, fleece': 'กรองอากาศแบบใยสังเคราะห์',
  'air filter, flocked': 'กรองอากาศแบบเคลือบขนสั้น',
  'wind vane': 'ใบกินลม',
  'valve body': 'ตัวเรือนวาล์ว',
  'supporting fork': 'ง่ามรับ',
  'clamping bar': 'เหล็กจับยึด',
  'annular lever': 'คันวงแหวน',
  'binding thread': 'เกลียวยึดแน่น',
  'oil line': 'ท่อน้ำมัน',
  'non-return valve': 'วาล์วกันกลับ',
  'anti-dust screen': 'ตะแกรงกันฝุ่น',
  'tube joints': 'ข้อต่อท่อ',
  'not for': 'ไม่ใช้กับ',
  'torsion spring': 'สปริงบิด',
  'tension spring': 'สปริงดึง',
  'compression spring': 'สปริงกด',
  'leaf spring': 'แหนบ',
  'round head screw': 'สกรูหัวกลม',
  'oval head screw': 'สกรูหัวรูปไข่',
  'countersunk screw': 'สกรูหัวจม',
  'collar screw': 'สกรูมีบ่า',
  'spline screw': 'สกรูหัวร่องดาว',
  'hexagon screw': 'สกรูหัวหกเหลี่ยม',
  'hexagon nut': 'น็อตหกเหลี่ยม',
  'hexagon head': 'หัวหกเหลี่ยม',
  'self tapping screw': 'สกรูเกลียวปล่อย',
  'self-tapping screw': 'สกรูเกลียวปล่อย',
  'grub screw': 'สกรูหัวจมไร้หัว',
  'binding screw': 'สกรูยึดสาย',
  'adjusting screw': 'สกรูปรับตั้ง',
  'sealing ring': 'แหวนซีล',
  'snap ring': 'แหวนล็อก',
  'circlip': 'แหวนล็อก',
  'woodruff key': 'ลิ่มพระจันทร์',
  'annular buffer': 'ยางรองกันสั่น',
  'antivibration': 'กันสั่น',
  'anti vibration': 'กันสั่น',
  'spark plug': 'หัวเทียน',
  'spark arresting screen': 'ตะแกรงกันสะเก็ดไฟ',
  'ignition coil': 'คอยล์จุดระเบิด',
  'ignition module': 'กล่องจุดระเบิด',
  'air filter': 'กรองอากาศ',
  'oil pump': 'ปั๊มน้ำมันโซ่',
  'oil tank': 'ถังน้ำมันโซ่',
  'fuel tank': 'ถังน้ำมันเชื้อเพลิง',
  'filler cap': 'ฝาเติม',
  'pickup body': 'ตัวดูดน้ำมัน',
  'metering diaphragm': 'ไดอะแฟรมวัดน้ำมัน',
  'impulse hose': 'ท่อแรงดันคาร์บู',
  'intake manifold': 'ท่อร่วมไอดี',
  'inlet needle': 'เข็มน้ำมันเข้า',
  'throttle lever': 'คันเร่ง',
  'throttle trigger': 'ไกเร่ง',
  'throttle shutter': 'ลิ้นเร่ง',
  'choke shutter': 'ลิ้นโช้ก',
  'choke lever': 'คันโช้ก',
  'chain brake': 'เบรกโซ่',
  'chain sprocket': 'สเตอร์โซ่',
  'rim sprocket': 'สเตอร์แบบถอดได้',
  'spur sprocket': 'สเตอร์ติดดุม',
  'chain tensioner': 'ตัวปรับความตึงโซ่',
  'chain catcher': 'ตัวดักโซ่',
  'guide bar': 'บาร์',
  'saw chain': 'โซ่เลื่อย',
  'bar nut': 'น็อตยึดบาร์',
  'clutch drum': 'ดุมคลัตช์',
  'clutch shoe': 'ผ้าคลัตช์',
  'starter rope': 'เชือกสตาร์ท',
  'starter grip': 'มือจับเชือกสตาร์ท',
  'rewind spring': 'สปริงดึงเชือกกลับ',
  'recoil starter': 'ชุดสตาร์ทดึง',
  'starter cover': 'ฝาครอบสตาร์ท',
  'fan housing': 'โครงพัดลม',
  'fan wheel': 'ใบพัดลม',
  'flywheel': 'ล้อแม่เหล็ก',
  'crankcase': 'เสื้อข้อเหวี่ยง',
  'crankshaft': 'เพลาข้อเหวี่ยง',
  'connecting rod': 'ก้านสูบ',
  'piston ring': 'แหวนลูกสูบ',
  'piston pin': 'สลักลูกสูบ',
  'cylinder': 'กระบอกสูบ',
  'needle cage': 'ปลอกลูกปืนเข็ม',
  'ball bearing': 'ลูกปืนกลม',
  'oil seal': 'ซีลกันน้ำมัน',
  'hand guard': 'การ์ดกันมือ',
  'hand knob': 'ปุ่มหมุนมือ',
  'handle bar': 'คานจับ',
  'handlebar': 'คานจับ',
  'rear handle': 'มือจับหลัง',
  'front handle': 'มือจับหน้า',
  'muffler': 'ท่อไอเสีย',
  'heat shield': 'แผ่นกันความร้อน',
  'insulating plate': 'แผ่นฉนวน',
  'end cover': 'ฝาปิดท้าย',
  'gasket set': 'ชุดปะเก็น',
  'repair kit': 'ชุดซ่อม',
  'instruction manual': 'คู่มือการใช้งาน',
  'nameplate': 'แผ่นป้ายชื่อ',
  'warning label': 'ป้ายเตือน',
  'bumper spike': 'เล็บยึดไม้',
  'felt wick': 'ไส้สักหลาด',
  'sight glass': 'กระจกดูระดับ',
  'speed limit': 'จำกัดรอบ',
  'idle speed': 'รอบเดินเบา',
  'threadlocking adhesive': 'กาวล็อกเกลียว',
  'high altitude': 'พื้นที่สูง',
  'short circuit': 'วงจรสั้น',
  'wiring harness': 'ชุดสายไฟ',

  // ── คำเดี่ยว ──
  /* เติม 17 ต.ค. 2569 จากผลตัววัด — คำที่เคยมีแต่ในรูปวลี ทำให้รูปเดี่ยว/พหูพจน์หลุด
     🔑 บทเรียน: พจนานุกรมที่มีแต่วลี ครอบ "Sealing ring" ได้ แต่พลาด "Sealing washer"
        แบบเงียบ ๆ ⇒ ต้องมีคำเดี่ยวคู่ทุกวลีเสมอ */
  gaskets: 'ปะเก็น', grommets: 'ยางรอง', joints: 'จุดต่อ', sealing: 'ซีล',
  insulating: 'ฉนวน', grooved: 'มีร่อง', fleece: 'ใยสังเคราะห์', flocked: 'เคลือบขนสั้น',
  roll: 'ม้วน', combination: 'รวมสองหัว', binding: 'ยึดแน่น', line: 'สาย',
  fanwheel: 'ใบพัดลม', annular: 'วงแหวน', vane: 'ใบพัด', body: 'ตัวเรือน',
  supporting: 'ตัวรับ', shutter: 'ลิ้น', stroke: 'ระยะชัก', clamping: 'ยึดจับ',
  not: 'ไม่', tooth: 'ฟัน', teeth: 'ฟัน',
  screw: 'สกรู', bolt: 'สลักเกลียว', nut: 'น็อต', washer: 'แหวน', spring: 'สปริง',
  gasket: 'ปะเก็น', seal: 'ซีล', ring: 'แหวน', pin: 'สลัก', clip: 'คลิป', rivet: 'หมุดย้ำ',
  stud: 'สลักเกลียวฝัง', spacer: 'ปลอกรอง', shim: 'แผ่นชิม', bushing: 'ปลอกบู๊ช', bush: 'ปลอกบู๊ช',
  sleeve: 'ปลอก', collar: 'บ่า', retainer: 'ตัวยึด', holder: 'ตัวจับ', bracket: 'ขายึด',
  cover: 'ฝาครอบ', cap: 'ฝา', plug: 'ปลั๊กอุด', grommet: 'ยางรอง', buffer: 'ยางกันสั่น',
  damper: 'ตัวกันสั่น', plate: 'แผ่น', sheet: 'แผ่น', strip: 'แถบ', band: 'สายรัด',
  clamp: 'แคลมป์', strap: 'สายรัด', hose: 'ท่อยาง', pipe: 'ท่อ', tube: 'ท่อ',
  elbow: 'ข้องอ', nipple: 'หัวต่อ', connector: 'ขั้วต่อ', terminal: 'ขั้วสาย',
  lead: 'สายไฟ', wire: 'สายไฟ', cable: 'สาย', cord: 'สาย', coil: 'คอยล์',
  capacitor: 'ตัวเก็บประจุ', switch: 'สวิตช์', contact: 'หน้าสัมผัส', ignitor: 'ตัวจุดระเบิด',
  magneto: 'แมกนีโต', stator: 'สเตเตอร์', rotor: 'โรเตอร์', generator: 'ไดชาร์จ',
  carburetor: 'คาร์บูเรเตอร์', carburettor: 'คาร์บูเรเตอร์', diaphragm: 'ไดอะแฟรม',
  jet: 'นมหนู', needle: 'เข็ม', valve: 'วาล์ว', pump: 'ปั๊ม', filter: 'ไส้กรอง',
  prefilter: 'กรองหยาบ', strainer: 'ตะแกรงกรอง', screen: 'ตะแกรง', mesh: 'ตะแกรงถี่',
  cleaner: 'ตัวกรอง', breather: 'ช่องระบาย', vent: 'ช่องระบาย',
  piston: 'ลูกสูบ', shaft: 'เพลา', axle: 'เพลา', spindle: 'แกนหมุน', rod: 'ก้าน',
  lever: 'คัน', trigger: 'ไก', knob: 'ปุ่มหมุน', button: 'ปุ่ม', grip: 'มือจับ',
  handle: 'มือจับ', guard: 'การ์ด', shield: 'แผ่นกัน', deflector: 'แผ่นบังคับทิศ',
  housing: 'โครง', casing: 'โครงหุ้ม', case: 'โครง', frame: 'โครง', box: 'กล่อง',
  tank: 'ถัง', drum: 'ดุม', pulley: 'มู่เล่', sprocket: 'สเตอร์', gear: 'เฟือง',
  pinion: 'เฟืองขับ', gearbox: 'ชุดเกียร์', clutch: 'คลัตช์', brake: 'เบรก',
  pawl: 'ตัวสับ', ratchet: 'ตัวกันถอย', bearing: 'ลูกปืน', roller: 'ลูกกลิ้ง',
  wheel: 'ล้อ', fan: 'พัดลม', shroud: 'ฝาครอบลม', baffle: 'แผ่นกั้น', louver: 'ช่องลม',
 exhaust: 'ไอเสีย', insulator: 'ฉนวน', insulation: 'ฉนวน',
  sealant: 'กาวซีล', adhesive: 'กาว', grease: 'จาระบี', oil: 'น้ำมัน', chain: 'โซ่',
  bar: 'บาร์', scabbard: 'ปลอกหุ้มบาร์', spike: 'เล็บ', bumper: 'กันกระแทก',
  starter: 'ชุดสตาร์ท', rope: 'เชือก', reel: 'ล้อเก็บเชือก',
  throttle: 'คันเร่ง', choke: 'โช้ก', governor: 'ตัวคุมรอบ', ignition: 'จุดระเบิด',
  decompression: 'ลดแรงอัด', engine: 'เครื่องยนต์', support: 'ตัวรับ', supporter: 'ตัวรับ',
  stopper: 'ตัวหยุด', lock: 'ตัวล็อก', lockout: 'ตัวล็อกกันเผลอ', interlock: 'ตัวล็อกร่วม',
  hook: 'ตะขอ', eye: 'หูเกี่ยว', joint: 'จุดต่อ', pivot: 'จุดหมุน', fork: 'ง่าม',
  arm: 'แขน', link: 'ข้อต่อ', wedge: 'ลิ่ม', key: 'ลิ่ม', shank: 'ก้านจับ',
  adapter: 'ตัวแปลง', adaptor: 'ตัวแปลง', nozzle: 'หัวฉีด', gun: 'หัวพ่น',
  gauge: 'เกจวัด', label: 'ป้าย', decal: 'สติกเกอร์', pictogram: 'ป้ายรูป',
  reflector: 'แผ่นสะท้อนแสง', foil: 'แผ่นฟอยล์', tag: 'ป้ายติด',
  tool: 'เครื่องมือ', wrench: 'ประแจ', spanner: 'ประแจ', screwdriver: 'ไขควง',
  pliers: 'คีม', puller: 'ตัวดึง', file: 'ตะไบ', cutter: 'ตัวตัด', driver: 'ตัวขับ',
  bag: 'ถุง', kit: 'ชุด', set: 'ชุด', assembly: 'ชุดประกอบ', assy: 'ชุดประกอบ',
  ass: 'ชุดประกอบ', comp: 'ชุด', module: 'กล่องควบคุม', system: 'ระบบ', unit: 'ชุด',
  element: 'ไส้', insert: 'ตัวสอด', base: 'ฐาน', boss: 'หัวนูน', flange: 'หน้าแปลน',
  cup: 'ถ้วย', bellows: 'ยางหุ้มพับ', boot: 'ยางหุ้ม', rubber: 'ยาง', sponge: 'ฟองน้ำ',
  felt: 'สักหลาด', wick: 'ไส้', mat: 'แผ่นรอง', pad: 'แผ่นรอง', seat: 'บ่ารอง',
  guide: 'ตัวนำ', slide: 'ตัวเลื่อน', slider: 'ตัวเลื่อน', carrier: 'ตัวพา',
  plunger: 'ลูกสูบเล็ก', ball: 'ลูกกลม', cage: 'ปลอกลูกปืน',
  thrust: 'กันรุน', tensioner: 'ตัวปรับความตึง', tensioning: 'ปรับความตึง',
  adjuster: 'ตัวปรับ', adjustment: 'การปรับตั้ง', control: 'ควบคุม',
  heating: 'ทำความร้อน', heater: 'ตัวทำความร้อน', preheating: 'อุ่นเครื่อง',
  cooling: 'ระบายความร้อน', heat: 'ความร้อน', pressure: 'แรงดัน', vacuum: 'สุญญากาศ',
  intake: 'ไอดี', inlet: 'ทางเข้า', outlet: 'ทางออก', manifold: 'ท่อร่วม',
  protector: 'ตัวป้องกัน', protecting: 'ป้องกัน', protective: 'ป้องกัน',
  stiffener: 'ตัวเสริมความแข็ง', molding: 'คิ้วขอบ', shell: 'เปลือก', nose: 'ปลาย',
  harness: 'ชุดสายไพ', pickup: 'ตัวดูด', metering: 'วัดปริมาณ', impulse: 'แรงดล',
  flat: 'แบน', round: 'กลม', oval: 'รูปไข่', hollow: 'กลวง', notched: 'มีรอยบาก',
  slotted: 'มีร่อง', splined: 'มีร่องฟัน', spline: 'ร่องฟัน', helical: 'เกลียว',
  thread: 'เกลียว', hexagon: 'หกเหลี่ยม', cylindrical: 'ทรงกระบอก',
  countersunk: 'หัวจม', pan: 'หัวกลมแบน', head: 'หัว', socket: 'หัวจม',
  allen: 'หกเหลี่ยม', double: 'คู่', twin: 'คู่', single: 'เดี่ยว', split: 'ผ่าซีก',
  inner: 'ใน', outer: 'นอก', front: 'หน้า', rear: 'หลัง', left: 'ซ้าย', right: 'ขวา',
  top: 'บน', side: 'ข้าง', main: 'หลัก', short: 'สั้น', long: 'ยาว', high: 'สูง',
  low: 'ต่ำ', medium: 'กลาง', hard: 'แข็ง', soft: 'นุ่ม', standard: 'มาตรฐาน',
  normal: 'ปกติ', special: 'พิเศษ', fixed: 'ยึดแน่น', quick: 'เร็ว', easy: 'ง่าย',
  start: 'สตาร์ท', starting: 'สตาร์ท', stop: 'หยุด', warm: 'อุ่น', hot: 'ร้อน',
  dust: 'ฝุ่น', dirt: 'สิ่งสกปรก', chip: 'เศษไม้', snow: 'หิมะ', wind: 'ลม',
  air: 'อากาศ', water: 'น้ำ', fuel: 'เชื้อเพลิง', ground: 'สายดิน',
  friction: 'เสียดทาน', strength: 'กำลัง', torsional: 'บิด', tension: 'ดึง',
  compression: 'อัด', rewind: 'ดึงกลับ', recoil: 'ดึงกลับ', return: 'คืนตัว',
  parts: 'อะไหล่', piece: 'ชิ้น', pieces: 'ชิ้น', spare: 'อะไหล่สำรอง',
  repair: 'ซ่อม', instruction: 'คู่มือ', manual: 'คู่มือ', warning: 'เตือน',
  version: 'รุ่น', model: 'รุ่น', type: 'ชนิด', size: 'ขนาด', length: 'ความยาว',
  depth: 'ความลึก', limit: 'จำกัด', speed: 'ความเร็ว', idle: 'เดินเบา',
  saw: 'เลื่อย', rescue: 'กู้ภัย', conversion: 'ชุดแปลง', extension: 'ตัวต่อ',
  available: 'มีจำหน่าย', only: 'เฉพาะ', with: 'พร้อม', without: 'ไม่มี',
  for: 'สำหรับ', of: 'ของ', in: 'ใน', to: 'ถึง', up: 'ถึง', and: 'และ',
  around: 'รอบ', complete: 'ครบชุด', filing: 'ลับคม', filler: 'เติม',
  flameout: 'ดับเครื่อง', encapsulated: 'หุ้มสาร', micro: 'ไมโคร',
  shake: 'สั่น', proof: 'กัน', blind: 'ตาบอด', points: 'จุด', contra: 'ตรงข้าม',
  knot: 'ปม', knee: 'หัวเข่า', hub: 'ดุม', drive: 'ขับ', block: 'บล็อก',
  check: 'กันกลับ', worm: 'เกลียวหนอน', banjo: 'ข้อต่อแบนโจ',
  twist: 'บิด', curving: 'โค้ง', spiked: 'มีเล็บ', shoulder: 'บ่า',
  sealed: 'ปิดผนึก', locking: 'ล็อก', mount: 'แท่นยึด', tie: 'สายรัด',
  helper: 'ตัวช่วย', push: 'กด', pull: 'ดึง', deflecting: 'บังคับทิศ',
  casting: 'ชิ้นหล่อ', nylon: 'ไนลอน', passive: 'ไม่ทำงานเอง', arresting: 'ดักจับ',
  ascending: 'เพิ่มขึ้น', adjust: 'ปรับ', adjusting: 'ปรับตั้ง', position: 'ตำแหน่ง',
  parallel: 'ขนาน', star: 'ดาว', wing: 'ปีก', wrap: 'หุ้ม', wing_nut: 'น็อตปีก',
  sub: 'ย่อย', shoe: 'ผ้า', brush: 'แปรง', board: 'แผง', panel: 'แผง',
}

/** คำที่ **ตั้งใจไม่แปล** — รหัส ยี่ห้อ ประเทศ มาตรฐาน
 *  ⚠️ ต้องแยกออกจาก "คำที่ยังไม่รู้จัก" ไม่งั้นตัววัดจะฟ้องคำพวกนี้ตลอดกาล
 *     แล้วรายชื่อ "ยังไม่แปล" จะยาวจนไม่มีใครอ่าน = ตัววัดที่ไร้ประโยชน์ */
export const ไม่ต้องแปล = new Set([
  'usa', 'cdn', 'aus', 'nz', 'brazil', 'usda', 'cert', 'din', 'bs', 'arctic', 'skand',
  'chinese', 'ngk', 'bosch', 'bpmr', 'bpm', 'wsr', 'wj', 'wt', 'wvh', 'bing',
  'stihl', 'ms', 'is', 'sw', 'fb', 'br', 'bt', 'ht', 'hl', 'bp', 'nd', 'za', 'dz',
  'av', 'ac', 'ca', 'wr', 'lb', 'ls', 'lh', 'rs', 'hd', 'st', 'al', 'qs', 'ey',
  'rds', 'frp', 'scs', 'prc', 'oxsv', 'ihscm', 'ihsct', 'ihscfm', 'ccrpant',
  'picco', 'duro', 'magnum', 'ergostart', 'elastostart', 'helicoil', 'dirko',
  'aveq', 'pinne', 'ledskena', 'boll', 'colar', 'screew', 'compete', 'pro',
  'red', 'white', 'rapid', 'segment', 'mm', 'cm', 'off', 'on', 'non', 'anti',
  'self', 'tapping', 'crank', 'cat', 'spur', 'rim', 'nylon',
  'c-b', 'ey-v', // รหัสรุ่น/รหัสกล่องจุดระเบิด ไม่ใช่คำ
])

const เรียงยาวก่อน = Object.keys(พจนานุกรมอะไหล่).sort((a, b) => b.length - a.length)

export type ผลแปล = {
  /** ข้อความไทยที่แปลได้ (คำที่ไม่รู้จักคงอังกฤษไว้) */
  ไทย: string
  /** แปลได้กี่คำ / ทั้งหมดกี่คำที่ควรแปล (ไม่นับรหัสขนาดกับคำในรายการไม่ต้องแปล) */
  แปลได้: number
  ควรแปล: number
  /** คำที่ยังไม่มีในพจนานุกรม — ตัววัดเอาไปพิมพ์เป็นรายชื่อ ห้ามกลบ */
  คำที่ไม่รู้จัก: string[]
}

/** แปลชื่ออะไหล่หนึ่งชื่อ
 *  ⚠️ ชื่อที่เป็นไทยอยู่แล้ว (เช่น 7800 SUPER-S ที่กรอกมือไว้) คืนตามเดิม ไม่แตะ */
export function แปลชื่ออะไหล่(ชื่อ: string): ผลแปล {
  const ดิบ = String(ชื่อ || '').trim()
  if (!ดิบ) return { ไทย: '', แปลได้: 0, ควรแปล: 0, คำที่ไม่รู้จัก: [] }
  if (/[฀-๿]/.test(ดิบ)) {
    return { ไทย: ดิบ, แปลได้: 0, ควรแปล: 0, คำที่ไม่รู้จัก: [] }
  }

  /* แทนวลีก่อน แล้วค่อยคำเดี่ยว ("torsion spring" ต้องชนะ "spring")
     🔑 คำแปลทุกตัวเป็นอักษรไทยล้วน ไม่มีอังกฤษปน ⇒ ของที่แปลแล้วถูกแปลซ้ำไม่ได้
        ⚠️ วันไหนเพิ่มคำแปลที่มีอังกฤษปน **ต้องกลับมาใส่ตัวกันแปลซ้ำที่นี่**
     ⚠️ ขอบคำใช้ lookaround ไม่ใช่กลุ่มจับ — กลุ่มจับจะ "กิน" ตัวอักษรข้างหลังไป
        ทำให้คำสองคำที่ติดกันโดนข้ามหนึ่งคำแบบเงียบ ๆ */
  let งาน = ดิบ
  let แปลได้ = 0
  for (const คำ of เรียงยาวก่อน) {
    const หนี = คำ.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    const re = new RegExp(`(?<![A-Za-z])${หนี}(?![A-Za-z])`, 'gi')
    งาน = งาน.replace(re, () => { แปลได้++; return พจนานุกรมอะไหล่[คำ] })
  }
  const ไทย = งาน.replace(/\s{2,}/g, ' ').trim()

  /* นับคำที่เหลือเป็นอังกฤษ — หักคำในรายการไม่ต้องแปล และหักรหัสขนาด (มีตัวเลขติด) */
  const คำที่ไม่รู้จัก: string[] = []
  /* ⚠️ **รหัสขนาดไม่ใช่คำที่แปลไม่ได้** — `IS-M5x18` `C1Q-S57C` `O-ring 7x1.5`
     ถ้าหยิบเฉพาะส่วนตัวอักษร (`is-m` `q-s` `o-`) จะได้รายชื่อ "ยังไม่แปล"
     ที่อันดับต้น ๆ เป็นของที่ตั้งใจไม่แปลตั้งแต่ต้น ⇒ คนเลิกเชื่อรายชื่อทั้งใบ
     เกณฑ์: โทเคนที่มีตัวเลขติดในก้อนเดียวกัน = รหัส */
  /* ⚠️ `Array.from` ไม่ใช่ for-of — tsconfig ของ gucut-next target ต่ำกว่า es2015
     วน matchAll ตรง ๆ จะ tsc แดง (TS2802) */
  for (const m of Array.from(ไทย.matchAll(/[A-Za-z][A-Za-z0-9-]*/g))) {
    if (/\d/.test(m[0])) continue
    const l = m[0].replace(/-+$/, '').toLowerCase()
    if (ไม่ต้องแปล.has(l) || l.length < 2) continue
    if (!คำที่ไม่รู้จัก.includes(l)) คำที่ไม่รู้จัก.push(l)
  }
  return { ไทย, แปลได้, ควรแปล: แปลได้ + คำที่ไม่รู้จัก.length, คำที่ไม่รู้จัก }
}
