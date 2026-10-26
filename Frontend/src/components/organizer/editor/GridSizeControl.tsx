import { useState, type FormEvent, type ReactNode } from 'react'
import { GRID_LIMITS } from '../../../data/settings'
import type { GridEdges } from '../../../utils/layout'

interface GridSizeControlProps {
  cols: number
  rows: number
  /** คืน false ถ้าปรับไม่ได้ (เช่น ย่อแล้วจะตัดล็อกทิ้ง) */
  onResize: (edges: GridEdges) => boolean
  /** ปุ่มจัดการผังที่แสดงทางขวาของช่องกรอกขนาด เช่น ใช้ผังมาตรฐาน ล้างผัง */
  children?: ReactNode
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)))

/** กำหนดขนาดผังด้วยการพิมพ์กว้าง × ยาว ช่องที่เพิ่มหรือลดอยู่ด้านขวาและด้านล่าง ของที่วาดไว้แล้วไม่ขยับ */
export default function GridSizeControl(props: GridSizeControlProps) {
  // key ทำให้ช่องกรอกรีเซ็ตเป็นค่าจริงทุกครั้งที่ขนาดผังเปลี่ยน
  return <SizeForm key={`${props.cols}x${props.rows}`} {...props} />
}

function SizeForm({ cols, rows, onResize, children }: GridSizeControlProps) {
  const L = GRID_LIMITS
  const [width, setWidth] = useState(String(cols))
  const [length, setLength] = useState(String(rows))
  const nextCols = clamp(Number(width) || cols, L.minCols, L.maxCols)
  const nextRows = clamp(Number(length) || rows, L.minRows, L.maxRows)
  const changed = nextCols !== cols || nextRows !== rows

  /** ขนาดที่พิมพ์เพิ่ม/ลดที่ด้านขวาและด้านล่าง */
  const apply = (e?: FormEvent) => {
    e?.preventDefault()
    if (!changed) {
      setWidth(String(cols))
      setLength(String(rows))
      return
    }
    if (!onResize({ right: nextCols - cols, bottom: nextRows - rows })) {
      setWidth(String(cols))
      setLength(String(rows))
    }
  }

  const field = (label: string, unit: string, value: string, set: (v: string) => void, min: number, max: number) => (
    <label className="block">
      <span className="text-sm text-muted">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => set(e.target.value)}
          aria-label={`${label} (ช่อง)`}
          className="fld py-2! w-20! text-center font-display text-lg"
        />
        <span className="text-sm text-muted">{unit}</span>
      </div>
    </label>
  )

  return (
    <div className="mt-5 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          ขนาดผัง <span className="font-display text-lg">{cols} × {rows}</span> ช่อง
        </p>
        <p className="text-xs text-muted">
          หนึ่งช่องเท่ากับ {L.cellMeters}×{L.cellMeters} ม. กว้าง {L.minCols}–{L.maxCols} ยาว {L.minRows}–{L.maxRows} ช่อง
        </p>
      </div>

      <form
        noValidate
        onSubmit={apply}
        // ใช้ขนาดเมื่อออกจากกล่องกรอกทั้งคู่ ไม่ใช่ตอนสลับระหว่างกว้างกับยาว
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) apply()
        }}
        className="mt-3 flex flex-wrap items-end gap-2">
        {field('ความกว้าง', 'คอลัมน์', width, setWidth, L.minCols, L.maxCols)}
        <span className="pb-2.5 text-lg text-muted">×</span>
        {field('ความยาว', 'แถว', length, setLength, L.minRows, L.maxRows)}
        <button
          disabled={!changed}
          className="bg-cobalt text-oncobalt rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          ใช้ขนาดนี้
        </button>
        {children && <div className="sm:ml-auto flex flex-wrap gap-2">{children}</div>}
      </form>
      <p className="mt-2 text-xs text-muted">พิมพ์ตัวเลขแล้วกด Enter ช่องที่เพิ่มหรือลดจะอยู่ด้านขวาและด้านล่าง</p>
    </div>
  )
}
