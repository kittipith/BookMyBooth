import { Link, Navigate, useParams } from 'react-router'
import BookingStepper from '../../components/user/BookingStepper'
import BookingSummary from '../../components/user/BookingSummary'
import { BOOKING_STATUS_LABEL } from '../../data/options'
import { POLICY } from '../../data/settings'
import { useMyBookings } from '../../queries/bookings'
import { useEventDetail } from '../../queries/events'
import { activeLots, groupOf } from '../../services/bookings'
import { lotLimitReached } from '../../services/events'

/** ผลหลังส่งสลิป (หรือเปิดดูชุดการจองที่ไม่ได้รอสลิปแล้ว) */
export default function BookingSentPage() {
  const { groupId = '' } = useParams()
  const bookings = useMyBookings()
  const group = groupOf(bookings.data ?? [], groupId)
  const event = useEventDetail(group[0]?.eventId)

  if (bookings.isPending || (group.length && event.isPending)) return <p className="py-20 text-center text-muted">กำลังโหลด…</p>
  if (!group.length || !event.data) return <Navigate to="/my-bookings" replace />
  if (group.every((b) => b.status === 'awaiting_slip')) return <Navigate to={`/booking/payment/${groupId}`} replace />

  const ev = event.data
  const lotText = group.map((b) => b.lot).join(', ')
  const status = group[0].status
  const reviewing = group.some((b) => b.status === 'pending')
  const approved = group.every((b) => b.status === 'approved')
  const myLots = activeLots(bookings.data ?? [], ev.id)
  const canBookMore = ev.status === 'open' && !lotLimitReached(ev, myLots.length)

  return (
    <section className="max-w-6xl mx-auto px-5 py-10">
      <BookingStepper step={3} />
      <div className="mt-8 grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        <div>
          <div className={`rounded-2xl p-7 sm:p-9 ${approved ? 'bg-cobalt text-oncobalt' : reviewing ? 'bg-sun text-onsun' : 'bg-mist'}`}>
            <p className="font-display text-5xl font-bold">{approved ? 'จองสำเร็จ' : reviewing ? 'ส่งสลิปแล้ว' : BOOKING_STATUS_LABEL[status]}</p>
            <p className="mt-3 text-lg max-w-lg leading-relaxed">
              {approved
                ? `${ev.organizer} อนุมัติแล้ว ล็อก ${lotText} เป็นของคุณ ดู QR เช็กอินได้ในหน้าการจองของฉัน`
                : reviewing
                  ? `${ev.organizer} จะตรวจสลิปและอนุมัติภายใน ${POLICY.reviewHours} ชั่วโมง ระหว่างนี้ล็อก ${lotText} จะแสดงเป็นสีเหลืองบนผังเพื่อกันคนอื่นจองซ้อน`
                  : `การจองล็อก ${lotText} ไม่ได้อยู่ระหว่างดำเนินการแล้ว`}
            </p>
            <p className="mt-4 text-sm">
              หมายเลขการจอง <b className="font-display text-base">{group.map((b) => b.id).join(', ')}</b>
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/my-bookings" className="bg-cobalt text-oncobalt rounded-xl px-6 py-3 font-semibold">
              ดูการจองของฉัน
            </Link>
            {canBookMore && (
              <Link to={`/events/${ev.id}`} className="border-[1.5px] border-cobalt text-cobalt rounded-xl px-6 py-3 font-semibold hover:bg-cobalt/5">
                จองล็อกเพิ่มในงานนี้
              </Link>
            )}
          </div>
          {myLots.length > 0 && (
            <p className="mt-3 text-sm text-muted">
              ในงานนี้คุณจองแล้ว {myLots.length} ล็อก ({myLots.join(', ')})
              {ev.maxLotsPerSeller === null
                ? ' จองเพิ่มได้ไม่จำกัด'
                : canBookMore
                  ? ` จองเพิ่มได้อีก ${ev.maxLotsPerSeller - myLots.length} ล็อก`
                  : ` ครบ ${ev.maxLotsPerSeller} ล็อกตามที่ผู้จัดงานกำหนดแล้ว`}
            </p>
          )}
        </div>
        <aside className="lg:sticky lg:top-24">
          <BookingSummary event={ev} items={group.map((b) => ({ lot: b.lot, amount: b.amount }))} power={group[0].power} />
        </aside>
      </div>
    </section>
  )
}
