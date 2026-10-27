import { Link } from 'react-router'
import ProgressBar from '../../components/common/ProgressBar'
import { EventStatusBadge } from '../../components/common/StatusBadge'
import { useEventSummaries, useMyEvents } from '../../queries/organizer'
import { lotLimitLabel } from '../../services/selectors'
import type { EventStatus } from '../../types'
import { baht, bangkokDate, fullTitle, rangeLabel } from '../../utils/format'

const ORDER: EventStatus[] = ['open', 'scheduled', 'closed', 'draft', 'ended']

export default function MyEventsPage() {
  const { data: events = [], isPending, isError } = useMyEvents()
  const summaries = useEventSummaries(events.map((e) => e.id))
  const list = [...events].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.startDate.localeCompare(b.startDate))

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
              const summary = summaries[e.id]
              // ล็อกที่ปิดไว้ไม่นับเป็นล็อกที่ขายได้
              const total = summary ? summary.lots.total - summary.lots.DISABLED : 0
              const sold = summary?.lots.BOOKED ?? 0
              return (
                <tr key={e.id}>
                  <td className="px-6 py-4">
                    <p className="font-semibold">{fullTitle(e)}</p>
                    <p className="text-sm text-muted">{rangeLabel(e.startDate, e.endDate)}</p>
                    <p className="text-xs text-muted">
                      เปิดรับจอง {rangeLabel(bangkokDate(e.bookingOpensAt), bangkokDate(e.bookingClosesAt))} · {lotLimitLabel(e)}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <EventStatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-4">
                    {summary ? (
                      <div className="flex items-center gap-3">
                        <ProgressBar value={total ? (sold / total) * 100 : 0} />
                        <span className="text-sm">
                          <b className="font-display">{sold}</b> <span className="text-muted">/ {total}</span>
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted">…</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right font-display font-semibold">
                    {summary?.revenue ? baht(summary.revenue) : <span className="text-muted font-body font-normal">ยังไม่มี</span>}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <Link to={`/organizer/editor/${e.id}`} className="text-sm font-semibold text-cobalt hover:underline underline-offset-4">
                      {e.publishStatus === 'closed' ? 'ดูผัง' : 'แก้ไขผัง'}
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
        {isPending && <p className="px-6 py-10 text-center text-muted">กำลังโหลดงาน…</p>}
        {isError && <p className="px-6 py-10 text-center text-danger">โหลดงานไม่สำเร็จ ลองรีเฟรชหน้า</p>}
        {!isPending && !isError && !list.length && (
          <p className="px-6 py-10 text-center text-muted">ยังไม่มีงาน กดสร้างงานใหม่เพื่อเริ่มวาดผัง</p>
        )}
      </div>
    </section>
  )
}
