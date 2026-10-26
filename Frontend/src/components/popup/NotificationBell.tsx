import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { NOTIFICATION_ICON } from '../../data/options'
import { LIMITS } from '../../data/settings'
import { useAppStore } from '../../hooks/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import type { AppNotification } from '../../types'
import { dateTimeLabel } from '../../utils/format'

interface NotificationBellProps {
  /** เปิดรายการไปทางซ้ายหรือขวาของปุ่ม */
  align?: 'left' | 'right'
}

/** กระดิ่งแจ้งเตือนในเว็บ แสดงจำนวนที่ยังไม่อ่าน กดรายการเพื่ออ่านและไปยังหน้าที่เกี่ยวข้อง */
export default function NotificationBell({ align = 'right' }: NotificationBellProps) {
  const navigate = useNavigate()
  const { account } = useAuth()
  const { notifications, markNotificationsRead } = useAppStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!account) return null
  const mine = notifications
    .filter((n) => n.accountId === account.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const unread = mine.filter((n) => !n.read)

  const openItem = (n: AppNotification) => {
    if (!n.read) markNotificationsRead([n.id])
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`การแจ้งเตือน ยังไม่อ่าน ${unread.length} รายการ`}
        className="relative w-9 h-9 rounded-full grid place-items-center hover:bg-mist"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
        </svg>
        {unread.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-danger text-white text-[11px] font-semibold grid place-items-center">
            {unread.length > 99 ? '99+' : unread.length}
          </span>
        )}
      </button>
      {open && (
        // จอเล็กกว่า sm กระดิ่งอยู่กลางแถบบน กล่องกว้าง w-80 จะล้นจอ จึงตรึงไว้ใต้แถบบนเต็มความกว้างแทน
        <div
          role="dialog"
          aria-label="การแจ้งเตือน"
          className={`toast-in absolute top-full mt-2 z-40 w-80 max-w-[calc(100vw-2rem)] max-sm:fixed max-sm:top-14 max-sm:inset-x-4 max-sm:w-auto max-sm:max-w-none bg-surface border border-line rounded-2xl shadow-[0_24px_60px_-20px_rgb(16_28_64/.35)] overflow-hidden ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <p className="font-semibold">การแจ้งเตือน</p>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={() => markNotificationsRead(unread.map((n) => n.id))}
                className="text-sm text-cobalt font-semibold hover:underline underline-offset-4"
              >
                อ่านทั้งหมด
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-line">
            {mine.slice(0, LIMITS.bellItems).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-mist ${n.read ? '' : 'bg-cobalt/5'}`}
                >
                  <span aria-hidden="true">{NOTIFICATION_ICON[n.type]}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm leading-snug ${n.read ? 'text-muted' : 'font-semibold'}`}>{n.message}</span>
                    <span className="block text-xs text-muted mt-1">{dateTimeLabel(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-cobalt" aria-label="ยังไม่อ่าน" />}
                </button>
              </li>
            ))}
            {!mine.length && <li className="px-4 py-10 text-center text-sm text-muted">ยังไม่มีการแจ้งเตือน</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
