import { useState } from 'react'
import { Link } from 'react-router'
import Chip from '../../components/common/Chip'
import ConfirmDialog from '../../components/popup/ConfirmDialog'
import BookingTicket from '../../components/user/BookingTicket'
import QrDialog from '../../components/popup/QrDialog'
import { BOOKING_STATUS_LABEL, CANCEL_REASON } from '../../data/options'
import { POLICY } from '../../data/settings'
import { useAppStore, useMyShop } from '../../hooks/useAppStore'
import { useToast } from '../../hooks/useToast'
import type { Booking, BookingStatus } from '../../types'

type Tab = 'all' | BookingStatus
const TABS: Tab[] = ['all', 'pending', 'approved', 'rejected', 'cancelled']

export default function MyBookingsPage() {
  const { events, cancelBooking } = useAppStore()
  const { myBookings } = useMyShop()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('all')
  const [qrFor, setQrFor] = useState<Booking | null>(null)
  const [cancelFor, setCancelFor] = useState<Booking | null>(null)

  const eventOf = (b: Booking) => events.find((e) => e.id === b.eventId)
  // งานที่ยังไม่จบขึ้นก่อน เรียงตามวันงาน แล้วต่อด้วยงานที่จบแล้ว
  const mine = [...myBookings].sort((a, b) => {
    const ea = eventOf(a)
    const eb = eventOf(b)
    const endedA = ea?.status === 'ended' ? 1 : 0
    const endedB = eb?.status === 'ended' ? 1 : 0
    if (endedA !== endedB) return endedA - endedB
    const da = ea?.days[a.days[0]]?.date ?? ''
    const db = eb?.days[b.days[0]]?.date ?? ''
    return endedA ? db.localeCompare(da) : da.localeCompare(db)
  })
  const count = (t: Tab) => (t === 'all' ? mine.length : mine.filter((b) => b.status === t).length)
  const list = tab === 'all' ? mine : mine.filter((b) => b.status === tab)

  return (
    <section className="max-w-5xl mx-auto px-5 py-10">
      <h1 className="font-display text-4xl font-bold">การจองของฉัน</h1>
      <div className="mt-6 flex gap-2 flex-wrap" role="tablist">
        {TABS.map((t) => (
          <Chip key={t} role="tab" pressed={tab === t} onClick={() => setTab(t)}>
            {t === 'all' ? 'ทั้งหมด' : BOOKING_STATUS_LABEL[t]} <span className="opacity-60">{count(t)}</span>
          </Chip>
        ))}
      </div>
      <div className="mt-6 space-y-5">
        {list.map((b) => {
          const event = eventOf(b)
          return (
            event && (
              <BookingTicket key={b.id} booking={b} event={event} onShowQr={() => setQrFor(b)} onCancel={() => setCancelFor(b)} />
            )
          )
        })}
        {!list.length && (
          <div className="border border-dashed border-line rounded-2xl py-14 text-center">
            <p className="text-muted">ยังไม่มีการจองในหมวดนี้</p>
            <Link to="/events" className="mt-3 inline-block text-cobalt font-semibold hover:underline underline-offset-4">
              หางานที่เปิดจอง
            </Link>
          </div>
        )}
      </div>

      <QrDialog booking={qrFor} event={qrFor ? eventOf(qrFor) : undefined} onClose={() => setQrFor(null)} />
      <ConfirmDialog
        open={!!cancelFor}
        title="ยกเลิกคำขอนี้"
        message={cancelFor && `ล็อก ${cancelFor.lot} จะกลับไปว่างให้คนอื่นจอง และระบบจะคืนเงินให้ภายใน ${POLICY.refundBusinessDays} วันทำการ`}
        confirmLabel="ยกเลิกคำขอ"
        onClose={() => setCancelFor(null)}
        onConfirm={() => {
          if (!cancelFor) return
          cancelBooking(cancelFor.id, CANCEL_REASON.bySeller, 'seller')
          toast(`ยกเลิกคำขอ ${cancelFor.id} แล้ว`)
          setCancelFor(null)
        }}
      />
    </section>
  )
}
