/** ค่าที่หน้าผู้ขายแสดงจากการจองที่ได้ GET /bookings/me */
import type { BookingGroup, PublicEvent, SellerBooking, ShopStats } from '../types'

/** สถานะที่ยังถือล็อกอยู่ (นับโควตาต่อร้าน) */
export const isActiveBooking = (b: SellerBooking) => b.status === 'awaiting_slip' || b.status === 'pending' || b.status === 'approved'

/** ล็อกที่ร้านนี้ถืออยู่ในงาน เรียงตามรหัส */
export function activeLots(bookings: SellerBooking[], eventId: string) {
  return [...new Set(bookings.filter((b) => b.eventId === eventId && isActiveBooking(b)).map((b) => b.lot))].sort()
}

/** การจองในชุดเดียวกัน (จองพร้อมกัน สลิปเดียว) */
export const groupOf = (bookings: SellerBooking[], groupId: string) =>
  bookings.filter((b) => b.groupId === groupId).sort((a, b) => a.lot.localeCompare(b.lot))

/** รวมการจองรายล็อกเป็นชุด (D7) เรียงตามลำดับที่พบรายการแรกของชุด */
export function groupBookings<T extends SellerBooking>(bookings: T[]): BookingGroup<T>[] {
  const byKey = new Map<string, T[]>()
  for (const b of bookings) {
    const key = `${b.groupId}:${b.status}`
    byKey.set(key, [...(byKey.get(key) ?? []), b])
  }
  return [...byKey].map(([key, members]) => {
    const items = [...members].sort((a, b) => a.lot.localeCompare(b.lot))
    const lots = items.map((b) => b.lot)
    return {
      ...items[0],
      key,
      items,
      lots,
      lot: lots.join(', '),
      amount: items.reduce((sum, b) => sum + b.amount, 0),
      moves: items.flatMap((b) => b.moves),
      hasSlip: items.some((b) => b.hasSlip),
      checkedIn: items.every((b) => b.checkedIn),
    }
  })
}

/** สถิติร้านแบบเดียวกับที่ผู้จัดงานเห็น (backend domain/vendors.py) นับครั้งตามชุด */
export function sellerStats(bookings: SellerBooking[], events: PublicEvent[]): ShopStats {
  const approved = groupBookings(bookings).filter((b) => b.status === 'approved')
  const past = approved.filter((b) => events.find((e) => e.id === b.eventId)?.status === 'ended')
  const showed = past.filter((b) => b.checkedIn).length
  return {
    approved: approved.length,
    total: approved.reduce((sum, b) => sum + b.amount, 0),
    showRate: past.length ? Math.round((showed / past.length) * 100) : null,
    pastCount: past.length,
  }
}

/** วินาทีที่เหลือก่อนหมดเวลาแนบสลิป */
export const secondsLeft = (expiresAt: string, now: number) => Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000))

export function countdownLabel(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
