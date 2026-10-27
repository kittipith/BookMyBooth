import { zoneFill } from '../../services/organizer'
import type { LotStates, PublicEvent } from '../../types'
import { eventLots, zoneClass } from '../../utils/layout'

/** เปอร์เซ็นต์ล็อกที่อนุมัติแล้วในแต่ละโซน */
export default function ZoneFillBars({ event, states }: { event: PublicEvent; states: LotStates }) {
  const lots = eventLots(event)
  const zones = event.zones.filter((z) => lots.some((l) => l.zone === z.id))
  return (
    <div className="mt-5 space-y-4">
      {zones.map((z) => {
        const pct = zoneFill(event, states, z.id)
        return (
          <div key={z.id}>
            <div className="flex justify-between text-sm">
              <span>
                <b>โซน {z.id}</b> <span className="text-muted">{z.name}</span>
              </span>
              <span className="font-display font-semibold">{pct}%</span>
            </div>
            <div className="mt-1.5 h-2.5 bg-mist rounded-sm overflow-hidden">
              <div className={`h-full ${zoneClass(event.zones, z.id)}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
