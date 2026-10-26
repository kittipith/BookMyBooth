import { FEES } from '../data/settings'
import type { EventDayRecord, LotState, MarketEvent, Zone } from '../types'
import { eventLots } from './layout'

/** ข้อมูลขั้นต่ำที่ใช้คิดราคา ใช้ได้ทั้งข้อมูลงานดิบและที่คำนวณแล้ว */
type Priceable = { zones: Zone[]; days: EventDayRecord[] }

export function zoneOf(event: Pick<MarketEvent, 'zones'>, zoneId: string) {
  return event.zones.find((z) => z.id === zoneId)
}

/** ราคาหลังปรับเป็นเปอร์เซ็นต์ คิดเป็นจำนวนเต็มก่อนหาร กันทศนิยมคลาดเคลื่อน (350 × 115% = 402.5 → ฿403) */
export function withSurcharge(price: number, surcharge: number) {
  return Math.round((price * (100 + surcharge)) / 100)
}

export function priceOn(event: Priceable, zoneId: string, dayIdx: number) {
  const zone = zoneOf(event, zoneId)
  const day = event.days[dayIdx]
  if (!zone || !day) return 0
  return withSurcharge(zone.price, day.surcharge)
}

export function lotZoneId(lot: string) {
  return lot.replace(/\d+$/, '')
}

export function rentFor(event: Priceable, lot: string, days: number[]) {
  const zoneId = lotZoneId(lot)
  return days.reduce((sum, d) => sum + priceOn(event, zoneId, d), 0)
}

export function bookingAmount(event: Priceable, lot: string, days: number[], power: boolean) {
  return checkoutAmounts(event, [lot], days, power)[0]
}

/** ยอดของแต่ละล็อกเมื่อจองหลายล็อกพร้อมกัน ค่าธรรมเนียมระบบคิดครั้งเดียวต่อการจอง (รวมไว้กับล็อกแรก) */
export function checkoutAmounts(event: Priceable, lots: string[], days: number[], power: boolean) {
  return lots.map((lot, i) => rentFor(event, lot, days) + (power ? FEES.power * days.length : 0) + (i === 0 ? FEES.service : 0))
}

export function checkoutTotal(event: Priceable, lots: string[], days: number[], power: boolean) {
  return checkoutAmounts(event, lots, days, power).reduce((sum, a) => sum + a, 0)
}

export function lotStateOn(event: MarketEvent, dayIdx: number, code: string): LotState {
  return event.lotState[dayIdx]?.[code] ?? 'free'
}

export function freeCount(event: MarketEvent, dayIdx: number) {
  return eventLots(event).filter((l) => lotStateOn(event, dayIdx, l.code) === 'free').length
}

export function bookedCount(event: MarketEvent, dayIdx: number) {
  return eventLots(event).filter((l) => lotStateOn(event, dayIdx, l.code) === 'booked').length
}

/** ทุกวันของงาน ผู้ขายจองทีเดียวได้ทั้งงาน */
export function allDays(event: Pick<Priceable, 'days'>) {
  return event.days.map((_, i) => i)
}

/** ราคาล็อกหนึ่งล็อกตลอดงาน (รวมราคาทุกวันที่งานจัด รวมส่วนเพิ่มรายวันที่ผู้จัดงานตั้งไว้) */
export function eventPrice(event: Priceable, zoneId: string) {
  return event.days.reduce((sum, _, d) => sum + priceOn(event, zoneId, d), 0)
}

/** ราคาเริ่มต้นต่อล็อกตลอดงาน */
export function startingPrice(event: Priceable) {
  return Math.min(...event.zones.map((z) => eventPrice(event, z.id)))
}

// ลำดับความสำคัญของสถานะเมื่อรวมทุกวัน: ปิดจอง > จองแล้ว > รออนุมัติ > ว่าง
const STATE_RANK: LotState[] = ['free', 'pending', 'booked', 'disabled']

/** สถานะของล็อกตลอดงาน: ว่างเมื่อว่างครบทุกวัน ไม่งั้นใช้สถานะที่หนักที่สุด */
export function lotStateAll(event: MarketEvent, code: string): LotState {
  return event.days.reduce<LotState>((worst, _, d) => {
    const state = lotStateOn(event, d, code)
    return STATE_RANK.indexOf(state) > STATE_RANK.indexOf(worst) ? state : worst
  }, 'free')
}

/** จำนวนล็อกที่ยังว่างตลอดงาน */
export function freeCountAll(event: MarketEvent) {
  return eventLots(event).filter((l) => lotStateAll(event, l.code) === 'free').length
}

/** จำนวนล็อก-วันที่ขายแล้ว เทียบกับทั้งหมด */
export function soldStats(event: MarketEvent) {
  const lots = eventLots(event)
  const sold = event.days.reduce((sum, _, d) => sum + bookedCount(event, d), 0)
  return { sold, total: lots.length * event.days.length }
}

export function zoneFill(event: MarketEvent, zoneId: string) {
  const lots = eventLots(event).filter((l) => l.zone === zoneId)
  const total = lots.length * event.days.length
  if (!total) return 0
  let booked = 0
  event.days.forEach((_, d) => lots.forEach((l) => lotStateOn(event, d, l.code) === 'booked' && booked++))
  return Math.round((booked / total) * 100)
}
