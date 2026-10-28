import { POLICY } from '../../data/settings'
import { eventDayCount } from '../../services/events'
import type { PublicEvent } from '../../types'
import { baht, rangeLabel } from '../../utils/format'
import { lotZoneId, zoneOf } from '../../utils/pricing'

interface BookingSummaryProps {
  event: PublicEvent
  /** ล็อกที่จองพร้อมกันในครั้งนี้ พร้อมราคา (ก่อนจอง = ราคาโซน หลังจอง = amount จาก backend) */
  items: { lot: string; amount: number }[]
  /** ขอไฟ 15A (แจ้งผู้จัดงาน ไม่คิดเงินในระบบ) */
  power?: boolean
}

/** สรุปยอดที่ต้องโอน = ราคาโซนของทุกล็อกตลอดงาน ไม่มีค่าไฟหรือค่าธรรมเนียม (I2, F31) */
export default function BookingSummary({ event, items, power = false }: BookingSummaryProps) {
  const single = items.length === 1
  const zone = zoneOf(event, lotZoneId(items[0]?.lot ?? ''))
  const days = eventDayCount(event)
  const total = items.reduce((sum, i) => sum + i.amount, 0)
  return (
    <div className="bg-surface border border-line rounded-2xl p-6">
      <p className="text-sm text-muted">{event.title}</p>
      <div className="flex items-baseline justify-between mt-2">
        <span className="font-display text-5xl font-bold">{single ? items[0].lot : `${items.length} ล็อก`}</span>
        {single && (
          <span className="text-sm text-muted">
            โซน {zone?.id} {zone?.name}
          </span>
        )}
      </div>
      {!single && <p className="mt-2 font-display font-semibold">{items.map((i) => i.lot).join(', ')}</p>}
      <p className="mt-2 text-sm">
        {rangeLabel(event.startDate, event.endDate)} <span className="text-muted">({days} วัน)</span>
      </p>
      <ul className="mt-5 space-y-2 text-sm border-t border-line pt-4">
        {items.map((i) => (
          <li key={i.lot} className="flex justify-between">
            <span>
              ล็อก {i.lot} ทั้งงาน {days} วัน
            </span>
            <span>{baht(i.amount)}</span>
          </li>
        ))}
        {power && (
          <li className="flex justify-between text-muted">
            <span>ขอไฟฟ้า 15A</span>
            <span>ตกลงกับผู้จัดงาน</span>
          </li>
        )}
      </ul>
      <div className="flex justify-between items-baseline mt-4 pt-4 border-t border-line">
        <span className="font-semibold">ยอดชำระ</span>
        <span className="font-display text-3xl font-bold">{baht(total)}</span>
      </div>
      <p className="text-xs text-muted mt-3 leading-relaxed">{POLICY.refundNote.seller}</p>
    </div>
  )
}
