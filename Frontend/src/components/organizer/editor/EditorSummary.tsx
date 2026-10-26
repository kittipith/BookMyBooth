import type { Zone } from '../../../types'
import { baht } from '../../../utils/format'
import { withSurcharge } from '../../../utils/pricing'
import { zoneClass } from '../../../utils/layout'
import type { EditorDay } from './DayPricingTable'

interface EditorSummaryProps {
  zones: Zone[]
  counts: Record<string, number>
  days: EditorDay[]
}

export default function EditorSummary({ zones, counts, days }: EditorSummaryProps) {
  const total = zones.reduce((sum, z) => sum + (counts[z.id] ?? 0), 0)
  const maxRevenue = days.reduce(
    (sum, d) => sum + zones.reduce((s, z) => s + (counts[z.id] ?? 0) * withSurcharge(z.price, d.surcharge), 0),
    0,
  )
  return (
    <aside className="xl:sticky xl:top-8 bg-cobalt text-oncobalt rounded-2xl p-6">
      <p className="text-sm opacity-70">สรุปผังนี้</p>
      <p className="font-display text-6xl font-bold mt-1">{total}</p>
      <p className="opacity-80">ล็อกต่อวัน</p>
      <ul className="mt-5 space-y-2 text-sm">
        {zones.map((z) => (
          <li key={z.id} className="flex justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-[2px] ring-1 ring-oncobalt/70 ${zoneClass(zones, z.id)}`} />
              โซน {z.id} {z.name}
            </span>
            <span className="font-display font-semibold">{counts[z.id] ?? 0}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 pt-5 border-t border-oncobalt/25">
        <p className="text-sm opacity-70">รายได้สูงสุดถ้าขายหมดทุกวัน</p>
        <p className="font-display text-3xl font-bold mt-1">{baht(maxRevenue)}</p>
        <p className="text-xs opacity-70 mt-1">{days.length} วัน</p>
      </div>
    </aside>
  )
}
