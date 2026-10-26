import { useState } from 'react'
import Chip from '../../components/common/Chip'
import ProgressBar from '../../components/common/ProgressBar'
import { EventStatusBadge } from '../../components/common/StatusBadge'
import { EVENT_STATUS_LABEL } from '../../data/options'
import { useAppStore } from '../../hooks/useAppStore'
import { byStartDate, eventRevenue } from '../../services/selectors'
import type { EventStatus } from '../../types'
import { baht, fullTitle, rangeLabel } from '../../utils/format'
import { soldStats } from '../../utils/pricing'

type Tab = EventStatus | 'all'
const TABS: Tab[] = ['all', 'open', 'scheduled', 'closed', 'draft', 'ended']

/** ผู้ดูแลระบบดูงานทั้งหมดในระบบ */
export default function AllEventsPage() {
  const { events, bookings } = useAppStore()
  const [tab, setTab] = useState<Tab>('all')
  const rows = (tab === 'all' ? events : events.filter((e) => e.status === tab)).slice().sort(byStartDate)

  return (
    <section>
      <h1 className="font-display text-4xl font-bold">งานทั้งหมด</h1>
      <p className="mt-1 text-muted">งานของผู้จัดทุกราย พร้อมช่วงเปิดรับจองและยอดที่อนุมัติแล้ว</p>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <Chip key={t} role="tab" pressed={tab === t} onClick={() => setTab(t)}>
            {t === 'all' ? 'ทั้งหมด' : EVENT_STATUS_LABEL[t]}{' '}
            <span className="opacity-60">{t === 'all' ? events.length : events.filter((e) => e.status === t).length}</span>
          </Chip>
        ))}
      </div>

      <div className="mt-5 bg-surface border border-line rounded-2xl relative overflow-x-auto">
        <table className="w-full text-left min-w-[900px]">
          <thead className="text-sm text-muted border-b border-line">
            <tr>
              <th className="font-medium px-6 py-3">งาน</th>
              <th className="font-medium px-4 py-3">ผู้จัด</th>
              <th className="font-medium px-4 py-3">เปิดรับจอง</th>
              <th className="font-medium px-4 py-3">สถานะ</th>
              <th className="font-medium px-4 py-3">ล็อกที่ขายแล้ว</th>
              <th className="font-medium px-6 py-3 text-right">ยอดอนุมัติ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((e) => {
              const { sold, total } = soldStats(e)
              return (
                <tr key={e.id}>
                  <td className="px-6 py-4">
                    <p className="font-semibold">{fullTitle(e)}</p>
                    <p className="text-sm text-muted">
                      {rangeLabel(e.days[0].date, e.days.at(-1)!.date)} · {e.venue}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-sm">{e.organizer}</td>
                  <td className="px-4 py-4 text-sm whitespace-nowrap">{rangeLabel(e.bookingOpens, e.bookingCloses)}</td>
                  <td className="px-4 py-4">
                    <EventStatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={total ? (sold / total) * 100 : 0} className="w-20 h-2" />
                      <span className="text-sm">
                        {sold}
                        <span className="text-muted">/{total}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-display font-semibold">{baht(eventRevenue(bookings, e.id))}</td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-6 py-14 text-center text-muted">
                  ไม่มีงานในหมวดนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
