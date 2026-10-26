import { useState } from 'react'

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  /** ต่ำสุด (ติดลบได้ เช่น ลดราคา %) */
  min?: number
  max?: number
  className?: string
  'aria-label'?: string
}

/**
 * ช่องกรอกจำนวนเต็มที่ลบแล้วพิมพ์ใหม่ได้อิสระ
 * ระหว่างพิมพ์เก็บข้อความไว้เอง ใช้ค่าเมื่ออยู่ในช่วง min–max ออกจากช่องแล้วแสดงค่าที่ใช้จริง
 */
export default function NumberInput({ value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, className, ...rest }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft ?? String(value)}
      onChange={(e) => {
        // รับเฉพาะตัวเลข และเครื่องหมายลบข้างหน้าเมื่อค่าติดลบได้
        const raw = e.target.value
        const text = (min < 0 && raw.trim().startsWith('-') ? '-' : '') + raw.replace(/\D/g, '')
        setDraft(text)
        const n = Number(text)
        if (text && text !== '-' && n >= min && n <= max && n !== value) onChange(n)
      }}
      onBlur={() => setDraft(null)}
      onFocus={(e) => e.target.select()}
      className={className}
      aria-label={rest['aria-label']}
    />
  )
}
