import { useEffect } from 'react'
import { useLocation } from 'react-router'

/** เลื่อนกลับขึ้นบนสุดทุกครั้งที่เปลี่ยนหน้า */
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
