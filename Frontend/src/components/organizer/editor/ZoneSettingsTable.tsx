import { ZONE_LETTERS } from '../../../data/zones'
import type { Zone } from '../../../types'
import { baht } from '../../../utils/format'
import { zoneClass } from '../../../utils/layout'
import SizeInput from './SizeInput'
import NumberInput from '../../common/NumberInput'

interface ZoneSettingsTableProps {
  zones: Zone[]
  /** จำนวนวันที่จัดงาน (แสดงอย่างเดียว ราคาเป็นราคาต่อล็อกทั้งงาน) */
  dayCount: number
  counts: Record<string, number>
  /** จำนวนล็อกที่ปิดไม่ให้จองในแต่ละโซน */
  offCounts: Record<string, number>
  onChange: (id: string, patch: Partial<Zone>) => boolean | void
  onAdd: () => void
  onRemove: (id: string) => void
}

/** ผู้ขายจองทั้งงาน ราคาโซนคือราคาต่อล็อกตลอดงาน ไม่มีราคารายวัน (I2, F11) */
export default function ZoneSettingsTable({ zones, dayCount, counts, offCounts, onChange, onAdd, onRemove }: ZoneSettingsTableProps) {
  const bookable = (id: string) => (counts[id] ?? 0) - (offCounts[id] ?? 0)
  const grandTotal = zones.reduce((sum, z) => sum + z.price * bookable(z.id), 0)
  return (
    <>
      <h3 className="mt-8 font-semibold">ตั้งค่าโซน</h3>
      <div className="mt-3 relative overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-muted">
            <tr className="text-left">
              <th className="font-medium py-2 pr-3">โซน</th>
              <th className="font-medium py-2 pr-3">ชื่อโซน</th>
              <th className="font-medium py-2 pr-3">ขนาดล็อก กว้าง × ลึก</th>
              <th className="font-medium py-2 pr-3">ราคาต่อล็อก (ทั้งงาน {dayCount} วัน)</th>
              <th className="font-medium py-2 pr-3 text-right">จำนวนล็อก</th>
              <th className="font-medium py-2 text-right">รวมทั้งโซน</th>
              <th className="py-2 w-10">
                <span className="sr-only">ลบ</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-t border-line">
            {zones.map((z) => (
              <tr key={z.id}>
                <td className="py-2.5 pr-3">
                  <span className={`inline-grid place-items-center w-8 h-8 rounded-md font-display font-semibold ${zoneClass(zones, z.id)}`}>
                    {z.id}
                  </span>
                </td>
                <td className="py-2.5 pr-3">
                  <input className="fld py-2!" value={z.name} onChange={(e) => onChange(z.id, { name: e.target.value })} aria-label={`ชื่อโซน ${z.id}`} />
                </td>
                <td className="py-2.5 pr-3">
                  <SizeInput value={z.size} onChange={(size) => onChange(z.id, { size })} label={`ล็อกโซน ${z.id}`} />
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted">฿</span>
                    <NumberInput
                      className="fld py-2! w-28!"
                      value={z.price}
                      onChange={(price) => onChange(z.id, { price })}
                      aria-label={`ราคาโซน ${z.id}`}
                    />
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-right font-display text-lg font-semibold">
                  {counts[z.id] ?? 0}
                  {!!offCounts[z.id] && <span className="block font-body text-xs font-normal text-muted">ปิด {offCounts[z.id]}</span>}
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  <span className="font-display text-lg font-semibold" aria-label={`ราคาสุทธิโซน ${z.id}`}>
                    {baht(z.price * bookable(z.id))}
                  </span>
                  <span className="block text-xs text-muted">
                    ล็อกละ {baht(z.price)} × {bookable(z.id)} ล็อก
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  {!counts[z.id] && zones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemove(z.id)}
                      className="w-8 h-8 rounded-full hover:bg-mist hover:text-danger text-lg leading-none"
                      aria-label={`ลบโซน ${z.id}`}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line">
            <tr>
              <td colSpan={5} className="py-3 pr-3 text-right text-muted">
                รวมทุกโซน ถ้าขายหมด
              </td>
              <td className="py-3 text-right font-display text-xl font-bold">{baht(grandTotal)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-3 text-sm">
        {zones.length < ZONE_LETTERS.length && (
          <button type="button" onClick={onAdd} className="text-cobalt font-semibold hover:underline underline-offset-4">
            เพิ่มโซน
          </button>
        )}
        <span className="text-muted">
          {zones.length}/{ZONE_LETTERS.length} โซน
        </span>
      </div>
    </>
  )
}
