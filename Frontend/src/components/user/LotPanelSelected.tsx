import { FEES } from '../../data/settings'
import type { MarketEvent } from '../../types'
import { baht, rangeLabel } from '../../utils/format'
import { lotSize } from '../../utils/layout'
import { eventPrice, lotZoneId, zoneOf } from '../../utils/pricing'

interface LotPanelSelectedProps {
  event: MarketEvent
  /** ล็อกที่เลือกไว้ จองพร้อมกันทั้งงานและจ่ายครั้งเดียว */
  lots: string[]
  /** เลือกเพิ่มได้อีกกี่ล็อก (null = ไม่จำกัด) */
  quotaLeft: number | null
  onRemove: (lot: string) => void
  onClear: () => void
  onBook: () => void
}

export default function LotPanelSelected({ event, lots, quotaLeft, onRemove, onClear, onBook }: LotPanelSelectedProps) {
  const rent = lots.reduce((sum, lot) => sum + eventPrice(event, lotZoneId(lot)), 0)
  const first = event.days[0]
  const last = event.days[event.days.length - 1]

  return (
    <div className="bg-surface border border-line rounded-2xl stamp overflow-hidden">
      <div className="p-6 bg-cobalt text-oncobalt">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm opacity-80">ล็อกที่เลือก</p>
            {lots.length === 1 ? (
              <p className="font-display text-6xl font-bold leading-none mt-1">{lots[0]}</p>
            ) : (
              <p className="font-display text-6xl font-bold leading-none mt-1">
                {lots.length} <span className="text-2xl">ล็อก</span>
              </p>
            )}
          </div>
          <button type="button" onClick={onClear} className="text-sm underline underline-offset-4 opacity-90">
            {lots.length === 1 ? 'เลือกใหม่' : 'ล้างทั้งหมด'}
          </button>
        </div>
        {lots.length > 1 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {lots.map((code) => (
              <li key={code}>
                <button
                  type="button"
                  onClick={() => onRemove(code)}
                  className="flex items-center gap-1.5 rounded-md bg-oncobalt/15 hover:bg-oncobalt/25 px-2 py-1 font-display font-semibold text-sm"
                  aria-label={`เอาล็อก ${code} ออก`}
                >
                  {code} <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs opacity-80">
          กดล็อกว่างบนผังเพื่อเลือกเพิ่ม กดซ้ำเพื่อเอาออก
          {quotaLeft !== null && ` · เลือกได้อีก ${quotaLeft} ล็อก`}
        </p>
      </div>
      <div className="p-6">
        <div className="rounded-xl bg-mist px-4 py-3">
          <p className="text-sm text-muted">จองทั้งงาน</p>
          <p className="font-semibold">
            {rangeLabel(first.date, last.date)} <span className="font-normal text-muted">({event.days.length} วัน)</span>
          </p>
        </div>
        <ul className="mt-4 divide-y divide-line">
          {lots.map((code) => {
            const zone = zoneOf(event, lotZoneId(code))
            return (
              <li key={code} className="py-2 first:pt-0 flex items-baseline justify-between gap-3">
                <span>
                  <b className="font-display">{code}</b>{' '}
                  <span className="text-sm text-muted">
                    โซน {zone?.id} {zone?.name} · {lotSize(event, code)}
                  </span>
                </span>
                <span className="font-display font-semibold whitespace-nowrap">{baht(eventPrice(event, lotZoneId(code)))}</span>
              </li>
            )
          })}
        </ul>
        <div className="mt-3 pt-4 border-t border-line space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">
              ค่าเช่า {lots.length} ล็อก ทั้งงาน {event.days.length} วัน
            </span>
            <span>{baht(rent)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">ค่าธรรมเนียมระบบ{lots.length > 1 && ' (ครั้งเดียว)'}</span>
            <span>{baht(FEES.service)}</span>
          </div>
          <div className="flex justify-between items-baseline pt-2">
            <span className="font-semibold">รวม</span>
            <span className="font-display text-3xl font-bold">{baht(rent + FEES.service)}</span>
          </div>
        </div>
        <button type="button" onClick={onBook} className="mt-5 w-full bg-cobalt text-oncobalt rounded-xl py-3.5 font-semibold">
          {lots.length === 1 ? `จองล็อก ${lots[0]}` : `จอง ${lots.length} ล็อก จ่ายครั้งเดียว`}
        </button>
      </div>
    </div>
  )
}
