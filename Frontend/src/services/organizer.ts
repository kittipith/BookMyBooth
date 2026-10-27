/** ค่าที่หน้าผู้จัดงานแสดง คำนวณจากงาน สถานะล็อก และสรุปที่ได้จาก API (แทน selectors/pricing เดิมที่คิดรายวัน) */
import type { EventSummaryDto } from '../api/dto'
import type { LotStates, PublicEvent } from '../types'
import { TODAY } from '../utils/format'
import { eventLots } from '../utils/layout'
import { lotStateOf } from './events'

/** งานที่กำลังจะถึงหรือกำลังจัดอยู่ (เผยแพร่แล้วและยังไม่จบ) */
export function nextEvent(events: PublicEvent[]) {
  return events
    .filter((e) => e.status === 'open' || e.status === 'scheduled' || e.status === 'closed')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
}

/** วันนี้อยู่ในช่วงวันจัดงาน (เช็กอินได้) backend ตรวจด้วยเวลาไทยอีกชั้น (NOT_EVENT_DAY) */
export const isEventDay = (event: Pick<PublicEvent, 'startDate' | 'endDate'>) => event.startDate <= TODAY && TODAY <= event.endDate

/** ยอดที่อนุมัติแล้วของงานที่เริ่มในเดือนที่ระบุ (0 = เดือนนี้, -1 = เดือนก่อน) */
export function monthRevenue(events: PublicEvent[], summaries: Record<string, EventSummaryDto>, monthOffset: number) {
  const ref = new Date(`${TODAY}T00:00:00`)
  ref.setDate(1)
  ref.setMonth(ref.getMonth() + monthOffset)
  const month = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`
  return events.filter((e) => e.startDate.startsWith(month)).reduce((sum, e) => sum + (summaries[e.id]?.revenue ?? 0), 0)
}

/** ล็อกที่ขายได้ (ไม่นับที่ปิดไว้) และที่อนุมัติแล้ว */
export function soldStats(summary: EventSummaryDto | undefined) {
  if (!summary) return { sold: 0, total: 0 }
  return { sold: summary.lots.BOOKED, total: summary.lots.total - summary.lots.DISABLED }
}

/** เปอร์เซ็นต์ล็อกที่อนุมัติแล้วในโซน (ไม่นับล็อกที่ปิดไว้) */
export function zoneFill(event: PublicEvent, states: LotStates, zoneId: string) {
  const lots = eventLots(event).filter((l) => l.zone === zoneId && lotStateOf(states, l.code) !== 'disabled')
  if (!lots.length) return 0
  return Math.round((lots.filter((l) => states[l.code] === 'booked').length / lots.length) * 100)
}

/** ล็อกที่ย้ายการจองไปได้ (ว่างอยู่) เรียงตามผัง */
export function movableLots(event: PublicEvent, states: LotStates, currentLot: string) {
  return eventLots(event).filter((l) => l.code !== currentLot && states[l.code] === 'free')
}
