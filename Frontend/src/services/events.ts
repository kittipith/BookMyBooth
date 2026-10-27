/** ค่าที่หน้าดูงานแสดง คำนวณจากงานและสถานะล็อกที่ได้จาก API (แทน selectors/pricing เดิมที่คิดรายวัน) */
import type { LotState, LotStates, PublicEvent } from '../types'
import { diffDays } from '../utils/format'

/** จำนวนวันที่จัดงาน (นับวันแรกและวันสุดท้าย) */
export const eventDayCount = (event: Pick<PublicEvent, 'startDate' | 'endDate'>) => diffDays(event.startDate, event.endDate) + 1

/** ราคาต่อล็อกตลอดงาน = ราคาโซน (I2) */
export const zonePrice = (event: Pick<PublicEvent, 'zones'>, zoneId: string) => event.zones.find((z) => z.id === zoneId)?.price ?? 0

export const startingPrice = (event: Pick<PublicEvent, 'zones'>) =>
  event.zones.length ? Math.min(...event.zones.map((z) => z.price)) : 0

/** ล็อกที่วาดไว้แต่ไม่มีในตาราง Lots (ผู้จัดงานยังไม่ได้บันทึกผัง) ถือว่าจองไม่ได้ */
export const lotStateOf = (states: LotStates, code: string): LotState => states[code] ?? 'disabled'

export const freeLotCount = (states: LotStates | undefined) => Object.values(states ?? {}).filter((s) => s === 'free').length

export const lotCount = (states: LotStates | undefined) => Object.keys(states ?? {}).length
