import { Link } from 'react-router'
import { countdownLabel, secondsLeft } from '../../services/bookings'
import type { BookingGroup, PublicEvent } from '../../types'
import { baht, rangeLabel } from '../../utils/format'
import { BookingStatusBadge } from '../common/StatusBadge'

interface BookingTicketProps {
  /** การจองทั้งชุด (ล็อกที่จองพร้อมกัน สลิปเดียว) ยกเลิกได้ทั้งชุดเท่านั้น (D7) */
  booking: BookingGroup
  /** undefined = โหลดข้อมูลงานไม่ได้ (แสดงชื่องานจากการจองแทน) */
  event?: PublicEvent
  now: number
  onShowQr: () => void
  onShowSlip: () => void
  onCancel: () => void
}

/** การจองหนึ่งชุดในรูปแบบตั๋ว มีส่วนต้นขั้วด้านขวา */
export default function BookingTicket({ booking, event, now, onShowQr, onShowSlip, onCancel }: BookingTicketProps) {
  const faded = booking.status === 'cancelled' || booking.status === 'expired'
  const ended = event?.status === 'ended'
  const many = booking.lots.length > 1
  const cancellable = booking.status === 'awaiting_slip' || booking.status === 'pending'

  return (
    <article className={`ticket grid sm:grid-cols-[1fr_210px] bg-surface border border-line rounded-2xl ${faded ? 'opacity-60' : ''}`}>
      <div className="p-5 sm:p-6 flex gap-5 sm:gap-7 items-center">
        <div className={`shrink-0 font-display font-bold leading-none ${many ? 'text-3xl sm:text-4xl max-w-40' : 'text-5xl sm:text-6xl'} ${booking.status === 'approved' ? 'text-cobalt' : ''}`}>
          {booking.lot}
          {many && <p className="mt-2 font-sans text-xs font-normal text-muted">{booking.lots.length} ล็อก · สลิปเดียว</p>}
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-snug">{event?.title ?? booking.eventTitle}</h2>
          {event && (
            <>
              <p className="text-sm text-muted">{event.venue}</p>
              <p className="text-sm mt-2">
                {rangeLabel(event.startDate, event.endDate)} <span className="text-muted">เวลา {event.hours}</span>
              </p>
            </>
          )}
          {booking.moves.length > 0 && (
            <p className="text-sm mt-2 text-cobalt">ผู้จัดงานย้ายล็อก {booking.moves.map((m) => `${m.from} → ${m.to}`).join(', ')}</p>
          )}
          {booking.status === 'rejected' && booking.reason && <p className="text-sm mt-2 text-danger">เหตุผลจากผู้จัดงาน: {booking.reason}</p>}
          {booking.status === 'cancelled' && booking.reason && <p className="text-sm mt-2 text-muted">{booking.reason}</p>}
          {booking.status === 'expired' && <p className="text-sm mt-2 text-muted">ไม่ได้แนบสลิปภายในเวลา ล็อกถูกปล่อยให้คนอื่นจอง</p>}
        </div>
      </div>
      <div className="stub border-t-[1.5px] sm:border-t-0 sm:border-l-[1.5px] border-dashed border-line p-5 sm:p-6 flex sm:flex-col justify-between items-center sm:items-start gap-3">
        <div>
          <BookingStatusBadge status={booking.status} />
          <p className="text-xs text-muted mt-2 break-all">{booking.id}</p>
          <p className="font-display text-xl font-semibold">{baht(booking.amount)}</p>
        </div>
        {booking.status === 'awaiting_slip' && (
          <Link to={`/booking/payment/${booking.groupId}`} className="bg-cobalt text-oncobalt rounded-lg px-4 py-2 text-sm font-semibold">
            แนบสลิป · เหลือ {countdownLabel(secondsLeft(booking.expiresAt, now))}
          </Link>
        )}
        {booking.status === 'approved' && !ended && (
          <button type="button" onClick={onShowQr} className="bg-cobalt text-oncobalt rounded-lg px-4 py-2 text-sm font-semibold">
            แสดง QR เช็กอิน
          </button>
        )}
        {booking.status === 'approved' && ended && (
          <p className={`text-sm font-semibold ${booking.checkedIn ? 'text-muted' : 'text-danger'}`}>
            จบงานแล้ว · {booking.checkedIn ? 'เช็กอินแล้ว' : 'ไม่ได้มาตามนัด'}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {booking.hasSlip && (
            <button type="button" onClick={onShowSlip} className="text-sm underline underline-offset-4">
              ดูสลิป
            </button>
          )}
          {cancellable && (
            <button type="button" onClick={onCancel} className="text-sm text-danger underline underline-offset-4">
              {many ? 'ยกเลิกทั้งชุด' : 'ยกเลิกคำขอ'}
            </button>
          )}
          {(booking.status === 'rejected' || booking.status === 'cancelled' || booking.status === 'expired') && event?.status === 'open' && (
            <Link to={`/events/${event.id}`} className="text-sm font-semibold underline underline-offset-4">
              เลือกล็อกอื่นในงานนี้
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
