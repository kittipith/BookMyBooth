import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NOTICE } from '../data/notifications'
import { POWER_OPTIONS } from '../data/options'
import { POLL_SECONDS } from '../data/settings'
import { hashPassword, normalizeEmail } from '../services/auth'
import { adminAccountIds, buildNotices, organizerAccountIds, shopAccountIds } from '../services/notifications'
import { createSeedState, type AppData } from '../services/seed'
import { deriveEvents, nextBookingId, sellerLotCount } from '../services/selectors'
import type { Account, AppNotification, Booking } from '../types'
import { nowISO } from '../utils/format'
import { STANDARD_COLS, STANDARD_ROWS } from '../utils/layout'
import { checkoutAmounts, lotStateOn } from '../utils/pricing'
import { AppContext, type AppActions } from './appContext'

const STORAGE_KEY = 'bookmybooth-data-v1'

/** เติมค่าที่เพิ่มเข้ามาทีหลังให้ข้อมูลที่บันทึกไว้จากเวอร์ชันก่อน */
function upgrade(data: AppData): AppData {
  // คำขอที่ค้างจากเวอร์ชันก่อนเก็บล็อกเดียว (lot) ตอนนี้เก็บเป็นรายการ (lots)
  const draft = data.draft as (AppData['draft'] & { lot?: string }) | null
  return {
    ...data,
    draft: draft && !Array.isArray(draft.lots) ? (draft.lot ? { ...draft, lots: [draft.lot] } : null) : draft,
    events: data.events.map((e) => ({
      ...e,
      cols: e.cols ?? STANDARD_COLS,
      rows: e.rows ?? STANDARD_ROWS,
      lotSizes: e.lotSizes ?? {},
    })),
  }
}

function readStored(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? upgrade(JSON.parse(raw) as AppData) : null
  } catch {
    // ข้อมูลเสียหรือเข้าถึง storage ไม่ได้
    return null
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => readStored() ?? createSeedState())
  const saved = useRef('')

  useEffect(() => {
    try {
      saved.current = JSON.stringify(data)
      localStorage.setItem(STORAGE_KEY, saved.current)
    } catch {
      // บันทึกไม่ได้ก็ยังใช้งานต่อได้ในหน้านี้
    }
  }, [data])

  // polling: ดึงข้อมูลที่เปลี่ยนจากแท็บอื่น (แทนการเรียก API ทุก 30 วินาที) และฟังการเปลี่ยนแปลงทันทีผ่าน storage event
  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw && raw !== saved.current) {
          saved.current = raw
          setData(upgrade(JSON.parse(raw) as AppData))
        }
      } catch {
        // อ่านไม่ได้ก็ข้ามรอบนี้
      }
    }
    const timer = window.setInterval(sync, POLL_SECONDS * 1000)
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && sync()
    window.addEventListener('storage', onStorage)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // สถานะล็อกบนผังคำนวณจากการจองทุกครั้ง จึงตรงกับรายการจองเสมอ
  const events = useMemo(
    () => deriveEvents(data.events, data.bookings, data.organizers),
    [data.events, data.bookings, data.organizers],
  )

  /** แก้การจองหนึ่งรายการ พร้อมเพิ่มการแจ้งเตือน */
  const updateBooking = useCallback((id: string, patch: (b: Booking) => Partial<Booking>, notices: AppNotification[] = []) => {
    setData((d) => ({
      ...d,
      bookings: d.bookings.map((b) => (b.id === id ? { ...b, ...patch(b) } : b)),
      notifications: [...d.notifications, ...notices],
    }))
  }, [])

  const setDraft = useCallback<AppActions['setDraft']>((draft) => setData((d) => ({ ...d, draft })), [])

  const submitBooking = useCallback<AppActions['submitBooking']>(
    (slipName, shopId) => {
      const { draft, bookings, shops, accounts } = data
      const event = events.find((e) => e.id === draft?.eventId)
      const shop = shops.find((s) => s.id === shopId)
      if (!draft?.shop || !event || !shop) return { error: 'ไม่พบข้อมูลการจอง ลองเลือกล็อกใหม่อีกครั้ง' }
      if (event.status !== 'open') return { error: 'งานนี้ไม่ได้อยู่ในช่วงเปิดรับจองแล้ว' }
      const lots = [...new Set(draft.lots)]
      if (!lots.length) return { error: 'เลือกล็อกอย่างน้อยหนึ่งล็อก' }
      // จองทั้งงานเสมอ ทุกวันที่งานจัด
      const days = event.days.map((_, i) => i)
      // ป้องกันจองซ้อน: ทุกล็อกต้องยังว่างทุกวัน (หลังบ้านจริงใช้ conditional write)
      const taken = lots.filter((lot) => days.some((d) => lotStateOn(event, d, lot) !== 'free'))
      if (taken.length) return { error: `ล็อก ${taken.join(', ')} ถูกจองไปแล้ว เลือกใหม่อีกครั้ง` }
      // จำกัดจำนวนล็อกต่อร้านตามที่ผู้จัดงานตั้งไว้ นับรวมล็อกที่จองไว้แล้ว
      const count = sellerLotCount(bookings, event.id, shop.id)
      if (event.maxLotsPerSeller !== null && count + lots.length > event.maxLotsPerSeller) {
        return { error: `งานนี้จองได้ไม่เกิน ${event.maxLotsPerSeller} ล็อกต่อร้าน คุณจองไว้แล้ว ${count} ล็อก เลือกได้อีก ${Math.max(0, event.maxLotsPerSeller - count)} ล็อก` }
      }
      const submittedAt = nowISO()
      const amounts = checkoutAmounts(event, lots, days, draft.shop.power)
      const status = event.autoApprove ? 'approved' : 'pending'
      // หนึ่งล็อกหนึ่งรายการ ผู้จัดงานอนุมัติ/ย้าย/ปฏิเสธแยกกันได้ ล็อกที่ส่งพร้อมกันผูกกันด้วย groupId
      const created: Booking[] = []
      lots.forEach((lot, i) => {
        const id = nextBookingId([...bookings, ...created], submittedAt)
        created.push({
          id, eventId: event.id, lot,
          days, shopId: shop.id, shopName: draft.shop!.shopName,
          category: draft.shop!.category, staff: draft.shop!.staff, power: draft.shop!.power, note: draft.shop!.note,
          amount: amounts[i], slipAmount: amounts[i], slipName, submittedAt, status,
          groupId: lots.length > 1 ? (created[0]?.id ?? id) : undefined,
        })
      })
      const lotText = lots.join(', ')
      const notices = [
        ...buildNotices(
          organizerAccountIds(accounts, event.organizerId), 'booking_new',
          NOTICE.bookingNew(draft.shop.shopName, lotText, event.title), submittedAt,
          `/organizer/bookings?tab=all&id=${created[0].id}`,
        ),
        ...(status === 'approved'
          ? buildNotices(shopAccountIds(accounts, shop.id), 'booking_approved', NOTICE.bookingApproved(lotText, event.title), submittedAt, '/my-bookings')
          : []),
      ]
      setData((d) => ({ ...d, draft: null, bookings: [...d.bookings, ...created], notifications: [...d.notifications, ...notices] }))
      return { id: created[0].id }
    },
    [data, events],
  )

  const approveBooking = useCallback<AppActions['approveBooking']>(
    (id, moveTo) => {
      const booking = data.bookings.find((b) => b.id === id)
      const event = events.find((e) => e.id === booking?.eventId)
      if (!booking || !event || booking.status !== 'pending') return { ok: false, error: 'คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ' }
      const at = nowISO()
      const sellers = shopAccountIds(data.accounts, booking.shopId)
      if (moveTo) {
        const free = booking.days.every((d) => lotStateOn(event, d, moveTo) === 'free')
        if (!free) return { ok: false, error: `ล็อก ${moveTo} ไม่ว่างในวันที่ร้านนี้ขอ` }
        updateBooking(
          id,
          (b) => ({ status: 'approved', lot: moveTo, moves: [...(b.moves ?? []), { from: b.lot, to: moveTo, at }] }),
          buildNotices(sellers, 'booking_moved', NOTICE.bookingMoved(booking.lot, moveTo, event.title), at, '/my-bookings'),
        )
        return { ok: true }
      }
      // อนุมัติไม่ได้ถ้ามีร้านอื่นได้ล็อกนี้ไปแล้ว หรือผู้จัดงานปิดล็อกไว้
      if (booking.days.some((d) => ['booked', 'disabled'].includes(lotStateOn(event, d, booking.lot)))) {
        return { ok: false, error: `ล็อก ${booking.lot} มีร้านอื่นได้ไปแล้วหรือถูกปิดไว้ ลองย้ายไปล็อกอื่น` }
      }
      updateBooking(
        id,
        () => ({ status: 'approved' }),
        buildNotices(sellers, 'booking_approved', NOTICE.bookingApproved(booking.lot, event.title), at, '/my-bookings'),
      )
      return { ok: true }
    },
    [data.bookings, data.accounts, events, updateBooking],
  )

  const rejectBooking = useCallback<AppActions['rejectBooking']>(
    (id, reason) => {
      const booking = data.bookings.find((b) => b.id === id)
      const event = events.find((e) => e.id === booking?.eventId)
      if (!booking || !event) return
      updateBooking(
        id,
        () => ({ status: 'rejected', reason }),
        buildNotices(shopAccountIds(data.accounts, booking.shopId), 'booking_rejected', NOTICE.bookingRejected(booking.lot, event.title, reason), nowISO(), '/my-bookings'),
      )
    },
    [data.bookings, data.accounts, events, updateBooking],
  )

  const cancelBooking = useCallback<AppActions['cancelBooking']>(
    (id, reason, by) => {
      const booking = data.bookings.find((b) => b.id === id)
      const event = events.find((e) => e.id === booking?.eventId)
      if (!booking || !event) return
      const at = nowISO()
      const notices =
        by === 'seller'
          ? buildNotices(organizerAccountIds(data.accounts, event.organizerId), 'booking_cancelled', NOTICE.bookingCancelledBySeller(booking.shopName, booking.lot, event.title), at, `/organizer/bookings?tab=all&id=${id}`)
          : buildNotices(shopAccountIds(data.accounts, booking.shopId), 'booking_cancelled', NOTICE.bookingCancelled(booking.lot, event.title, reason), at, '/my-bookings')
      updateBooking(id, () => ({ status: 'cancelled', reason }), notices)
    },
    [data.bookings, data.accounts, events, updateBooking],
  )

  const updateShop = useCallback<AppActions['updateShop']>(
    (shop) => setData((d) => ({ ...d, shops: d.shops.map((s) => (s.id === shop.id ? shop : s)) })),
    [],
  )

  const updateOrganizer = useCallback<AppActions['updateOrganizer']>(
    (organizer) => setData((d) => ({ ...d, organizers: d.organizers.map((o) => (o.id === organizer.id ? organizer : o)) })),
    [],
  )

  const saveEvent = useCallback<AppActions['saveEvent']>((event) => {
    setData((d) => {
      const exists = d.events.some((e) => e.id === event.id)
      return { ...d, events: exists ? d.events.map((e) => (e.id === event.id ? event : e)) : [...d.events, event] }
    })
  }, [])

  const createAccount = useCallback<AppActions['createAccount']>((input) => {
    const stamp = Date.now().toString(36)
    const email = normalizeEmail(input.email)
    const account: Account = {
      id: `a${stamp}`, email, passwordHash: hashPassword(email, input.password), role: input.role,
      // ผู้จัดงานต้องรอผู้ดูแลระบบอนุมัติก่อนใช้งาน
      status: input.role === 'organizer' ? 'pending' : 'active',
      emailVerified: false, createdAt: nowISO(),
    }
    if (input.role === 'seller') {
      const shop = {
        id: `s${stamp}`, name: input.orgName.trim(), category: input.category, owner: input.name.trim(),
        phone: input.phone.trim(), line: '', power: POWER_OPTIONS[0], bio: '',
      }
      account.shopId = shop.id
      setData((d) => ({ ...d, accounts: [...d.accounts, account], shops: [...d.shops, shop] }))
    } else {
      const organizer = {
        id: `o${stamp}`, name: input.orgName.trim(), contactName: input.name.trim(), email, phone: input.phone.trim(),
        payment: { bank: 'พร้อมเพย์', accountName: input.orgName.trim(), accountNo: input.phone.trim() },
      }
      account.organizerId = organizer.id
      setData((d) => ({ ...d, accounts: [...d.accounts, account], organizers: [...d.organizers, organizer] }))
    }
    return account
  }, [])

  const verifyAccountEmail = useCallback<AppActions['verifyAccountEmail']>((accountId) => {
    setData((d) => {
      const account = d.accounts.find((a) => a.id === accountId)
      if (!account) return d
      // ยืนยันอีเมลแล้ว ผู้จัดงานที่รออนุมัติจะเข้าคิวของผู้ดูแลระบบ
      const org = d.organizers.find((o) => o.id === account.organizerId)
      const notices =
        account.role === 'organizer' && account.status === 'pending' && !account.emailVerified
          ? buildNotices(adminAccountIds(d.accounts), 'organizer_pending', NOTICE.organizerPending(org?.name ?? account.email), nowISO(), '/admin')
          : []
      return {
        ...d,
        accounts: d.accounts.map((a) => (a.id === accountId ? { ...a, emailVerified: true } : a)),
        notifications: [...d.notifications, ...notices],
      }
    })
  }, [])

  const setAccountPassword = useCallback<AppActions['setAccountPassword']>(
    (accountId, passwordHash) =>
      setData((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === accountId ? { ...a, passwordHash } : a)) })),
    [],
  )

  const reviewOrganizer = useCallback<AppActions['reviewOrganizer']>((accountId, approve, reason) => {
    setData((d) => ({
      ...d,
      accounts: d.accounts.map((a) =>
        a.id === accountId ? { ...a, status: approve ? 'active' : 'rejected', statusReason: approve ? undefined : reason } : a,
      ),
      notifications: [
        ...d.notifications,
        ...(approve
          ? buildNotices([accountId], 'organizer_approved', NOTICE.organizerApproved(), nowISO(), '/organizer')
          : buildNotices([accountId], 'organizer_rejected', NOTICE.organizerRejected(reason ?? ''), nowISO())),
      ],
    }))
  }, [])

  const setSuspended = useCallback<AppActions['setSuspended']>((accountId, suspended, reason) => {
    setData((d) => {
      const account = d.accounts.find((a) => a.id === accountId)
      if (!account) return d
      // ยกเลิกการระงับ: ผู้จัดงานที่ยังไม่เคยได้รับอนุมัติก็ถือว่าอนุมัติแล้ว
      const nextStatus = suspended ? 'suspended' : 'active'
      return {
        ...d,
        accounts: d.accounts.map((a) => (a.id === accountId ? { ...a, status: nextStatus, statusReason: suspended ? reason : undefined } : a)),
        notifications: suspended
          ? [...d.notifications, ...buildNotices([accountId], 'account_suspended', NOTICE.accountSuspended(reason ?? ''), nowISO())]
          : d.notifications,
      }
    })
  }, [])

  const markNotificationsRead = useCallback<AppActions['markNotificationsRead']>((ids) => {
    const set = new Set(ids)
    setData((d) => ({ ...d, notifications: d.notifications.map((n) => (set.has(n.id) ? { ...n, read: true } : n)) }))
  }, [])

  const value = useMemo(
    () => ({
      events, bookings: data.bookings, shops: data.shops, organizers: data.organizers, accounts: data.accounts,
      notifications: data.notifications, draft: data.draft,
      setDraft, submitBooking, approveBooking, rejectBooking, cancelBooking, updateShop, updateOrganizer, saveEvent,
      createAccount, verifyAccountEmail, setAccountPassword, reviewOrganizer, setSuspended, markNotificationsRead,
    }),
    [
      events, data, setDraft, submitBooking, approveBooking, rejectBooking, cancelBooking, updateShop, updateOrganizer,
      saveEvent, createAccount, verifyAccountEmail, setAccountPassword, reviewOrganizer, setSuspended, markNotificationsRead,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
