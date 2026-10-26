import { useEffect, useRef, type PointerEvent } from 'react'
import type { CellType, Zone } from '../../../types'
import { cellSizes, footprints, GATE, gridArea, isZoneCell, lotCodes, lotFit, STAGE, WALK, zoneClass, type Footprint } from '../../../utils/layout'

interface MapCanvasProps {
  layout: CellType[]
  /** จำนวนคอลัมน์ของผัง */
  cols: number
  zones: Zone[]
  /** ตำแหน่งล็อกที่ปิดไม่ให้จอง */
  disabledCells: number[]
  /** ขนาดเฉพาะล็อก (ตำแหน่ง -> "กว้าง×ลึก ม.") ล็อกที่ไม่มีใช้ขนาดของโซน */
  lotSizes?: Record<string, string>
  /** ตำแหน่งล็อกที่ตั้งขนาดเฉพาะไว้ (มีจุดเล็กๆ มุมขวาบน) */
  sizedCells?: number[]
  onPaint: (index: number) => void
  /** เริ่มลากใหม่ */
  onStroke?: () => void
}

function cellClass(cell: CellType) {
  if (cell === WALK) return 't-walk'
  if (cell === STAGE) return 't-stage'
  if (cell === GATE) return 't-gate'
  if (isZoneCell(cell)) return 'is-lot'
  return ''
}

/** ตารางวาดผัง แตะหรือลากเพื่อระบายด้วยเครื่องมือที่เลือก (รองรับทั้งเมาส์และนิ้ว) */
export default function MapCanvas({ layout, cols, zones, disabledCells, lotSizes = {}, sizedCells = [], onPaint, onStroke }: MapCanvasProps) {
  const painting = useRef(false)
  const codes = lotCodes(layout)
  // ล็อก 2×2 ม. = 1 ช่อง ล็อกที่ใหญ่กว่ากินช่องข้างๆ ของตัวเอง ช่องอื่นไม่ขยับ
  const sizes = cellSizes(layout, zones, lotSizes)
  const { byIndex, covered } = footprints(layout, cols, sizes)
  const rows = layout.length / cols

  useEffect(() => {
    const stop = () => (painting.current = false)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [])

  const paintAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-i]')
    if (el) onPaint(Number(el.dataset.i))
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    painting.current = true
    onStroke?.()
    // บนจอสัมผัส เบราว์เซอร์จับ pointer ไว้ที่ช่องแรก ปล่อยเพื่อให้ลากข้ามช่องได้
    const target = e.target as Element
    if (target.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId)
    paintAt(e.clientX, e.clientY)
  }

  return (
    <div
      className="canvas"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        aspectRatio: `${cols} / ${rows}`,
        minWidth: cols * 36,
        maxWidth: `calc(${cols} * var(--cell-max) + ${cols - 1} * 3px)`,
      }}
      role="grid"
      aria-label={`ตารางผังงาน ${cols} คอลัมน์ ${rows} แถว`}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => painting.current && paintAt(e.clientX, e.clientY)}
    >
      {layout.map((cell, i) => {
        // ช่องที่ล็อกข้างๆ กินอยู่ ไม่ต้องวาด ล็อกนั้นวาดทับไว้แล้ว
        if (covered.has(i) && covered.get(i) !== i) return null
        const fp = byIndex.get(i)
        return (
          <div
            key={i}
            data-i={i}
            className={`cell ${cellClass(cell)} ${isZoneCell(cell) && disabledCells.includes(i) ? 'is-off' : ''} ${isZoneCell(cell) && sizedCells.includes(i) ? 'is-sized' : ''} ${fp && !fp.fits ? 'is-conflict' : ''}`}
            style={gridArea(i, cols, fp?.spanW, fp?.spanH)}
            role="gridcell"
          >
            {isZoneCell(cell) && fp ? (
              <LotShape code={codes[i]!} zoneCls={zoneClass(zones, cell)} size={sizes[i] ?? ''} fp={fp} />
            ) : cell === STAGE ? (
              'เวที'
            ) : cell === GATE ? (
              'เข้า'
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** ล็อกวาดตามขนาดจริงเทียบกับช่อง พร้อมรหัสและขนาด */
function LotShape({ code, zoneCls, size, fp }: { code: string; zoneCls: string; size: string; fp: Footprint }) {
  return (
    <span className={`lot-shape ${zoneCls}`} style={lotFit(fp)} title={fp.fits ? `${code} ${size}` : `${code} ${size} พื้นที่ไม่พอ ทับล็อกอื่นหรือล้นผัง`}>
      <span className="code">{code}</span>
      <span className="dim">{size.replace(/\s*ม\.$/, '')}</span>
    </span>
  )
}
