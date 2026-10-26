import { useState } from 'react'
import { Link } from 'react-router'
import ProgressBar from '../../components/common/ProgressBar'
import { LIMITS } from '../../data/settings'
import { useAppStore, useOrganizerData } from '../../hooks/useAppStore'
import { vendorStats } from '../../services/selectors'
import { baht } from '../../utils/format'
import SelectBox from '../../components/common/SelectBox'

type SortKey = 'approved' | 'total' | 'showRate'

export default function VendorsPage() {
  const { shops, events } = useAppStore()
  const { myBookings } = useOrganizerData()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('approved')

  const keyword = q.trim().toLowerCase()
  const list = vendorStats(myBookings, events, shops)
    .filter((v) => !keyword || `${v.shop.name} ${v.shop.category} ${v.shop.owner}`.toLowerCase().includes(keyword))
    .sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1))

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold">ผู้ขาย</h1>
          <p className="mt-1 text-muted">ร้านที่เคยส่งคำขอจองล็อกในงานของคุณ {list.length} ร้าน</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <SelectBox
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={[
              { value: 'approved', label: 'เรียงตามจำนวนครั้ง' },
              { value: 'total', label: 'เรียงตามยอดรวม' },
              { value: 'showRate', label: 'เรียงตามการมาตามนัด' },
            ]}
            className="w-auto text-sm!"
            aria-label="เรียงตาม"
          />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="fld text-sm sm:w-56!" placeholder="ค้นหาร้านหรือประเภท" />
        </div>
      </div>
      <div className="mt-8 bg-surface border border-line rounded-2xl relative overflow-x-auto">
        <table className="w-full text-left min-w-[720px]">
          <thead className="text-sm text-muted border-b border-line">
            <tr>
              <th className="font-medium px-6 py-3">ร้าน</th>
              <th className="font-medium px-4 py-3">ประเภท</th>
              <th className="font-medium px-4 py-3 text-right">จองสำเร็จ</th>
              <th className="font-medium px-4 py-3 text-right">ยอดรวม</th>
              <th className="font-medium px-4 py-3">มาตามนัด</th>
              <th className="font-medium px-6 py-3">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((v) => (
              <tr key={v.shop.id}>
                <td className="px-6 py-4">
                  <Link to={`/organizer/bookings?tab=all&q=${encodeURIComponent(v.shop.name)}`} className="font-semibold hover:text-cobalt">
                    {v.shop.name}
                  </Link>
                  <p className="text-sm text-muted">
                    {v.shop.owner} · {v.shop.phone}
                  </p>
                </td>
                <td className="px-4 py-4 text-muted">{v.shop.category}</td>
                <td className="px-4 py-4 text-right font-display font-semibold">{v.approved} ครั้ง</td>
                <td className="px-4 py-4 text-right font-display font-semibold">{baht(v.total)}</td>
                <td className="px-4 py-4">
                  {v.showRate === null ? (
                    <span className="text-sm text-muted">ยังไม่มีงานที่จบ</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        value={v.showRate}
                        className="w-20 h-2"
                        barClassName={v.showRate < LIMITS.lowShowRate ? 'bg-danger' : 'bg-cobalt'}
                      />
                      <span className="text-sm">
                        {v.showRate}% <span className="text-muted">({v.pastCount} งาน)</span>
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  {v.flagged ? (
                    <span className="text-sm text-danger font-semibold">ไม่มาตามนัดบ่อย</span>
                  ) : (
                    <span className="text-sm text-muted">ปกติ</span>
                  )}
                </td>
              </tr>
            ))}
            {!list.length && (
              <tr>
                <td colSpan={6} className="px-6 py-14 text-center text-muted">
                  {keyword ? 'ไม่พบร้านที่ค้นหา' : 'ยังไม่มีร้านจองในงานของคุณ'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
