import { Link } from 'react-router'
import type { Booking, MarketEvent } from '../../types'
import { baht, rangeLabel } from '../../utils/format'
import { BookingStatusBadge } from '../common/StatusBadge'

interface BookingTicketProps {
  booking: Booking
  event: MarketEvent
  onShowQr: () => void
  onCancel: () => void
}

/** การจองหนึ่งรายการในรูปแบบตั๋ว มีส่วนต้นขั้วด้านขวา */
export default function BookingTicket({ booking, event, onShowQr, onCancel }: BookingTicketProps) {
  // แสดงแค่ว่าจัดวันไหนถึงวันไหน
  const sorted = [...booking.days].sort((a, b) => a - b)
  const from = event.days[sorted[0]]
  const to = event.days[sorted[sorted.length - 1]]
  const dayText = from && to ? rangeLabel(from.date, to.date) : ''
  const faded = booking.status === 'cancelled'

  return (
    <article className={`ticket grid sm:grid-cols-[1fr_210px] bg-surface border border-line rounded-2xl ${faded ? 'opacity-60' : ''}`}>
      <div className="p-5 sm:p-6 flex gap-5 sm:gap-7 items-center">
        <div
          className={`font-display text-5xl sm:text-6xl font-bold leading-none ${booking.status === 'approved' ? 'text-cobalt' : ''}`}
        >
          {booking.lot}
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-snug">{event.title}</h2>
          <p className="text-sm text-muted">{event.venue}</p>
          <p className="text-sm mt-2">
            {dayText} <span className="text-muted">เวลา {event.hours}</span>
          </p>
          {booking.status === 'rejected' && booking.reason && (
            <p className="text-sm mt-2 text-danger">เหตุผลจากผู้จัดงาน: {booking.reason}</p>
          )}
          {booking.status === 'cancelled' && booking.reason && <p className="text-sm mt-2 text-muted">{booking.reason}</p>}
        </div>
      </div>
      <div className="stub border-t-[1.5px] sm:border-t-0 sm:border-l-[1.5px] border-dashed border-line p-5 sm:p-6 flex sm:flex-col justify-between items-center sm:items-start gap-3">
        <div>
          <BookingStatusBadge status={booking.status} />
          <p className="text-xs text-muted mt-2">{booking.id}</p>
          <p className="font-display text-xl font-semibold">{baht(booking.amount)}</p>
        </div>
        {booking.status === 'approved' && event.status !== 'ended' && (
          <button type="button" onClick={onShowQr} className="bg-cobalt text-oncobalt rounded-lg px-4 py-2 text-sm font-semibold">
            แสดง QR เช็กอิน
          </button>
        )}
        {booking.status === 'approved' && event.status === 'ended' && (
          <p className={`text-sm font-semibold ${booking.checkedIn ? 'text-muted' : 'text-danger'}`}>
            จบงานแล้ว · {booking.checkedIn ? 'เช็กอินแล้ว' : 'ไม่ได้มาตามนัด'}
          </p>
        )}
        {booking.status === 'pending' && (
          <button type="button" onClick={onCancel} className="text-sm text-danger underline underline-offset-4">
            ยกเลิกคำขอ
          </button>
        )}
        {(booking.status === 'rejected' || booking.status === 'cancelled') && event.status === 'open' && (
          <Link to={`/events/${event.id}`} className="text-sm font-semibold underline underline-offset-4">
            เลือกล็อกอื่นในงานนี้
          </Link>
        )}
      </div>
    </article>
  )
}
