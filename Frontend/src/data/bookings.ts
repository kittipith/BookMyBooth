import type { BookingStatus } from '../types'

export interface BookingSeed {
  eventId: string
  lot: string
  /** จองทั้งงาน (ทุกวันของงาน) */
  shopId: string
  status: BookingStatus
  /** ส่งคำขอมาแล้วกี่ชั่วโมง */
  hoursAgo: number
  power?: boolean
  staff?: string
  note?: string
  /** ยอดในสลิปขาดไปเท่าไร */
  slipShort?: number
  reason?: string
}

/** คำขอจองที่ระบุไว้ชัดเจน ส่วนล็อกอื่นที่ไม่ว่างจะสร้างอัตโนมัติจากสัดส่วนในข้อมูลงาน */
export const BOOKING_SEEDS: BookingSeed[] = [
  { eventId: 'e1', lot: 'A05', shopId: 's1', status: 'pending', hoursAgo: 3, staff: '2 คน' },
  { eventId: 'e1', lot: 'A09', shopId: 's5', status: 'pending', hoursAgo: 5, power: true, note: 'ขอใช้เตาไฟฟ้า 1 เครื่อง' },
  { eventId: 'e1', lot: 'B03', shopId: 's4', status: 'pending', hoursAgo: 14, note: 'มีราวแขวนเสื้อ 2 ราว' },
  { eventId: 'e1', lot: 'A11', shopId: 's9', status: 'pending', hoursAgo: 20, slipShort: 20 },
  { eventId: 'e8', lot: 'C03', shopId: 's6', status: 'pending', hoursAgo: 50 },
  { eventId: 'e1', lot: 'A06', shopId: 's7', status: 'rejected', hoursAgo: 96, reason: 'ประเภทสินค้าซ้ำในโซนเกินจำนวน' },
  { eventId: 'e1', lot: 'B20', shopId: 's6', status: 'cancelled', hoursAgo: 140, reason: 'ผู้ขายยกเลิกคำขอเอง' },
  { eventId: 'e2', lot: 'B14', shopId: 's1', status: 'approved', hoursAgo: 100, staff: '2 คน' },
  {
    eventId: 'e3', lot: 'C02', shopId: 's1', status: 'rejected', hoursAgo: 300,
    reason: 'ร้านประเภทเครื่องดื่มในโซน C ครบจำนวนแล้ว ลองเลือกล็อกในโซน B แทน',
  },
]

/** ร้านที่ใช้คำขอที่ระบุเองข้างบนเท่านั้น จะไม่ถูกสุ่มให้จองงานที่ยังไม่จัด (ประวัติงานที่จบแล้วยังสุ่มได้) */
export const HANDPICKED_SHOP_IDS = ['s1']
