/**
 * ฟังก์ชันคำนวณข้อมูลสำหรับแสดงผล ทุกตัวเลขบนหน้าจอมาจากที่นี่
 * รับข้อมูลดิบ (งาน การจอง ร้าน) แล้วคืนค่าที่หน้าต่างๆ นำไปแสดง
 */
import { LIMITS } from '../data/settings'
import type { Booking, EventRecord, EventStatus, MarketEvent, Organizer, Shop, ShopStats, VendorStat } from '../types'
import { addDays, dayLabel, parseISO, TODAY } from '../utils/format'
import { eventLots, lotCodes } from '../utils/layout'
import { lotStateOn } from '../utils/pricing'

/** สถานะที่แสดงจริง: จบงานเมื่อเลยวันสุดท้าย และเปิดรับจองเฉพาะในช่วงเปิด–ปิดรับจอง */
export function effectiveStatus(e: EventRecord, today = TODAY): EventStatus {
  if (e.status === 'draft') return 'draft'
  const last = e.days.at(-1)?.date
  if (last && last < today) return 'ended'
  if (e.status === 'closed' || today > e.bookingCloses) return 'closed'
  if (today < e.bookingOpens) return 'scheduled'
  return 'open'
}

/** เติมชื่อผู้จัด ชื่อวัน และสถานะล็อก (คำนวณจากการจอง) ให้ข้อมูลงาน */
export function deriveEvents(records: EventRecord[], bookings: Booking[], organizers: Organizer[]): MarketEvent[] {
  const occupancy = new Map(records.map((r) => [r.id, r.days.map(() => ({}) as MarketEvent['lotState'][number])]))
  // ใส่คำขอรออนุมัติก่อน แล้วให้การจองที่อนุมัติแล้วทับ
  const active = bookings
    .filter((b) => b.status === 'pending' || b.status === 'approved')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1))
  // ล็อกที่ผู้จัดงานปิดไว้ (การจองที่มีอยู่แล้วยังแสดงตามจริง)
  records.forEach((r) => {
    const codes = lotCodes(r.layout)
    const days = occupancy.get(r.id)!
    r.disabledCells.forEach((i) => codes[i] && days.forEach((d) => (d[codes[i]!] = 'disabled')))
  })
  active.forEach((b) => {
    const days = occupancy.get(b.eventId)
    b.days.forEach((d) => {
      if (days?.[d]) days[d][b.lot] = b.status === 'approved' ? 'booked' : 'pending'
    })
  })
  return records.map((r) => ({
    ...r,
    status: effectiveStatus(r),
    publishStatus: r.status,
    organizer: organizers.find((o) => o.id === r.organizerId)?.name ?? '',
    days: r.days.map((d) => ({ ...d, label: dayLabel(d.date) })),
    lotState: occupancy.get(r.id)!,
  }))
}

export const byStartDate = (a: MarketEvent, b: MarketEvent) => a.days[0].date.localeCompare(b.days[0].date)
export const byNewest = (a: Booking, b: Booking) => b.submittedAt.localeCompare(a.submittedAt)

export function openEvents(events: MarketEvent[]) {
  return events.filter((e) => e.status === 'open').sort(byStartDate)
}

/** งานที่กำลังจะถึงหรือกำลังจัดอยู่ของผู้จัด */
export function nextEvent(events: MarketEvent[]) {
  return events.filter((e) => ['open', 'scheduled', 'closed'].includes(e.status)).sort(byStartDate)[0]
}

/** วันแรกของงานที่ยังไม่ผ่านไป (ใช้เลือกวันเริ่มต้นบนผัง) */
export function currentDayIndex(event: MarketEvent) {
  const i = event.days.findIndex((d) => d.date >= TODAY)
  return i < 0 ? 0 : i
}

export function eventRevenue(bookings: Booking[], eventId: string) {
  return bookings.filter((b) => b.eventId === eventId && b.status === 'approved').reduce((sum, b) => sum + b.amount, 0)
}

/** ยอดที่อนุมัติแล้วของงานที่เริ่มในเดือนที่ระบุ (0 = เดือนนี้, -1 = เดือนก่อน) */
export function monthRevenue(events: MarketEvent[], bookings: Booking[], monthOffset: number) {
  const ref = parseISO(TODAY)
  ref.setDate(1)
  ref.setMonth(ref.getMonth() + monthOffset)
  const inMonth = events.filter((e) => {
    const d = parseISO(e.days[0].date)
    return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear()
  })
  return inMonth.reduce((sum, e) => sum + eventRevenue(bookings, e.id), 0)
}

export function checkinCount(event: MarketEvent, dayIdx = 0) {
  return eventLots(event).filter((l) => lotStateOn(event, dayIdx, l.code) === 'booked').length
}

/** จำนวนคำขอที่ส่งเข้ามาในแต่ละวัน ย้อนหลังตามจำนวนวันที่ตั้งไว้ */
export function dailyBookingCounts(bookings: Booking[], days = LIMITS.chartDays) {
  const counts = new Map<string, number>()
  bookings.forEach((b) => counts.set(b.submittedAt.slice(0, 10), (counts.get(b.submittedAt.slice(0, 10)) ?? 0) + 1))
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(TODAY, i - days + 1)
    return { date, count: counts.get(date) ?? 0 }
  })
}

export function shopStats(bookings: Booking[], events: MarketEvent[], shopId: string): ShopStats {
  const approved = bookings.filter((b) => b.shopId === shopId && b.status === 'approved')
  const past = approved.filter((b) => events.find((e) => e.id === b.eventId)?.status === 'ended')
  const showed = past.filter((b) => b.checkedIn).length
  return {
    approved: approved.length,
    total: approved.reduce((sum, b) => sum + b.amount, 0),
    showRate: past.length ? Math.round((showed / past.length) * 100) : null,
    pastCount: past.length,
  }
}

/** สรุปร้านที่เคยจองในกลุ่มการจองที่ส่งมา (เช่น เฉพาะงานของผู้จัดคนหนึ่ง) */
export function vendorStats(bookings: Booking[], events: MarketEvent[], shops: Shop[]): VendorStat[] {
  const ids = [...new Set(bookings.map((b) => b.shopId))]
  return ids
    .map((id) => shops.find((s) => s.id === id))
    .filter((s): s is Shop => !!s)
    .map((shop) => {
      const stats = shopStats(bookings, events, shop.id)
      return { ...stats, shop, flagged: stats.showRate !== null && stats.pastCount >= 2 && stats.showRate < LIMITS.lowShowRate }
    })
}

/** คำขอล็อกเดียวกันในวันที่ซ้อนกัน ที่ยังรออนุมัติอยู่ */
export function conflictingBookings(bookings: Booking[], booking: Booking) {
  return bookings.filter(
    (b) =>
      b.id !== booking.id &&
      b.eventId === booking.eventId &&
      b.lot === booking.lot &&
      b.status === 'pending' &&
      b.days.some((d) => booking.days.includes(d)),
  )
}

/** หมายเลขการจองรูปแบบ BK-ปปดด-ลำดับ เรียงตามเวลาที่ส่ง */
export function assignBookingIds(list: Omit<Booking, 'id'>[]): Booking[] {
  const seq = new Map<string, number>()
  return [...list]
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    .map((b) => {
      const prefix = `BK-${b.submittedAt.slice(2, 4)}${b.submittedAt.slice(5, 7)}`
      const n = (seq.get(prefix) ?? 0) + 1
      seq.set(prefix, n)
      return { ...b, id: `${prefix}-${String(n).padStart(3, '0')}` }
    })
}

export function nextBookingId(bookings: Booking[], submittedAt: string) {
  const prefix = `BK-${submittedAt.slice(2, 4)}${submittedAt.slice(5, 7)}`
  const max = bookings.filter((b) => b.id.startsWith(prefix)).reduce((m, b) => Math.max(m, Number(b.id.slice(-3))), 0)
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

/** ล็อก (ไม่ซ้ำ เรียงตามรหัส) ที่ร้านนี้กำลังจองหรือจองได้แล้วในงาน */
export function sellerLots(bookings: Booking[], eventId: string, shopId: string) {
  const lots = bookings
    .filter((b) => b.eventId === eventId && b.shopId === shopId && (b.status === 'pending' || b.status === 'approved'))
    .map((b) => b.lot)
  return [...new Set(lots)].sort()
}

/** จำนวนล็อก (ไม่ซ้ำ) ที่ร้านนี้กำลังจองหรือจองได้แล้วในงาน */
export function sellerLotCount(bookings: Booking[], eventId: string, shopId: string) {
  return sellerLots(bookings, eventId, shopId).length
}

/** ร้านที่จองไว้ count ล็อกแล้ว จองล็อกใหม่เพิ่มไม่ได้ (งานที่ไม่จำกัดจำนวนจะไม่มีวันครบ) */
export function lotLimitReached(event: Pick<MarketEvent, 'maxLotsPerSeller'>, count: number) {
  return event.maxLotsPerSeller !== null && count >= event.maxLotsPerSeller
}

export function lotLimitLabel(event: Pick<MarketEvent, 'maxLotsPerSeller'>) {
  return event.maxLotsPerSeller === null ? 'จองได้ไม่จำกัดจำนวนล็อก' : `จองได้ไม่เกิน ${event.maxLotsPerSeller} ล็อกต่อร้าน`
}

/** ล็อกที่ย้ายการจองนี้ไปได้: ว่างครบทุกวันที่ขอ และไม่ถูกปิด */
export function movableLots(event: MarketEvent, booking: Booking) {
  return eventLots(event).filter(
    (l) => l.code !== booking.lot && booking.days.every((d) => lotStateOn(event, d, l.code) === 'free'),
  )
}
