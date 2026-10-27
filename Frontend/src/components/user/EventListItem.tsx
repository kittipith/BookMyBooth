import { Link } from 'react-router'
import { eventDayCount, freeLotCount, startingPrice } from '../../services/events'
import type { LotStates, PublicEvent } from '../../types'
import { baht, rangeLabel, shortDate } from '../../utils/format'

interface EventListItemProps {
  event: PublicEvent
  /** สถานะล็อกของงานนี้ (undefined = กำลังโหลด) */
  lotStates?: LotStates
}

/** แถวรายการงาน พร้อมแถบจุดแสดงล็อกว่างทั้งงาน */
export default function EventListItem({ event, lotStates }: EventListItemProps) {
  const { day, month } = shortDate(event.startDate)
  const lots = Object.entries(lotStates ?? {}).sort(([a], [b]) => a.localeCompare(b))

  return (
    <article className="py-5 grid grid-cols-[64px_1fr] sm:grid-cols-[76px_1fr_auto] gap-x-5 gap-y-3 items-center">
      <div className="text-center bg-mist text-cobalt rounded-xl py-2.5 row-span-2 sm:row-span-1 self-start sm:self-center">
        <div className="font-display text-3xl font-bold leading-none">{day}</div>
        <div className="text-xs text-muted mt-1">{month}</div>
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted">{event.type}</p>
        <h3 className="font-display text-xl font-semibold leading-snug">
          <Link to={`/events/${event.id}`} className="hover:text-cobalt">
            {event.title}
          </Link>
        </h3>
        <p className="text-sm text-muted mt-0.5">
          {event.venue}, {rangeLabel(event.startDate, event.endDate)}
        </p>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <div className="flex flex-wrap gap-[2px] w-[150px]" aria-hidden="true">
            {lots.map(([code, state]) => (
              <i key={code} className={`w-[5px] h-[5px] rounded-[1px] ${state === 'free' ? 'bg-cobalt' : 'bg-line'}`} />
            ))}
          </div>
          {lotStates ? (
            <span className="text-sm">
              <b className="font-display">{freeLotCount(lotStates)}</b> <span className="text-muted">จาก {lots.length} ล็อกว่าง</span>
            </span>
          ) : (
            <span className="text-sm text-muted">กำลังโหลดล็อก…</span>
          )}
        </div>
      </div>
      <div className="flex sm:flex-col items-center sm:items-end gap-3 justify-between col-span-2 sm:col-span-1">
        <p className="text-sm text-muted">
          เริ่มต้น <b className="font-display text-xl text-ink">{baht(startingPrice(event))}</b> ทั้งงาน {eventDayCount(event)} วัน
        </p>
        <Link
          to={`/events/${event.id}`}
          className="border-[1.5px] border-cobalt text-cobalt rounded-lg px-4 py-2 text-sm font-semibold hover:bg-cobalt hover:text-oncobalt"
        >
          ดูผังล็อก
        </Link>
      </div>
    </article>
  )
}
