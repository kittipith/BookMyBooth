import { useEffect, useId, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  className?: string
}

/** กล่องโต้ตอบกลางจอ ปิดได้ด้วยปุ่ม Esc หรือแตะพื้นหลัง */
export default function Modal({ open, onClose, title, children, className = 'w-[420px]' }: ModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 grid grid-cols-1 place-items-center p-4 bg-[rgb(16_28_64/.45)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`toast-in bg-surface text-ink rounded-2xl border border-line shadow-[0_24px_60px_-20px_rgb(16_28_64/.35)] p-6 max-w-full ${className}`}
      >
        {title && (
          <h2 id={titleId} className="font-display text-xl font-semibold">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}
