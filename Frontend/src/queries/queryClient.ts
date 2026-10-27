import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { reportError } from '../api/errorReporter'

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError
    /** silentError: หน้าจอแสดง error เอง (เช่น ข้อความใต้ฟอร์ม) ไม่ต้องขึ้น toast */
    queryMeta: { silentError?: boolean }
    mutationMeta: { silentError?: boolean }
  }
}

/** ไม่ลองซ้ำเมื่อเป็น error ฝั่งผู้ใช้ (4xx) ลองซ้ำ 1 ครั้งเมื่อเน็ตหลุดหรือเซิร์ฟเวอร์ล่ม */
function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
  return failureCount < 1
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (!query.meta?.silentError) reportError(error)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!mutation.meta?.silentError) reportError(error)
    },
  }),
  defaultOptions: {
    queries: { staleTime: 30_000, retry: shouldRetry },
    mutations: { retry: false },
  },
})
