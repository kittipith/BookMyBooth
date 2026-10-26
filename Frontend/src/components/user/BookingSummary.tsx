import { FEES, POLICY } from '../../data/settings'
import type { MarketEvent } from '../../types'
import { baht, rangeLabel } from '../../utils/format'
import { checkoutTotal, lotZoneId, rentFor, zoneOf } from '../../utils/pricing'

interface BookingSummaryProps {
  event: MarketEvent
  /** ล็อกที่จองพร้อมกันในครั้งนี้ */
  lots: string[]
  /** วันที่จอง (ปกติคือทุกวันของงาน) */
  days: number[]
  power?: boolean
}

export default function BookingSummary({ event, lots, days, power = false }: BookingSummaryProps) {
  const single = lots.length === 1
  const zone = zoneOf(event, lotZoneId(lots[0] ?? ''))
  const sorted = [...days].sort((a, b) => a - b)
  const first = event.days[sorted[0]]
  const last = event.days[sorted[sorted.length - 1]]
  return (
    <div className="bg-surface border border-line rounded-2xl p-6">
      <p className="text-sm text-muted">{event.title}</p>
      <div className="flex items-baseline justify-between mt-2">
        <span className="font-display text-5xl font-bold">{single ? lots[0] : `${lots.length} ล็อก`}</span>
        {single && (
          <span className="text-sm text-muted">
            โซน {zone?.id} {zone?.name}
          </span>
        )}
      </div>
      {!single && <p className="mt-2 font-display font-semibold">{lots.join(', ')}</p>}
      {first && last && (
        <p className="mt-2 text-sm">
          {rangeLabel(first.date, last.date)} <span className="text-muted">({days.length} วัน)</span>
        </p>
      )}
      <ul className="mt-5 space-y-2 text-sm border-t border-line pt-4">
        {lots.map((lot) => (
          <li key={lot} className="flex justify-between">
            <span>
              ล็อก {lot} ทั้งงาน {days.length} วัน
            </span>
            <span>{baht(rentFor(event, lot, days))}</span>
          </li>
        ))}
        {power && (
          <li className="flex justify-between">
            <span className="text-muted">
              ไฟฟ้า 15A × {days.length} วัน{!single && ` × ${lots.length} ล็อก`}
            </span>
            <span>{baht(FEES.power * days.length * lots.length)}</span>
          </li>
        )}
        <li className="flex justify-between">
          <span className="text-muted">ค่าธรรมเนียมระบบ{!single && ' (ครั้งเดียว)'}</span>
          <span>{baht(FEES.service)}</span>
        </li>
      </ul>
      <div className="flex justify-between items-baseline mt-4 pt-4 border-t border-line">
        <span className="font-semibold">ยอดชำระ</span>
        <span className="font-display text-3xl font-bold">{baht(checkoutTotal(event, lots, days, power))}</span>
      </div>
      <p className="text-xs text-muted mt-3 leading-relaxed">ถ้าผู้จัดงานไม่อนุมัติ ระบบคืนเงินเต็มจำนวนภายใน {POLICY.refundBusinessDays} วันทำการ</p>
    </div>
  )
}
