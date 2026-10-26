import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

/** ตัวเลือกเป็นข้อความเดียว (ค่า = ข้อความที่แสดง) หรือแยกค่ากับข้อความ */
export type SelectOption = string | { value: string; label: string }
/** กลุ่มตัวเลือกมีหัวข้อ เช่น ล็อกแยกตามโซน */
export interface SelectOptionGroup {
  group: string
  options: SelectOption[]
}

interface SelectBoxProps {
  value: string
  onChange: (value: string) => void
  options: (SelectOption | SelectOptionGroup)[]
  /** ข้อความเมื่อยังไม่ได้เลือก (value เป็น '' และไม่มีตัวเลือกที่ค่าเป็น '') */
  placeholder?: string
  /** คลาสของกล่อง เช่น mt-2 w-auto */
  className?: string
  /** กล่องไม่มีกรอบ ใช้ในแถบค้นหาที่มีกรอบรวมอยู่แล้ว */
  bare?: boolean
  invalid?: boolean
  'aria-label'?: string
}

const toOption = (o: SelectOption) => (typeof o === 'string' ? { value: o, label: o } : o)
const isGroup = (o: SelectOption | SelectOptionGroup): o is SelectOptionGroup => typeof o === 'object' && 'group' in o

/** กล่องเลือกของ shadcn ใช้แทน <select> ทั้งเว็บ รายการเปิดลงด้านล่างกล่อง */
export default function SelectBox({ value, onChange, options, placeholder, className, bare, invalid, ...rest }: SelectBoxProps) {
  const flat = options.flatMap((o) => (isGroup(o) ? o.options : [o])).map(toOption)
  const labelOf = (v: string | null) => flat.find((o) => o.value === v)?.label
  const renderItem = (o: SelectOption) => {
    const { value: v, label } = toOption(o)
    return (
      <SelectItem key={v} value={v} className="py-2 text-[15px]">
        {label}
      </SelectItem>
    )
  }

  return (
    <Select value={value} onValueChange={(v) => onChange((v as string | null) ?? '')}>
      <SelectTrigger
        aria-label={rest['aria-label']}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full h-auto! text-[15px] shadow-none',
          bare
            ? 'border-0 bg-transparent p-0 focus-visible:ring-0'
            : 'rounded-lg border-line bg-surface px-3 py-2.5 data-popup-open:border-cobalt',
          className,
        )}
      >
        <SelectValue>{(v: string | null) => labelOf(v) ?? <span className="text-muted">{placeholder}</span>}</SelectValue>
      </SelectTrigger>
      {/* รายการเปิดใต้กล่องเสมอ ชิดซ้ายกับกล่อง ไม่ทับกล่อง (ที่ด้านล่างไม่พอจะเลื่อนดูในรายการแทนการเด้งขึ้นบน)
          กว้างอย่างน้อยเท่ากล่อง และขยายตามข้อความที่ยาวที่สุด ไม่ตัดคำ */}
      <SelectContent
        alignItemWithTrigger={false}
        align="start"
        collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }}
        className="w-auto min-w-(--anchor-width) max-w-[calc(100vw-2rem)] rounded-lg border border-line shadow-lg ring-0">
        {options.map((o, i) =>
          isGroup(o) ? (
            <SelectGroup key={`g-${o.group}-${i}`}>
              <SelectLabel>{o.group}</SelectLabel>
              {o.options.map(renderItem)}
            </SelectGroup>
          ) : (
            renderItem(o)
          ),
        )}
      </SelectContent>
    </Select>
  )
}
