import { useEffect } from 'react'
import { setErrorReporter } from '../../api/errorReporter'
import { useToast } from '../../hooks/useToast'

/** ให้ error จาก API ที่หน้าจอไม่ได้จัดการเองขึ้นเป็น toast (F3) วางไว้ใต้ ToastProvider */
export default function ApiErrorToaster() {
  const toast = useToast()
  useEffect(() => setErrorReporter((message) => toast(message, 'danger')), [toast])
  return null
}
