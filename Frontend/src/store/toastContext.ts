import { createContext } from 'react'

export type ToastTone = 'info' | 'danger'

export const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {})
