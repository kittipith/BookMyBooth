import { Fragment } from 'react'

const STEPS = ['ข้อมูลร้าน', 'ชำระเงิน', 'ส่งคำขอแล้ว']

export default function BookingStepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol className="mt-5 flex items-center gap-3 text-sm" aria-label="ขั้นตอนการจอง">
      {STEPS.map((label, i) => {
        const n = i + 1
        const current = n === step
        const done = n < step
        return (
          <Fragment key={label}>
            {i > 0 && <li aria-hidden="true" className="flex-1 max-w-16 h-px bg-line" />}
            <li className={`flex items-center gap-2 ${!current && !done ? 'text-muted' : ''}`} aria-current={current ? 'step' : undefined}>
              <span
                className={`w-7 h-7 grid place-items-center rounded-full font-display font-semibold text-sm ${
                  current ? 'bg-cobalt text-oncobalt' : done ? 'bg-cobalt/15 text-cobalt' : 'border border-line'
                }`}
              >
                {n}
              </span>
              <span className={`hidden sm:inline ${current ? 'font-semibold' : ''}`}>{label}</span>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
