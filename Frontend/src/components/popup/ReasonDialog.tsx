import { useState, type FormEvent } from 'react'
import Modal from './Modal'

interface ReasonDialogProps {
  open: boolean
  title: string
  description: string
  /** เหตุผลสำเร็จรูปให้แตะเลือก */
  reasons: string[]
  /** เหตุผลที่เลือกไว้ให้ก่อน */
  initialReason?: string
  confirmLabel: string
  onClose: () => void
  onConfirm: (reason: string) => void
}

/** popup ขอเหตุผล ใช้กับไม่อนุมัติ/ยกเลิกการจอง ไม่อนุมัติผู้จัดงาน และระงับบัญชี */
export default function ReasonDialog({ open, title, ...rest }: ReasonDialogProps) {
  return (
    <Modal open={open} onClose={rest.onClose} title={title}>
      {/* แสดงฟอร์มใหม่ทุกครั้งที่เปิด */}
      {open && <ReasonForm {...rest} />}
    </Modal>
  )
}

function ReasonForm({ description, reasons, initialReason = '', confirmLabel, onClose, onConfirm }: Omit<ReasonDialogProps, 'open' | 'title'>) {
  const [text, setText] = useState(initialReason)
  const [error, setError] = useState(false)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) {
      setError(true)
      return
    }
    onConfirm(text.trim())
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="text-sm text-muted mt-1">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {reasons.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setText(r)
              setError(false)
            }}
            className={`border rounded-full px-3 py-1.5 text-sm ${text === r ? 'border-ink bg-mist' : 'border-line hover:border-ink'}`}
          >
            {r}
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setError(false)
        }}
        className="fld mt-3"
        placeholder="เขียนเหตุผลให้อีกฝ่ายเข้าใจว่าต้องทำอะไรต่อ"
        autoFocus
      />
      {error && <p className="text-sm text-danger mt-2">ใส่เหตุผลก่อน</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl hover:bg-mist">
          กลับ
        </button>
        <button className="bg-danger text-white rounded-xl px-5 py-2.5 font-semibold">{confirmLabel}</button>
      </div>
    </form>
  )
}
