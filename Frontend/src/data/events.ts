import type { EventType, PublishStatus, Zone } from '../types'
import { DEFAULT_ZONES } from './zones'

export interface EventSeed {
  id: string
  type: EventType
  status: PublishStatus
  title: string
  /** ต่อท้ายชื่องานด้วยรอบตามเดือน เช่น รอบตุลาคม */
  roundByMonth?: boolean
  organizerId: string
  venue: string
  hours: string
  description: string
  /** ปิดรับจองก่อนวันงานกี่วัน (เปิดรับจองตามค่าตั้งต้นใน settings) */
  closeBefore: number
  autoApprove?: boolean
  /** จำนวนล็อกสูงสุดต่อผู้ขาย (ไม่ระบุ = ค่าตั้งต้นใน settings) */
  maxLotsPerSeller?: number
  /** รหัสล็อกที่ผู้จัดงานปิดไม่ให้จอง */
  disabledLots?: string[]
  /** ขนาดเฉพาะบางล็อก ที่ต่างจากขนาดของโซน */
  lotSizes?: Record<string, string>
  /** วันเริ่มงาน นับจากวันนี้ (ติดลบ = ผ่านไปแล้ว) */
  startInDays: number
  length: number
  /** คิดราคาเพิ่มวันเสาร์อาทิตย์หรือไม่ */
  weekendSurcharge: boolean
  zones: Zone[]
  /** สัดส่วนล็อกที่มีคนจองแล้ว และที่รออนุมัติ ใช้สร้างการจองตัวอย่าง */
  demo: { fill: number; pending: number }
}

const zones = (prices: [number, number, number], names?: [string, string, string]): Zone[] =>
  DEFAULT_ZONES.map((z, i) => ({ ...z, price: prices[i], name: names?.[i] ?? z.name, amenities: [...z.amenities] }))

export const EVENT_SEEDS: EventSeed[] = [
  {
    id: 'e1', type: 'ตลาดนัด', status: 'open', title: 'ตลาดนัดสวนรถไฟ ไนท์มาร์เก็ต', roundByMonth: true, organizerId: 'o1',
    venue: 'สวนวชิรเบญจทัศ กรุงเทพฯ', hours: '16:00–23:00 น.', closeBefore: 3, startInDays: 5, length: 3, weekendSurcharge: true,
    description: 'ตลาดกลางคืนริมสวน เน้นอาหาร ของทำมือ และเสื้อผ้ามือสอง มีที่จอดรถสำหรับผู้ขายหลังเวที เข้าติดตั้งร้านได้ตั้งแต่ 14:00 น.',
    zones: zones([350, 250, 500]), maxLotsPerSeller: 2, disabledLots: ['B12', 'B24'],
    lotSizes: { C06: '4×2 ม.' }, demo: { fill: 0.45, pending: 0.06 },
  },
  {
    id: 'e2', type: 'งานแฟร์', status: 'open', title: 'งานหนังสือมือสองและของสะสม ครั้งที่ 7', organizerId: 'o2',
    venue: 'สามย่านมิตรทาวน์ กรุงเทพฯ', hours: '10:00–21:00 น.', closeBefore: 3, startInDays: 12, length: 3, weekendSurcharge: true,
    description: 'รวมร้านหนังสือมือสอง แผ่นเสียง โปสการ์ด และของสะสม จัดในฮอลล์ปรับอากาศ มีโต๊ะและเก้าอี้ให้ร้านละ 1 ชุด',
    zones: zones([450, 350, 700], ['โซนหนังสือหายาก', 'โซนทั่วไป', 'โซนหน้าทางเข้า']), disabledLots: ['C06'], demo: { fill: 0.55, pending: 0.05 },
  },
  {
    id: 'e3', type: 'งานมหาวิทยาลัย', status: 'open', title: 'เปิดบ้านวิศวะ Open House', organizerId: 'o3',
    venue: 'ลานเกียร์ มหาวิทยาลัยเกษตรศาสตร์', hours: '09:00–17:00 น.', closeBefore: 3, startInDays: 19, length: 2, weekendSurcharge: false,
    description: 'งานเปิดบ้านประจำปี มีนักเรียนมัธยมและผู้ปกครองมาเยี่ยมชมกว่า 8,000 คนต่อวัน ร้านอาหารต้องมีถังขยะของตัวเอง',
    zones: zones([200, 150, 300], ['โซนอาหาร', 'โซนทั่วไป', 'โซนเครื่องดื่ม']), demo: { fill: 0.3, pending: 0.04 },
  },
  {
    id: 'e4', type: 'ตลาดนัด', status: 'open', title: 'กาดคราฟต์วันอาทิตย์', organizerId: 'o4',
    venue: 'ถนนนิมมานเหมินท์ เชียงใหม่', hours: '15:00–22:00 น.', closeBefore: 1, startInDays: 21, length: 1, weekendSurcharge: false,
    description: 'ตลาดงานคราฟต์และงานออกแบบ เน้นสินค้าทำมือจากเชียงใหม่และภาคเหนือ ปิดถนนให้คนเดินตลอดงาน',
    zones: zones([250, 200, 400], ['โซนอาหาร', 'โซนงานทำมือ', 'โซนหน้าทางเข้า']), demo: { fill: 0.72, pending: 0.05 },
  },
  {
    id: 'e5', type: 'งานแฟร์', status: 'open', title: 'Coffee & Craft Fest อีสาน', organizerId: 'o5',
    venue: 'เซ็นทรัล ขอนแก่น', hours: '11:00–21:00 น.', closeBefore: 7, startInDays: 26, length: 3, weekendSurcharge: true,
    description: 'เทศกาลกาแฟและงานคราฟต์ของภาคอีสาน มีเวทีบรรยายและเวิร์กช็อปตลอดสามวัน',
    zones: zones([380, 300, 550], ['โซนกาแฟ', 'โซนงานคราฟต์', 'โซนหน้าทางเข้า']), demo: { fill: 0.3, pending: 0.04 },
  },
  {
    id: 'e6', type: 'งานมหาวิทยาลัย', status: 'open', title: 'ลอยกระทงริมคลอง ม.ศิลปากร', organizerId: 'o6',
    venue: 'วิทยาเขตพระราชวังสนามจันทร์ นครปฐม', hours: '17:00–23:00 น.', closeBefore: 3, startInDays: 36, length: 2, weekendSurcharge: false,
    description: 'งานลอยกระทงริมคลองของมหาวิทยาลัย มีประกวดกระทงและการแสดงดนตรีของนักศึกษา',
    zones: zones([240, 180, 360], ['โซนอาหาร', 'โซนทั่วไป', 'โซนริมคลอง']), demo: { fill: 0.35, pending: 0.03 },
  },
  {
    id: 'e8', type: 'ตลาดนัด', status: 'closed', title: 'ตลาดเขียวสัญจร ม.มหิดล ศาลายา', organizerId: 'o1',
    venue: 'ลานจอดรถ มหาวิทยาลัยมหิดล ศาลายา', hours: '08:00–14:00 น.', closeBefore: 3, startInDays: 14, length: 2, weekendSurcharge: false,
    description: 'ตลาดผักผลไม้ปลอดสารและอาหารพื้นบ้าน จัดร่วมกับมหาวิทยาลัย',
    zones: zones([300, 220, 350]), demo: { fill: 0.8, pending: 0.03 },
  },
  {
    id: 'e9', type: 'ตลาดนัด', status: 'draft', title: 'ตลาดนัดสวนรถไฟ ไนท์มาร์เก็ต', roundByMonth: true, organizerId: 'o1',
    venue: 'สวนวชิรเบญจทัศ กรุงเทพฯ', hours: '16:00–23:00 น.', closeBefore: 3, startInDays: 33, length: 3, weekendSurcharge: true,
    description: 'ตลาดกลางคืนริมสวน เน้นอาหาร ของทำมือ และเสื้อผ้ามือสอง เข้าติดตั้งร้านได้ตั้งแต่ 14:00 น. ห้ามใช้เตาถ่านในโซน A',
    zones: zones([350, 250, 500]), demo: { fill: 0, pending: 0 },
  },
  {
    id: 'e0', type: 'ตลาดนัด', status: 'open', title: 'ตลาดนัดสวนรถไฟ ไนท์มาร์เก็ต', roundByMonth: true, organizerId: 'o1',
    venue: 'สวนวชิรเบญจทัศ กรุงเทพฯ', hours: '16:00–23:00 น.', closeBefore: 3, startInDays: -23, length: 3, weekendSurcharge: true,
    description: 'ตลาดกลางคืนริมสวน เน้นอาหาร ของทำมือ และเสื้อผ้ามือสอง',
    zones: zones([350, 250, 500]), demo: { fill: 0.9, pending: 0 },
  },
]
