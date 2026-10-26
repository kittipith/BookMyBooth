import { LOT_STATE_LABEL as STATE_LABEL } from '../../data/options'
import type { MarketEvent } from '../../types'
import { baht } from '../../utils/format'
import { cellSizes, eventLots, lotSize } from '../../utils/layout'
import { eventPrice, lotStateAll } from '../../utils/pricing'
import LayoutGrid from '../common/LayoutGrid'

interface LotMapProps {
  event: MarketEvent
  /** ล็อกที่เลือกไว้ (เลือกได้หลายล็อก) */
  selected?: string[]
  onSelect?: (code: string) => void
  mini?: boolean
}

/** ผังล็อกของงานในวันที่เลือก วางตามตำแหน่งที่ผู้จัดงานวาดไว้จริง */
/** ผังล็อกของงาน ผู้ขายจองทั้งงาน ล็อกว่างเมื่อว่างครบทุกวัน */
export default function LotMap({ event, selected, onSelect, mini = false }: LotMapProps) {
  const lots = eventLots(event)
  const zones = event.zones.filter((z) => lots.some((l) => l.zone === z.id))

  return (
    <div>
      {!mini && (
        <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
          {zones.map((z) => (
            <li key={z.id}>
              <b>โซน {z.id}</b> <span className="text-muted">{z.name} {z.size}</span>{' '}
              {lots.some((l) => l.zone === z.id && lotSize(event, l.code) !== z.size) && <span className="text-muted">(บางล็อกขนาดพิเศษ)</span>}{' '}
              <span className="font-display font-semibold">{baht(eventPrice(event, z.id))}</span>
              <span className="text-muted">/ทั้งงาน</span>
            </li>
          ))}
        </ul>
      )}
      <LayoutGrid
        layout={event.layout}
        cols={event.cols}
        sizes={cellSizes(event.layout, event.zones, event.lotSizes)}
        mini={mini}
        renderLot={(code) => {
          const state = lotStateAll(event, code)
          const isSel = state === 'free' && !!selected?.includes(code)
          return (
            <button
              type="button"
              className="lot"
              data-s={isSel ? 'sel' : state}
              aria-disabled={state !== 'free'}
              aria-pressed={onSelect ? isSel : undefined}
              aria-label={`ล็อก ${code} ${STATE_LABEL[state]}`}
              title={`${code} ขนาด ${lotSize(event, code)} ${STATE_LABEL[state]}`}
              onClick={() => state === 'free' && onSelect?.(code)}
            >
              {mini ? null : code}
            </button>
          )
        }}
      />
    </div>
  )
}
