import type { ReactNode } from 'react'
import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-muted mt-1 leading-relaxed">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl hover:bg-mist">
          กลับ
        </button>
        <button type="button" onClick={onConfirm} className="bg-danger text-white rounded-xl px-5 py-2.5 font-semibold">
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
