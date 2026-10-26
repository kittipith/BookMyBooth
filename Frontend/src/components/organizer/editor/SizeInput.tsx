import NumberInput from '../../common/NumberInput'
import { formatSize, parseSize } from '../../../utils/layout'

/** ขนาดล็อกเล็กสุด (เมตร) เท่ากับหนึ่งช่องบนผัง */
const MIN_METERS = 2

interface SizeInputProps {
  /** ขนาดรูปแบบ "2×3 ม." */
  value: string
  /** คืน false ถ้าใช้ขนาดนี้ไม่ได้ (เช่น ล็อกจะทับกัน) */
  onChange: (value: string) => boolean | void
  /** ใช้ประกอบ aria-label เช่น "ล็อกโซน A" */
  label: string
}

/** กรอกขนาดล็อกเป็นจำนวนเต็ม กว้าง × ลึก (เมตร) ลบแล้วพิมพ์ใหม่ได้อิสระ */
export default function SizeInput({ value, onChange, label }: SizeInputProps) {
  const { width, depth } = parseSize(value)
  return (
    <div className="flex items-center gap-1.5">
      <MeterField value={width} onCommit={(w) => onChange(formatSize(w, depth))} label={`ความกว้าง${label} (เมตร)`} />
      <span className="text-muted">×</span>
      <MeterField value={depth} onCommit={(d) => onChange(formatSize(width, d))} label={`ความลึก${label} (เมตร)`} />
      <span className="text-sm text-muted">ม.</span>
    </div>
  )
}

/** ขนาดเป็นจำนวนเต็มตั้งแต่ 2 เมตรขึ้นไป */
function MeterField({ value, onCommit, label }: { value: number; onCommit: (n: number) => void; label: string }) {
  return <NumberInput min={MIN_METERS} value={value} onChange={onCommit} className="fld py-2! w-16! text-center" aria-label={label} />
}
