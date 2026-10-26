import type { Booking, MarketEvent } from '../../types'
import { baht } from '../../utils/format'

interface PendingQueueProps {
  bookings: Booking[]
  events: MarketEvent[]
  onOpen: (b: Booking) => void
  onApprove: (b: Booking) => void
  onReject: (b: Booking) => void
}

export default function PendingQueue({ bookings, events, onOpen, onApprove, onReject }: PendingQueueProps) {
  if (!bookings.length) {
    return <p className="px-6 py-10 text-center text-muted">ไม่มีคำขอค้างอยู่ ตรวจครบทุกรายการแล้ว</p>
  }
  return (
    <ul className="divide-y divide-line">
      {bookings.map((b) => {
        const event = events.find((e) => e.id === b.eventId)
        return (
          // จอเล็กปุ่มลงไปบรรทัดใหม่ใต้ชื่อร้าน ชื่อร้านจะได้ไม่ถูกตัดจนอ่านไม่ออก
          <li key={b.id} className="px-6 py-4 flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2">
            <span className="font-display text-2xl font-bold w-14 shrink-0">{b.lot}</span>
            <button type="button" onClick={() => onOpen(b)} className="min-w-0 flex-1 text-left hover:text-cobalt">
              <span className="block font-semibold truncate">{b.shopName}</span>
              <span className="block text-sm text-muted truncate">
                {b.days.map((d) => event?.days[d]?.label).join(', ')}{' '}
                {b.slipAmount !== b.amount && <span className="text-danger">ยอดในสลิปไม่ตรง</span>}
              </span>
            </button>
            <span className="font-display font-semibold hidden sm:block">{baht(b.amount)}</span>
            <div className="flex gap-2 shrink-0 basis-full sm:basis-auto pl-[4.5rem] sm:pl-0">
              <button type="button" onClick={() => onApprove(b)} className="bg-cobalt text-oncobalt rounded-lg px-3 py-1.5 text-sm font-semibold">
                อนุมัติ
              </button>
              <button
                type="button"
                onClick={() => onReject(b)}
                className="border border-line rounded-lg px-3 py-1.5 text-sm hover:border-danger hover:text-danger"
              >
                ไม่อนุมัติ
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
