import { errorMessage, isApiError } from './client'

/**
 * ส่ง error ที่ไม่มีใครจัดการไปแสดงเป็น toast (F3)
 * QueryClient ถูกสร้างนอก React จึงต้องให้ ApiErrorToaster (อยู่ใต้ ToastProvider) มาลงทะเบียนตัวแสดงผล
 */

type Reporter = (message: string) => void

let reporter: Reporter = () => {}

export function setErrorReporter(next: Reporter) {
  reporter = next
  return () => {
    if (reporter === next) reporter = () => {}
  }
}

export function reportError(error: unknown) {
  // 401 ให้ client เปิดหน้าล็อกอินแทน ไม่ต้องแสดงซ้ำ
  if (isApiError(error) && error.status === 401) return
  reporter(errorMessage(error))
}
