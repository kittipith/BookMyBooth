import { Link, Navigate, useParams } from 'react-router'
import BookingStepper from '../../components/user/BookingStepper'
import BookingSummary from '../../components/user/BookingSummary'
import { POLICY } from '../../data/settings'
import { useAppStore } from '../../hooks/useAppStore'
import { lotLimitReached, sellerLots } from '../../services/selectors'

export default function BookingSentPage() {
  const { bookingId } = useParams()
  const { bookings, events } = useAppStore()
  const booking = bookings.find((b) => b.id === bookingId)
  const event = events.find((e) => e.id === booking?.eventId)

  if (!booking || !event) return <Navigate to="/my-bookings" replace />
  // ล็อกที่ส่งพร้อมกันในครั้งนี้ (สลิปเดียวกัน)
  const group = booking.groupId ? bookings.filter((b) => b.groupId === booking.groupId) : [booking]
  const lotText = group.map((b) => b.lot).join(', ')
  const approved = group.every((b) => b.status === 'approved')
  const myLots = sellerLots(bookings, event.id, booking.shopId)
  const canBookMore = !lotLimitReached(event, myLots.length)

  return (
    <section className="max-w-6xl mx-auto px-5 py-10">
      <BookingStepper step={3} />
      <div className="mt-8 grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        <div>
          <div className={`rounded-2xl p-7 sm:p-9 ${approved ? 'bg-cobalt text-oncobalt' : 'bg-sun text-onsun'}`}>
            <p className="font-display text-5xl font-bold">{approved ? 'จองสำเร็จ' : 'ส่งคำขอแล้ว'}</p>
            <p className="mt-3 text-lg max-w-lg leading-relaxed">
              {approved
                ? `${event.organizer} เปิดอนุมัติอัตโนมัติ ล็อก ${lotText} เป็นของคุณแล้ว ดู QR เช็กอินได้ในหน้าการจองของฉัน`
                : `${event.organizer} จะตรวจสลิปและอนุมัติภายใน ${POLICY.reviewHours} ชั่วโมง ระหว่างนี้ล็อก ${lotText} จะแสดงเป็นสีเหลืองบนผังเพื่อกันคนอื่นจองซ้อน`}
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
              <Link
                to={`/events/${event.id}`}
                className="border-[1.5px] border-cobalt text-cobalt rounded-xl px-6 py-3 font-semibold hover:bg-cobalt/5"
              >
                จองล็อกเพิ่มในงานนี้
              </Link>
            )}
          </div>
          <p className="mt-3 text-sm text-muted">
            ในงานนี้คุณจองแล้ว {myLots.length} ล็อก ({myLots.join(', ')})
            {event.maxLotsPerSeller === null
              ? ' จองเพิ่มได้ไม่จำกัด กดเลือกทีละล็อก'
              : canBookMore
                ? ` จองเพิ่มได้อีก ${event.maxLotsPerSeller - myLots.length} ล็อก กดเลือกทีละล็อก`
                : ` ครบ ${event.maxLotsPerSeller} ล็อกตามที่ผู้จัดงานกำหนดแล้ว`}
          </p>
        </div>
        <aside className="lg:sticky lg:top-24">
          <BookingSummary event={event} lots={group.map((b) => b.lot)} days={booking.days} power={booking.power} />
        </aside>
      </div>
    </section>
  )
}
