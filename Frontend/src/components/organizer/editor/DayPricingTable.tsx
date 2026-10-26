import type { Zone } from '../../../types'
import { baht } from '../../../utils/format'
import { withSurcharge } from '../../../utils/pricing'
import NumberInput from '../../common/NumberInput'

export interface EditorDay {
  date: string
  label: string
  surcharge: number
}

interface DayPricingTableProps {
  days: EditorDay[]
  zones: Zone[]
  onChange: (date: string, surcharge: number) => void
}

export default function DayPricingTable({ days, zones, onChange }: DayPricingTableProps) {
  return (
    <section className="bg-surface border border-line rounded-2xl p-6">
      <h2 className="font-display text-xl font-semibold">ราคาตามวัน</h2>
      <p className="text-sm text-muted mt-1">ปรับราคาเป็นเปอร์เซ็นต์จากราคาฐาน เช่น วันเสาร์อาทิตย์ที่คนเดินเยอะกว่า</p>
      <div className="mt-5 relative overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="text-muted">
            <tr className="text-left">
              <th className="font-medium py-2 pr-3">วัน</th>
              <th className="font-medium py-2 pr-3">ปรับราคา</th>
              {zones.map((z) => (
                <th key={z.id} className="font-medium py-2 pr-3 text-right">
                  โซน {z.id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-t border-line">
            {days.map((d) => (
              <tr key={d.date}>
                <td className="py-2.5 pr-3 font-semibold whitespace-nowrap">{d.label}</td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-1.5">
                    <NumberInput
                      min={-90}
                      max={300}
                      className="fld py-2! w-20!"
                      value={d.surcharge}
                      onChange={(surcharge) => onChange(d.date, surcharge)}
                      aria-label={`ปรับราคา ${d.label}`}
                    />
                    <span className="text-muted">%</span>
                  </div>
                </td>
                {zones.map((z) => (
                  <td
                    key={z.id}
                    className={`py-2.5 pr-3 text-right font-display font-semibold ${d.surcharge ? 'text-cobalt' : ''}`}
                  >
                    {baht(withSurcharge(z.price, d.surcharge))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
