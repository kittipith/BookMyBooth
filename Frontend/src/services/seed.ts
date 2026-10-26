import { SEED_ACCOUNTS } from '../data/accounts'
import { BOOKING_SEEDS, HANDPICKED_SHOP_IDS } from '../data/bookings'
import { EVENT_SEEDS, type EventSeed } from '../data/events'
import { ORGANIZERS } from '../data/organizers'
import { NOTICE } from '../data/notifications'
import { EVENT_DEFAULTS, WEEKEND_SURCHARGE } from '../data/settings'
import { SHOP_ATTENDANCE, SHOPS } from '../data/shops'
import type { Account, AppNotification, Booking, BookingDraft, EventRecord, Organizer, Shop } from '../types'
import { addDays, isWeekend, monthName, parseISO, toISODateTime, TODAY } from '../utils/format'
import { eventLots, lotCodes, STANDARD_COLS, STANDARD_ROWS, standardLayout } from '../utils/layout'
import { bookingAmount } from '../utils/pricing'
import { seededRandom } from '../utils/random'
import { adminAccountIds, buildNotices, organizerAccountIds, shopAccountIds } from './notifications'
import { assignBookingIds } from './selectors'

export interface AppData {
  accounts: Account[]
  organizers: Organizer[]
  events: EventRecord[]
  bookings: Booking[]
  shops: Shop[]
  notifications: AppNotification[]
  draft: BookingDraft | null
}

const HOUR = 3_600_000

function buildEvent(seed: EventSeed): EventRecord {
  const start = addDays(TODAY, seed.startInDays)
  const days = Array.from({ length: seed.length }, (_, i) => {
    const date = addDays(start, i)
    return { date, surcharge: seed.weekendSurcharge && isWeekend(date) ? WEEKEND_SURCHARGE : 0 }
  })
  const layout = standardLayout()
  const codes = lotCodes(layout)
  const organizer = ORGANIZERS.find((o) => o.id === seed.organizerId)
  return {
    id: seed.id, type: seed.type, status: seed.status, title: seed.title,
    round: seed.roundByMonth ? `รอบ${monthName(start)}` : undefined,
    organizerId: seed.organizerId, venue: seed.venue, hours: seed.hours, description: seed.description,
    bookingOpens: addDays(start, -EVENT_DEFAULTS.opensDaysBefore),
    bookingCloses: addDays(start, -seed.closeBefore),
    payment: organizer?.payment ?? { bank: 'พร้อมเพย์', accountName: organizer?.name ?? '', accountNo: '' },
    maxLotsPerSeller: seed.maxLotsPerSeller ?? EVENT_DEFAULTS.maxLotsPerSeller,
    autoApprove: !!seed.autoApprove, days, zones: seed.zones, cols: STANDARD_COLS, rows: STANDARD_ROWS, layout,
    disabledCells: (seed.disabledLots ?? []).map((code) => codes.indexOf(code)).filter((i) => i >= 0),
    lotSizes: Object.fromEntries(Object.entries(seed.lotSizes ?? {}).map(([code, size]) => [String(codes.indexOf(code)), size])),
  }
}

/** สร้างข้อมูลเริ่มต้นจากโฟลเดอร์ data วันที่ทั้งหมดอิงจากวันนี้ */
export function createSeedState(): AppData {
  const now = Date.now()
  const rand = seededRandom('bookmybooth-demo')
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  const between = (a: number, b: number) => a + rand() * (b - a)
  const at = (hoursAgo: number) => toISODateTime(new Date(now - hoursAgo * HOUR))

  const events = EVENT_SEEDS.map(buildEvent)
  const eventById = new Map(events.map((e) => [e.id, e]))
  const taken = new Set<string>()
  const key = (eventId: string, day: number, lot: string) => `${eventId}|${day}|${lot}`
  const bookings: Omit<Booking, 'id'>[] = []

  const add = (b: Omit<Booking, 'id' | 'amount' | 'slipAmount' | 'shopName' | 'category' | 'slipName'> & { slipShort?: number }) => {
    const event = eventById.get(b.eventId)!
    const shop = SHOPS.find((s) => s.id === b.shopId)!
    const amount = bookingAmount(event, b.lot, b.days, b.power)
    const { slipShort = 0, ...rest } = b
    bookings.push({
      ...rest, shopName: shop.name, category: shop.category, amount, slipAmount: amount - slipShort,
      slipName: `slip-${b.submittedAt.slice(0, 10).replaceAll('-', '')}-${b.lot.toLowerCase()}.jpg`,
    })
    if (b.status === 'pending' || b.status === 'approved') b.days.forEach((d) => taken.add(key(b.eventId, d, b.lot)))
  }

  // ผู้ขายจองทั้งงาน การจองตัวอย่างจึงครอบคลุมทุกวันของงาน
  const wholeEvent = (eventId: string) => eventById.get(eventId)!.days.map((_, i) => i)

  BOOKING_SEEDS.forEach((s) =>
    add({
      eventId: s.eventId, lot: s.lot, days: wholeEvent(s.eventId), shopId: s.shopId, status: s.status, submittedAt: at(s.hoursAgo),
      power: !!s.power, staff: s.staff ?? '1 คน', note: s.note ?? '', reason: s.reason, slipShort: s.slipShort,
    }),
  )

  // ล็อกที่เหลือ สุ่มผู้จองตามสัดส่วนที่กำหนดในข้อมูลงาน
  EVENT_SEEDS.forEach((seed) => {
    const event = eventById.get(seed.id)!
    if (event.status === 'draft' || !seed.demo.fill) return
    const ended = event.days.at(-1)!.date < TODAY
    const startMs = parseISO(event.days[0].date).getTime()
    const pool = SHOPS.filter((s) => ended || !HANDPICKED_SHOP_IDS.includes(s.id))
    // ช่วงเวลาที่ส่งคำขอได้: 30 วันก่อนงาน ถึงวันปิดรับจอง (และไม่เกินตอนนี้)
    const oldest = (now - (startMs - 30 * 24 * HOUR)) / HOUR
    const closesMs = parseISO(event.bookingCloses).getTime()
    const newest = Math.max(2, (now - Math.min(now, closesMs)) / HOUR)
    const disabled = new Set(event.disabledCells.map((i) => lotCodes(event.layout)[i]))

    eventLots(event).filter((lot) => !disabled.has(lot.code)).forEach((lot) => {
      const days = wholeEvent(event.id)
      if (days.some((d) => taken.has(key(event.id, d, lot.code))) || rand() >= seed.demo.fill) return
      const shop = pick(pool)
      const pending = !ended && rand() < seed.demo.pending / Math.max(seed.demo.fill, 0.01)
      add({
        eventId: event.id, lot: lot.code, days, shopId: shop.id,
        status: pending ? 'pending' : 'approved',
        submittedAt: at(pending ? between(1, 40) : between(newest, Math.max(newest, oldest))),
        power: shop.power.startsWith('15A'), staff: pick(['1 คน', '2 คน']), note: '',
        checkedIn: ended ? rand() < (SHOP_ATTENDANCE[shop.id] ?? 0.9) : undefined,
      })
    })
  })

  const accounts = SEED_ACCOUNTS.map((a) => ({ ...a }))
  const withIds = assignBookingIds(bookings)
  return {
    accounts,
    organizers: ORGANIZERS.map((o) => ({ ...o })),
    shops: SHOPS.map((s) => ({ ...s })),
    events,
    bookings: withIds,
    notifications: seedNotifications(accounts, events, withIds, at),
    draft: null,
  }
}

/** การแจ้งเตือนตั้งต้น สร้างจากการจองและบัญชีในข้อมูลตัวอย่าง */
function seedNotifications(accounts: Account[], events: EventRecord[], bookings: Booking[], at: (hoursAgo: number) => string) {
  const notices: AppNotification[] = []
  const titleOf = (eventId: string) => events.find((e) => e.id === eventId)?.title ?? ''
  const recent = (b: Booking) => Date.now() - parseISO(b.submittedAt).getTime() < 7 * 24 * HOUR
  bookings.forEach((b) => {
    const event = events.find((e) => e.id === b.eventId)!
    const title = titleOf(b.eventId)
    const link = `/organizer/bookings?tab=all&id=${b.id}`
    if (b.status === 'pending' || (b.status === 'approved' && recent(b)))
      notices.push(...buildNotices(organizerAccountIds(accounts, event.organizerId), 'booking_new', NOTICE.bookingNew(b.shopName, b.lot, title), b.submittedAt, link, b.status !== 'pending'))
    const sellers = shopAccountIds(accounts, b.shopId)
    if (!sellers.length || !recent(b) && b.status === 'approved') return
    if (b.status === 'approved') notices.push(...buildNotices(sellers, 'booking_approved', NOTICE.bookingApproved(b.lot, title), b.submittedAt, '/my-bookings', true))
    if (b.status === 'rejected') notices.push(...buildNotices(sellers, 'booking_rejected', NOTICE.bookingRejected(b.lot, title, b.reason ?? ''), b.submittedAt, '/my-bookings'))
  })
  accounts.forEach((a) => {
    if (a.role === 'organizer' && a.status === 'pending')
      notices.push(...buildNotices(adminAccountIds(accounts), 'organizer_pending', NOTICE.organizerPending(ORGANIZERS.find((o) => o.id === a.organizerId)?.name ?? a.email), at(30), '/admin'))
    if (a.status === 'suspended')
      notices.push(...buildNotices([a.id], 'account_suspended', NOTICE.accountSuspended(a.statusReason ?? ''), at(200)))
  })
  return notices
}
