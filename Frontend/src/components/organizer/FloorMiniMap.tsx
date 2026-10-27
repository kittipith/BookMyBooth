import { FLOOR_STATE_LABEL as TITLE } from '../../data/options'
import { lotStateOf } from '../../services/events'
import type { LotStates, PublicEvent } from '../../types'
import { cellSizes } from '../../utils/layout'
import { lotZoneId } from '../../utils/pricing'
import LayoutGrid from '../common/LayoutGrid'

interface FloorMiniMapProps {
  event: PublicEvent
  /** สถานะล็อกจาก GET /events/{id}/lots */
  states: LotStates
  target: string
}

/** ผังย่อสำหรับผู้จัดงาน วางตามผังที่วาดไว้ และเน้นล็อกที่ร้านนี้ขอ */
export default function FloorMiniMap({ event, states, target }: FloorMiniMapProps) {
  return (
    <>
      <div
        className="fmap bg-surface border border-line rounded-xl p-3"
        role="img"
        aria-label={`ผังงาน${event.title} ล็อก ${target} ที่ร้านนี้ขอ อยู่โซน ${lotZoneId(target)}`}
      >
        <LayoutGrid
          layout={event.layout}
          cols={event.cols}
          sizes={cellSizes(event.layout, event.zones, event.lotSizes)}
          renderLot={(code) => {
            const s = code === target ? 'target' : lotStateOf(states, code)
            return (
              <span className="fl" data-s={s} title={`${code} ${TITLE[s]}`}>
                {code}
              </span>
            )
          }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
        {(['target', 'pending', 'booked', 'free', 'disabled'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className="fl sw" data-s={s} />
            {TITLE[s]}
          </span>
        ))}
      </div>
    </>
  )
}
