import type { ReactNode } from 'react'
import type { CellType } from '../../types'
import { footprints, GATE, gridArea, isZoneCell, lotCodes, lotFit, STAGE, WALK } from '../../utils/layout'

interface LayoutGridProps {
  /** ตารางที่ผู้จัดงานวาดไว้ในตัววาดผัง */
  layout: CellType[]
  /** จำนวนคอลัมน์ของผัง */
  cols: number
  /** วาดล็อกหนึ่งช่อง */
  renderLot: (code: string, zone: string) => ReactNode
  /** ขนาดล็อกของแต่ละช่อง (จาก cellSizes) ล็อกใหญ่กว่า 2×2 ม. กินช่องข้างๆ ของตัวเองตามสัดส่วน */
  sizes?: (string | null)[]
  /** ขนาดเล็ก ไม่แสดงข้อความบนเวทีและทางเข้า */
  mini?: boolean
}

const LANDMARK_LABEL: Record<string, string> = { [STAGE]: 'เวที', [GATE]: 'ทางเข้า' }

/** ผังงานตามตำแหน่งจริงที่ผู้จัดงานวาด ตัดขอบว่างรอบนอกออก และรวมเวที/ทางเข้าที่ติดกันเป็นแถบเดียว */
export default function LayoutGrid({ layout, cols: gridCols, renderLot, sizes = [], mini = false }: LayoutGridProps) {
  const codes = lotCodes(layout)
  const { byIndex, covered } = footprints(layout, gridCols, sizes)
  const used = layout.map((cell, i) => (cell ? i : -1)).filter((i) => i >= 0)
  if (!used.length) return <p className="py-10 text-center text-sm text-muted">ผู้จัดงานยังไม่ได้วาดผัง</p>

  // ขอบเขตผังรวมพื้นที่ที่ล็อกใหญ่กินไปด้วย
  const rows = used.map((i) => Math.floor(i / gridCols))
  const cols = used.map((i) => i % gridCols)
  const rowEnds = used.map((i) => Math.floor(i / gridCols) + (byIndex.get(i)?.spanH ?? 1) - 1)
  const colEnds = used.map((i) => (i % gridCols) + (byIndex.get(i)?.spanW ?? 1) - 1)
  const [r0, r1, c0, c1] = [Math.min(...rows), Math.max(...rowEnds), Math.min(...cols), Math.max(...colEnds)]
  const area = (i: number, spanW = 1, spanH = 1) => gridArea(i, gridCols, spanW, spanH, r0, c0)

  const items: ReactNode[] = []
  for (let r = r0; r <= r1; r++) {
    let c = c0
    while (c <= c1) {
      const i = r * gridCols + c
      const cell = layout[i]
      if (cell === STAGE || cell === GATE) {
        let span = 1
        while (c + span <= c1 && layout[i + span] === cell) span++
        items.push(
          <div key={i} className={`lg-${cell}`} style={area(i, span)}>
            {!mini && LANDMARK_LABEL[cell]}
          </div>,
        )
        c += span
        continue
      }
      const fp = byIndex.get(i)
      if (isZoneCell(cell) && fp)
        items.push(
          <div key={i} className="lg-slot" style={area(i, fp.spanW, fp.spanH)}>
            <div className="lg-fit" style={lotFit(fp)}>
              {renderLot(codes[i]!, cell)}
            </div>
          </div>,
        )
      else if (cell === WALK && !covered.has(i)) items.push(<div key={i} className="lg-walk" style={area(i)} aria-hidden="true" />)
      c++
    }
  }

  const width = c1 - c0 + 1
  const height = r1 - r0 + 1
  // ช่องเท่ากันทุกช่อง ผังเต็มจำกัดความกว้างต่อช่อง ผังที่คอลัมน์น้อยจะไม่ยืดจนล็อกใหญ่เกิน
  return (
    <div
      className={`lgrid ${mini ? 'mini' : ''}`}
      style={{
        gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${height}, minmax(0, 1fr))`,
        aspectRatio: `${width} / ${height}`,
        maxWidth: mini ? undefined : width * 52,
      }}
    >
      {items}
    </div>
  )
}
