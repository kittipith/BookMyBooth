import type { MarketEvent } from '../../types'
import { baht, rangeLabel } from '../../utils/format'
import { eventPrice } from '../../utils/pricing'

export default function LotPanelEmpty({ event }: { event: MarketEvent }) {
  const first = event.days[0]
  const last = event.days[event.days.length - 1]
  return (
    <div className="bg-surface border border-line rounded-2xl p-6">
      <h2 className="font-display text-xl font-semibold">ยังไม่ได้เลือกล็อก</h2>
      <p className="mt-1.5 text-muted leading-relaxed">แตะล็อกสีขาวบนผังเพื่อดูขนาดและราคา เลือกได้หลายล็อก</p>
      <ul className="mt-5 divide-y divide-line border-t border-line">
        {event.zones.map((z) => (
          <li key={z.id} className="py-3 flex justify-between gap-3">
            <span>
              <b>โซน {z.id}</b> <span className="text-muted">{z.name}</span>
            </span>
            <span className="font-display font-semibold">{baht(eventPrice(event, z.id))}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted mt-3">
        ราคาต่อล็อกตลอดงาน {rangeLabel(first.date, last.date)} ({event.days.length} วัน)
      </p>
    </div>
  )
}
