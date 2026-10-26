import { Link } from 'react-router'
import ProgressBar from '../../components/common/ProgressBar'
import { EventStatusBadge } from '../../components/common/StatusBadge'
import { useOrganizerData } from '../../hooks/useAppStore'
import { eventRevenue, lotLimitLabel } from '../../services/selectors'
import type { EventStatus } from '../../types'
import { baht, fullTitle, rangeLabel } from '../../utils/format'
import { soldStats } from '../../utils/pricing'

const ORDER: EventStatus[] = ['open', 'scheduled', 'closed', 'draft', 'ended']

export default function MyEventsPage() {
  const { myEvents, myBookings } = useOrganizerData()
  const list = [...myEvents].sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.days[0].date.localeCompare(b.days[0].date),
  )

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-bold">งานของฉัน</h1>
        <Link to="/organizer/editor" className="bg-cobalt text-oncobalt rounded-xl px-5 py-3 font-semibold press">
          สร้างงานใหม่
        </Link>
      </div>
      <div className="mt-8 bg-surface border border-line rounded-2xl relative overflow-x-auto">
        <table className="w-full text-left min-w-[760px]">
          <thead className="text-sm text-muted border-b border-line">
            <tr>
              <th className="font-medium px-6 py-3">งาน</th>
              <th className="font-medium px-4 py-3">สถานะ</th>
              <th className="font-medium px-4 py-3">ล็อกที่ขายแล้ว</th>
              <th className="font-medium px-4 py-3 text-right">รายได้</th>
              <th className="px-6 py-3">
                <span className="sr-only">จัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((e) => {
              const { sold, total } = soldStats(e)
              const revenue = eventRevenue(myBookings, e.id)
              return (
                <tr key={e.id}>
                  <td className="px-6 py-4">
                    <p className="font-semibold">{fullTitle(e)}</p>
                    <p className="text-sm text-muted">{rangeLabel(e.days[0].date, e.days.at(-1)!.date)}</p>
                    <p className="text-xs text-muted">
                      เปิดรับจอง {rangeLabel(e.bookingOpens, e.bookingCloses)} · {lotLimitLabel(e)}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <EventStatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <ProgressBar value={total ? (sold / total) * 100 : 0} />
                      <span className="text-sm">
                        <b className="font-display">{sold}</b> <span className="text-muted">/ {total}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-display font-semibold">
                    {revenue ? baht(revenue) : <span className="text-muted font-body font-normal">ยังไม่มี</span>}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <Link to={`/organizer/editor/${e.id}`} className="text-sm font-semibold text-cobalt hover:underline underline-offset-4">
                      แก้ไขผัง
                    </Link>
                    {e.status !== 'draft' && (
                      <Link to={`/organizer/bookings?tab=all&event=${e.id}`} className="ml-4 text-sm hover:underline underline-offset-4">
                        ดูการจอง
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
