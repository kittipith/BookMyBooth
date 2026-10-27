import { useState } from 'react'
import Chip from '../../components/common/Chip'
import { EventStatusBadge } from '../../components/common/StatusBadge'
import { EVENT_STATUS_LABEL } from '../../data/options'
import { useAdminEvents } from '../../queries/admin'
import type { EventStatus } from '../../types'
import { baht, bangkokDate, fullTitle, rangeLabel } from '../../utils/format'

type Tab = EventStatus | 'all'
const TABS: Tab[] = ['all', 'open', 'scheduled', 'closed', 'draft', 'ended']

/** ผู้ดูแลระบบดูงานทั้งหมดในระบบ (GET /admin/events) */
export default function AllEventsPage() {
  const { data = [], isPending, isError } = useAdminEvents()
  const [tab, setTab] = useState<Tab>('all')
  const rows = (tab === 'all' ? data : data.filter((r) => r.event.status === tab))
    .slice()
    .sort((a, b) => a.event.startDate.localeCompare(b.event.startDate))

  return (
    <section>
      <h1 className="font-display text-4xl font-bold">งานทั้งหมด</h1>
      <p className="mt-1 text-muted">งานของผู้จัดทุกราย พร้อมช่วงเปิดรับจองและยอดที่อนุมัติแล้ว</p>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <Chip key={t} role="tab" pressed={tab === t} onClick={() => setTab(t)}>
            {t === 'all' ? 'ทั้งหมด' : EVENT_STATUS_LABEL[t]}{' '}
            <span className="opacity-60">{t === 'all' ? data.length : data.filter((r) => r.event.status === t).length}</span>
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
              <th className="font-medium px-4 py-3 text-right">การจองที่ใช้งานอยู่</th>
              <th className="font-medium px-6 py-3 text-right">ยอดอนุมัติ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ event: e, bookingCount, revenue }) => (
              <tr key={e.id}>
                <td className="px-6 py-4">
                  <p className="font-semibold">{fullTitle(e)}</p>
                  <p className="text-sm text-muted">
                    {rangeLabel(e.startDate, e.endDate)} · {e.venue}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm">{e.organizer}</td>
                <td className="px-4 py-4 text-sm whitespace-nowrap">{rangeLabel(bangkokDate(e.bookingOpensAt), bangkokDate(e.bookingClosesAt))}</td>
                <td className="px-4 py-4">
                  <EventStatusBadge status={e.status} />
                </td>
                <td className="px-4 py-4 text-right font-display font-semibold">{bookingCount}</td>
                <td className="px-6 py-4 text-right font-display font-semibold">{baht(revenue)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-6 py-14 text-center text-muted">
                  {isPending ? 'กำลังโหลด…' : isError ? 'โหลดงานไม่ได้' : 'ไม่มีงานในหมวดนี้'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
