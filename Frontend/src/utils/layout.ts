import { GRID_LIMITS } from '../data/settings'
import type { CellType, Lot, MarketEvent, Zone } from '../types'

export const WALK = 'walk'
export const STAGE = 'stage'
export const GATE = 'gate'

/** ขนาดผังมาตรฐาน */
export const STANDARD_COLS = GRID_LIMITS.defaultCols
export const STANDARD_ROWS = GRID_LIMITS.defaultRows

export function emptyLayout(cols = STANDARD_COLS, rows = STANDARD_ROWS): CellType[] {
  return Array<CellType>(cols * rows).fill('')
}

/** ผังมาตรฐาน 16 × 10: เวทีด้านบน โซน A 12 ล็อก โซน B 24 ล็อก โซน C 6 ล็อก และทางเข้าด้านล่าง */
export function standardLayout(): CellType[] {
  const cols = STANDARD_COLS
  const cells = emptyLayout()
  const set = (row: number, from: number, to: number, value: CellType) => {
    for (let c = from; c <= to; c++) cells[row * cols + c] = value
  }
  const lotRow = (row: number, from: number, to: number, zone: string) => {
    set(row, 0, 0, WALK)
    set(row, from, to, zone)
    set(row, cols - 1, cols - 1, WALK)
  }
  set(0, 4, 11, STAGE)
  set(1, 0, cols - 1, WALK)
  lotRow(2, 2, 13, 'A')
  set(3, 0, cols - 1, WALK)
  lotRow(4, 2, 13, 'B')
  lotRow(5, 2, 13, 'B')
  set(6, 0, cols - 1, WALK)
  lotRow(7, 5, 10, 'C')
  set(8, 0, cols - 1, WALK)
  set(9, 6, 9, GATE)
  return cells
}

/** จำนวนช่องที่เพิ่ม (+) หรือลด (−) ในแต่ละด้านของผัง */
export interface GridEdges {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

/** ช่องเดิมย้ายไปอยู่ตำแหน่งไหนหลังปรับขนาดผัง (-1 = หลุดออกนอกผัง) */
export function remapIndex(i: number, cols: number, newCols: number, newRows: number, e: GridEdges) {
  const r = Math.floor(i / cols) + (e.top ?? 0)
  const c = (i % cols) + (e.left ?? 0)
  if (r < 0 || c < 0 || r >= newRows || c >= newCols) return -1
  return r * newCols + c
}

/** ปรับขนาดตารางใดๆ ตามขอบที่เพิ่ม/ลด ช่องใหม่ใส่ค่า fill */
export function resizeGrid<T>(grid: T[], cols: number, rows: number, e: GridEdges, fill: T) {
  const newCols = cols + (e.left ?? 0) + (e.right ?? 0)
  const newRows = rows + (e.top ?? 0) + (e.bottom ?? 0)
  const next = Array<T>(newCols * newRows).fill(fill)
  grid.forEach((cell, i) => {
    const j = remapIndex(i, cols, newCols, newRows, e)
    if (j >= 0) next[j] = cell
  })
  return { grid: next, cols: newCols, rows: newRows }
}

/** ปรับขนาดผังโดยเพิ่มหรือลดแถว/คอลัมน์ที่ขอบ ช่องที่วาดไว้แล้วอยู่ตำแหน่งเดิมเทียบกับกันเสมอ */
export function resizeLayout(layout: CellType[], cols: number, rows: number, e: GridEdges) {
  const { grid, ...size } = resizeGrid<CellType>(layout, cols, rows, e, '')
  return { layout: grid, ...size }
}

/**
 * รหัสล็อกเรียงตามตำแหน่ง จึงเลื่อนได้ถ้าวาดล็อกใหม่ไว้ก่อนล็อกเดิม
 * คืนรหัสล็อกที่มีการจองแต่ตำแหน่งเปลี่ยนหรือถูกลบไปหลังแก้ผัง
 * origins[i] = ช่อง i ของผังใหม่มาจากช่องไหนของผังเดิม (-1 = ช่องใหม่)
 */
export function movedBookedLots(oldLayout: CellType[], newLayout: CellType[], origins: number[], bookedCodes: string[]) {
  const oldCodes = lotCodes(oldLayout)
  const newCodes = lotCodes(newLayout)
  return bookedCodes.filter((code) => {
    const newIdx = newCodes.indexOf(code)
    return newIdx < 0 || origins[newIdx] !== oldCodes.indexOf(code)
  })
}

/** ช่องที่จะหลุดออกนอกผังถ้าลดขนาดตามที่ขอ */
export function cellsRemovedBy(layout: CellType[], cols: number, rows: number, e: GridEdges) {
  const newCols = cols + (e.left ?? 0) + (e.right ?? 0)
  const newRows = rows + (e.top ?? 0) + (e.bottom ?? 0)
  return layout.map((cell, i) => (cell && remapIndex(i, cols, newCols, newRows, e) < 0 ? cell : '')).filter(Boolean)
}

export function isZoneCell(cell: CellType | undefined): cell is string {
  return !!cell && cell !== WALK && cell !== STAGE && cell !== GATE
}

/** รหัสล็อกเรียงตามตำแหน่งบนตาราง แยกตามโซน */
export function lotCodes(layout: CellType[]): (string | null)[] {
  const counters: Record<string, number> = {}
  return layout.map((cell) => {
    if (!isZoneCell(cell)) return null
    counters[cell] = (counters[cell] ?? 0) + 1
    return `${cell}${String(counters[cell]).padStart(2, '0')}`
  })
}

export function lotsOf(layout: CellType[], zones: Zone[]): Lot[] {
  const codes = lotCodes(layout)
  const lots: Lot[] = []
  layout.forEach((cell, i) => {
    const code = codes[i]
    if (code) lots.push({ code, zone: cell })
  })
  const order = zones.map((z) => z.id)
  return lots.sort((a, b) => order.indexOf(a.zone) - order.indexOf(b.zone))
}

export function eventLots(event: Pick<MarketEvent, 'layout' | 'zones'>) {
  return lotsOf(event.layout, event.zones)
}

/** ขนาดของล็อก: ใช้ขนาดเฉพาะล็อกถ้าผู้จัดงานตั้งไว้ ไม่งั้นใช้ขนาดของโซน */
export function lotSize(event: Pick<MarketEvent, 'layout' | 'zones' | 'lotSizes'>, code: string) {
  const i = lotCodes(event.layout).indexOf(code)
  const zone = event.zones.find((z) => z.id === event.layout[i])
  return event.lotSizes[String(i)] ?? zone?.size ?? ''
}

/** ขนาดล็อกของทุกช่องบนผัง (ช่องที่ไม่ใช่ล็อกได้ null) */
export function cellSizes(layout: CellType[], zones: Zone[], lotSizes: Record<string, string>) {
  return layout.map((cell, i) => (isZoneCell(cell) ? (lotSizes[String(i)] ?? zones.find((z) => z.id === cell)?.size ?? null) : null))
}

/**
 * ล็อกกินพื้นที่กี่ช่อง เทียบบัญญัติไตรยางกับ GRID_LIMITS.cellMeters (2×2 ม. = 1 ช่อง)
 * w/h คือขนาดจริงเป็นช่อง (อาจมีเศษ) ส่วน spanW/spanH คือจำนวนช่องที่จองไว้ (ปัดขึ้น)
 */
export function lotSpan(size: string) {
  const { width, depth } = parseSize(size)
  const w = width / GRID_LIMITS.cellMeters
  const h = depth / GRID_LIMITS.cellMeters
  return { w, h, spanW: Math.max(1, Math.ceil(w - 1e-9)), spanH: Math.max(1, Math.ceil(h - 1e-9)) }
}

export interface Footprint {
  w: number
  h: number
  spanW: number
  spanH: number
  /** false = พื้นที่ไม่พอ (ทับล็อกอื่น สิ่งที่วาดไว้ หรือล้นผัง) แสดงย่อไว้ในช่องเดียว */
  fits: boolean
}

/**
 * พื้นที่ที่แต่ละล็อกกิน เริ่มจากช่องของล็อกไปทางขวาและลงล่าง ช่องอื่นบนผังไม่ขยับ
 * covered: ช่องที่ถูกล็อกกินอยู่ -> ช่องของล็อกนั้น
 */
export function footprints(layout: CellType[], cols: number, sizes: (string | null)[]) {
  const rows = layout.length / cols
  const byIndex = new Map<number, Footprint>()
  const covered = new Map<number, number>()
  layout.forEach((cell, i) => {
    const size = sizes[i]
    if (!isZoneCell(cell) || !size) return
    const span = lotSpan(size)
    const r = Math.floor(i / cols)
    const c = i % cols
    const cells: number[] = []
    let fits = r + span.spanH <= rows && c + span.spanW <= cols && !covered.has(i)
    for (let dr = 0; fits && dr < span.spanH; dr++) {
      for (let dc = 0; dc < span.spanW; dc++) {
        const j = (r + dr) * cols + c + dc
        if (j !== i && (layout[j] || covered.has(j))) fits = false
        cells.push(j)
      }
    }
    if (fits) cells.forEach((j) => covered.set(j, i))
    else covered.set(i, i)
    byIndex.set(i, fits ? { ...span, fits } : { ...span, spanW: 1, spanH: 1, fits })
  })
  return { byIndex, covered }
}

/** ล็อกที่พื้นที่ไม่พอ (ตำแหน่งช่อง) */
export function footprintConflicts(layout: CellType[], cols: number, sizes: (string | null)[]) {
  return [...footprints(layout, cols, sizes).byIndex].filter(([, f]) => !f.fits).map(([i]) => i)
}

/** ขนาดตัวล็อกเทียบกับพื้นที่ของมัน (เป็น %) ล็อกที่พื้นที่ไม่พอย่อให้อยู่ในช่องเดียวตามสัดส่วน */
export function lotFit(f: Footprint) {
  const k = f.fits ? 1 : 1 / Math.max(f.w, f.h, 1)
  return { width: `${Math.min(1, (f.w * k) / f.spanW) * 100}%`, height: `${Math.min(1, (f.h * k) / f.spanH) * 100}%` }
}

/** ตำแหน่งบนตารางของช่อง i (CSS grid เริ่มที่ 1) */
export function gridArea(i: number, cols: number, spanW = 1, spanH = 1, r0 = 0, c0 = 0) {
  return {
    gridRow: `${Math.floor(i / cols) - r0 + 1} / span ${spanH}`,
    gridColumn: `${(i % cols) - c0 + 1} / span ${spanW}`,
  }
}

/** จำนวนสีโซน (.zc-0 ถึง .zc-14 ใน App.css) เท่ากับจำนวนโซนสูงสุด */
const ZONE_COLORS = 15

export function zoneClass(zones: Zone[], zoneId: string) {
  const i = zones.findIndex((z) => z.id === zoneId)
  return `zc-${(i < 0 ? 0 : i) % ZONE_COLORS}`
}

const SIZE_PATTERN = /([\d.]+)\s*[×xX*]\s*([\d.]+)/

/** แยกข้อความขนาด "2×3 ม." เป็นกว้างและลึก (เมตร) */
export function parseSize(size: string) {
  const m = size.match(SIZE_PATTERN)
  return { width: m ? Number(m[1]) : 2, depth: m ? Number(m[2]) : 2 }
}

export function formatSize(width: number, depth: number) {
  return `${width}×${depth} ม.`
}
