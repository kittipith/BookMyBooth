import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getSlipUrl } from '../../api/bookings'
import { errorMessage } from '../../api/client'
import Chip from '../../components/common/Chip'
import ConfirmDialog from '../../components/popup/ConfirmDialog'
import QrDialog from '../../components/popup/QrDialog'
import BookingTicket from '../../components/user/BookingTicket'
import { BOOKING_STATUS_LABEL } from '../../data/options'
import { POLICY } from '../../data/settings'
import { useToast } from '../../hooks/useToast'
import { useCancelMyBooking, useMyBookings } from '../../queries/bookings'
import { useEvents } from '../../queries/events'
import { groupBookings } from '../../services/bookings'
import type { BookingGroup, BookingUiStatus, SellerBooking } from '../../types'

type Tab = 'all' | BookingUiStatus
const TABS: Tab[] = ['all', 'awaiting_slip', 'pending', 'approved', 'rejected', 'cancelled', 'expired']

export default function MyBookingsPage() {
  const { data: bookings = [], isPending } = useMyBookings()
  const { data: events = [] } = useEvents()
  const cancel = useCancelMyBooking()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('all')
  const [qrFor, setQrFor] = useState<BookingGroup | null>(null)
  const [cancelFor, setCancelFor] = useState<BookingGroup | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // นับถอยหลังเวลาแนบสลิป
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const eventOf = (b: SellerBooking) => events.find((e) => e.id === b.eventId)
  // 1 การ์ดต่อชุด (D7) · งานที่ยังไม่จบขึ้นก่อน เรียงตามวันงาน แล้วต่อด้วยงานที่จบแล้ว
  const mine = groupBookings(bookings).sort((a, b) => {
    const ea = eventOf(a)
    const eb = eventOf(b)
    const endedA = ea?.status === 'ended' ? 1 : 0
    const endedB = eb?.status === 'ended' ? 1 : 0
    if (endedA !== endedB) return endedA - endedB
    const da = ea?.startDate ?? ''
    const db = eb?.startDate ?? ''
    return (endedA ? db.localeCompare(da) : da.localeCompare(db)) || a.lot.localeCompare(b.lot)
  })
  const count = (t: Tab) => (t === 'all' ? mine.length : mine.filter((b) => b.status === t).length)
  const list = tab === 'all' ? mine : mine.filter((b) => b.status === tab)

  const showSlip = async (b: SellerBooking) => {
    // เปิดแท็บก่อนรอ API ไม่งั้นเบราว์เซอร์บล็อก popup
    const win = window.open('', '_blank')
    try {
      const { url } = await getSlipUrl(b.id)
      if (win) win.location.href = url
      else window.location.assign(url)
    } catch (e) {
      win?.close()
      toast(errorMessage(e), 'danger')
    }
  }

  return (
    <section className="max-w-5xl mx-auto px-5 py-10">
      <h1 className="font-display text-4xl font-bold">การจองของฉัน</h1>
      <div className="mt-6 flex gap-2 flex-wrap" role="tablist">
        {TABS.filter((t) => t === 'all' || t === 'pending' || t === 'approved' || count(t) > 0).map((t) => (
          <Chip key={t} role="tab" pressed={tab === t} onClick={() => setTab(t)}>
            {t === 'all' ? 'ทั้งหมด' : BOOKING_STATUS_LABEL[t]} <span className="opacity-60">{count(t)}</span>
          </Chip>
        ))}
      </div>
      <div className="mt-6 space-y-5">
        {list.map((b) => (
          <BookingTicket
            key={b.key}
            booking={b}
            event={eventOf(b)}
            now={now}
            onShowQr={() => setQrFor(b)}
            onShowSlip={() => showSlip(b)}
            onCancel={() => setCancelFor(b)}
          />
        ))}
        {isPending && <p className="py-14 text-center text-muted">กำลังโหลดการจอง…</p>}
        {!isPending && !list.length && (
          <div className="border border-dashed border-line rounded-2xl py-14 text-center">
            <p className="text-muted">ยังไม่มีการจองในหมวดนี้</p>
            <Link to="/events" className="mt-3 inline-block text-cobalt font-semibold hover:underline underline-offset-4">
              หางานที่เปิดจอง
            </Link>
          </div>
        )}
      </div>

      <QrDialog booking={qrFor} eventTitle={qrFor ? (eventOf(qrFor)?.title ?? qrFor.eventTitle) : undefined} onClose={() => setQrFor(null)} />
      <ConfirmDialog
        open={!!cancelFor}
        title={cancelFor?.lots.length && cancelFor.lots.length > 1 ? `ยกเลิกทั้งชุด ${cancelFor.lots.length} ล็อก` : 'ยกเลิกคำขอนี้'}
        message={
          cancelFor &&
          `ล็อก ${cancelFor.lot} จะกลับไปว่างให้คนอื่นจอง${cancelFor.hasSlip ? ` · ${POLICY.refundNote.sellerCancel}` : ''}`
        }
        confirmLabel="ยกเลิกคำขอ"
        onClose={() => setCancelFor(null)}
        onConfirm={() => {
          if (!cancelFor) return
          const target = cancelFor
          setCancelFor(null)
          cancel.mutate({ bookingId: target.id, eventId: target.eventId }, { onSuccess: () => toast(`ยกเลิกคำขอล็อก ${target.lot} แล้ว`) })
        }}
      />
    </section>
  )
}
