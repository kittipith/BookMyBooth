import { useState, type FormEvent } from 'react'
import type { Zone } from '../../../types'
import SelectBox from '../../common/SelectBox'
import NumberInput from '../../common/NumberInput'

interface BulkLotFormProps {
  zones: Zone[]
  emptyCells: number
  onAdd: (zoneId: string, count: number) => void
}

/** สร้างหลายล็อกพร้อมกัน เช่น A01–A20 วางลงในช่องว่างของผังตามลำดับ */
export default function BulkLotForm({ zones, emptyCells, onAdd }: BulkLotFormProps) {
  const [zone, setZone] = useState(zones[0]?.id ?? '')
  const [count, setCount] = useState(10)
  const zoneId = zones.some((z) => z.id === zone) ? zone : zones[0]?.id

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (zoneId && count > 0) onAdd(zoneId, count)
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 flex flex-wrap items-end gap-3 bg-mist rounded-xl p-4">
      <div className="w-full">
        <p className="text-sm font-semibold">เพิ่มหลายล็อกพร้อมกัน</p>
        <p className="text-xs text-muted">วางต่อจากล็อกสุดท้ายของโซนนั้น รหัสเดิมไม่เลื่อน ถ้าช่องไม่พอให้ขยายผังด้านล่างหรือด้านขวา (เหลือช่องว่าง {emptyCells} ช่อง)</p>
      </div>
      <label>
        <span className="text-xs text-muted">โซน</span>
        <SelectBox
          value={zoneId ?? ''}
          onChange={setZone}
          options={zones.map((z) => ({ value: z.id, label: `โซน ${z.id} ${z.name}` }))}
          className="mt-1 py-2! w-auto min-w-44"
          aria-label="โซน"
        />
      </label>
      <label>
        <span className="text-xs text-muted">จำนวนล็อก</span>
        <NumberInput min={1} value={count} onChange={setCount} className="fld mt-1 py-2! w-24!" aria-label="จำนวนล็อก" />
      </label>
      <button disabled={!emptyCells} className="bg-cobalt text-oncobalt rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40">
        วางล็อก
      </button>
    </form>
  )
}
