import type { Zone } from '../../../types'
import { GATE, STAGE, WALK, zoneClass } from '../../../utils/layout'

export const ERASE = 'erase'

interface EditorToolbarProps {
  zones: Zone[]
  tool: string
  onChange: (tool: string) => void
}

export default function EditorToolbar({ zones, tool, onChange }: EditorToolbarProps) {
  const tools = [
    ...zones.map((z) => ({ id: z.id, label: `โซน ${z.id}`, swatch: zoneClass(zones, z.id) })),
    { id: WALK, label: 'ทางเดิน', swatch: 't-walk' },
    { id: STAGE, label: 'เวที', swatch: 't-stage' },
    { id: GATE, label: 'ทางเข้า', swatch: 't-gate' },
    { id: ERASE, label: 'ยางลบ', swatch: 'border border-dashed border-muted' },
  ]
  return (
    <div className="mt-5 flex flex-wrap gap-2" role="toolbar" aria-label="เครื่องมือวาดผัง">
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={tool === t.id}
          onClick={() => onChange(t.id)}
          className="tool flex items-center gap-2 border border-line rounded-lg pl-2 pr-3 py-1.5 text-sm"
        >
          <span className={`w-4 h-4 rounded-[3px] ${t.swatch}`} />
          {t.label}
        </button>
      ))}
    </div>
  )
}
