import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import CheckInPanel from '../../components/organizer/CheckInPanel'
import PendingQueue from '../../components/organizer/PendingQueue'
import BookingReasonDialog from '../../components/popup/BookingReasonDialog'
import ZoneFillBars from '../../components/organizer/ZoneFillBars'
import { LIMITS } from '../../data/settings'
import { useAccountProfile } from '../../hooks/useAuth'
import { useBookingDecisions } from '../../hooks/useBookingDecisions'
import { useEventLots } from '../../queries/events'
import { bookableEventIds, useEventSummaries, useOrganizerBookings } from '../../queries/organizer'
import { monthRevenue, nextEvent, soldStats } from '../../services/organizer'
import type { OrganizerBooking } from '../../types'
import { baht, diffDays, firstName, fullTitle, shortDate, TODAY } from '../../utils/format'

const STRIP = 42

function startsIn(date: string) {
  const n = diffDays(TODAY, date)
  if (n > 1) return `เริ่มในอีก ${n} วัน`
  if (n === 1) return 'เริ่มพรุ่งนี้'
  if (n === 0) return 'เริ่มวันนี้'
  return 'กำลังจัดอยู่'
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const profile = useAccountProfile()
  const { events, bookings } = useOrganizerBookings()
  const summaries = useEventSummaries(bookableEventIds(events))
  const { approve, reject } = useBookingDecisions()
  const [rejecting, setRejecting] = useState<OrganizerBooking | null>(null)

  const pending = bookings.filter((b) => b.status === 'pending')
  const next = nextEvent(events)
  const { data: nextStates } = useEventLots(next?.id)
  const stats = soldStats(next && summaries[next.id])
  const filled = stats.total ? Math.round((stats.sold / stats.total) * STRIP) : 0
  const thisMonth = monthRevenue(events, summaries, 0)
  const diff = thisMonth - monthRevenue(events, summaries, -1)
  const toCheckIn = next ? bookings.filter((b) => b.eventId === next.id && b.status === 'approved').length : 0

  return (
    <section>
      <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-tight">สวัสดีคุณ{firstName(profile?.name ?? '')}</h1>
      <p className="mt-1 text-muted text-lg">
        {next ? `${next.title}${startsIn(next.startDate)} และ` : ''}มีคำขอรออนุมัติ {pending.length} รายการ
      </p>

      <div className="mt-8 grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Link to="/organizer/bookings?tab=pending" className="text-left bg-sun text-onsun rounded-2xl p-5 stamp press">
          <p className="text-sm">รอคุณอนุมัติ</p>
          <p className="font-display text-5xl font-bold mt-2">{pending.length}</p>
          <p className="text-sm mt-2 underline underline-offset-4">ตรวจคำขอ</p>
        </Link>
        <div className="bg-surface border border-line rounded-2xl p-5">
          <p className="text-sm text-muted">ยอดที่ยืนยันแล้วเดือนนี้</p>
          <p className="font-display text-4xl font-bold mt-2">{baht(thisMonth)}</p>
          <p className="text-sm text-muted mt-2">
            {diff === 0 ? 'เท่ากับเดือนก่อน' : `${diff > 0 ? 'มากกว่า' : 'น้อยกว่า'}เดือนก่อน ${baht(Math.abs(diff))}`}
          </p>
        </div>
        <div className="bg-surface border border-line rounded-2xl p-5">
          <p className="text-sm text-muted">ล็อกที่ขายแล้ว {next ? (next.round ?? next.title) : ''}</p>
          <p className="font-display text-4xl font-bold mt-2">
            {stats.sold} <span className="text-lg text-muted font-medium">/ {stats.total}</span>
          </p>
          <div className="mt-3 flex gap-[2px]" aria-hidden="true">
            {Array.from({ length: STRIP }, (_, i) => (
              <i key={i} className={`flex-1 h-2 rounded-[1px] ${i < filled ? 'bg-cobalt' : 'bg-line'}`} />
            ))}
          </div>
        </div>
        <div className="bg-surface border border-line rounded-2xl p-5">
          <p className="text-sm text-muted">วันงานถัดไป</p>
          {next ? (
            <>
              <p className="font-display text-4xl font-bold mt-2">{shortDate(next.startDate).label}</p>
              <p className="text-sm text-muted mt-2">ผู้ขายต้องเช็กอิน {toCheckIn} ร้าน</p>
            </>
          ) : (
            <p className="font-display text-2xl font-bold mt-2">ยังไม่มีงาน</p>
          )}
        </div>
      </div>

      <div className="mt-8 grid xl:grid-cols-[1.2fr_1fr] gap-6">
        <div className="min-w-0 bg-surface border border-line rounded-2xl self-start">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">คำขอล่าสุดที่รอคุณ</h2>
            <Link to="/organizer/bookings?tab=pending" className="text-sm text-cobalt font-semibold hover:underline underline-offset-4">
              ดูทั้งหมด
            </Link>
          </div>
          <PendingQueue
            bookings={pending.slice(0, LIMITS.overviewQueue)}
            events={events}
            onOpen={(b) => navigate(`/organizer/bookings?tab=pending&id=${b.id}`)}
            onApprove={(b) => approve(b)}
            onReject={setRejecting}
          />
        </div>
        <div className="min-w-0 space-y-6">
          <div className="bg-surface border border-line rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">เช็กอินหน้างาน</h2>
            <CheckInPanel events={events} bookings={bookings} />
          </div>
          {next && nextStates && (
            <div className="bg-surface border border-line rounded-2xl p-6">
              <h2 className="font-display text-xl font-semibold">ความเต็มของแต่ละโซน</h2>
              <p className="text-sm text-muted">{fullTitle(next)} ล็อกที่อนุมัติแล้ว</p>
              <ZoneFillBars event={next} states={nextStates} />
            </div>
          )}
        </div>
      </div>

      <BookingReasonDialog
        kind="reject"
        booking={rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={async (b, reason) => {
          if (await reject(b, reason)) setRejecting(null)
        }}
      />
    </section>
  )
}
