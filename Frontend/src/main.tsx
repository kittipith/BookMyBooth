import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.tsx'
import { queryClient } from './queries/queryClient'

// ข้อมูลจำลองและ session เดิมก่อนเชื่อม API (เฟส 8) ไม่ใช้แล้ว
for (const key of ['bookmybooth-data-v1', 'bookmybooth-session']) {
  try {
    localStorage.removeItem(key)
  } catch {
    // โหมดส่วนตัว/บล็อก storage ไม่เป็นไร
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
