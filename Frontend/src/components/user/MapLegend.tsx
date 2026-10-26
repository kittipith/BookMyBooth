import { MAP_LEGEND } from '../../data/content'

export default function MapLegend({ withSelected = false }: { withSelected?: boolean }) {
  return (
    <div className="flex gap-4 text-xs text-muted">
      {MAP_LEGEND.filter((i) => withSelected || i.state !== 'sel').map((i) => (
        <span key={i.state} className="flex items-center gap-1.5">
          <span className="lot swatch" data-s={i.state} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
