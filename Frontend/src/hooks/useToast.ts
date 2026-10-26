import { useContext } from 'react'
import { ToastContext } from '../store/toastContext'

export function useToast() {
  return useContext(ToastContext)
}
