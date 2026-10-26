import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastTone } from '../../store/toastContext'

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-5 inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in rounded-xl px-5 py-3 text-sm font-semibold shadow-[0_12px_32px_-12px_rgb(16_28_64/.5)] ${
              t.tone === 'danger' ? 'bg-danger text-white' : 'bg-ink text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
