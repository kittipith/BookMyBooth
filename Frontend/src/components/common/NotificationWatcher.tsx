import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys } from '../../queries/queryKeys'
import { useNotifications } from '../../queries/notifications'
import type { NotificationType } from '../../types'

/** แจ้งเตือนที่แปลว่าสถานะบัญชีเปลี่ยน ต้องโหลด /me ใหม่ (AuthProvider ขอ token ใหม่ให้เมื่อสถานะเปลี่ยน — F7) */
const ACCOUNT_CHANGES: NotificationType[] = ['organizer_approved', 'organizer_rejected', 'account_unsuspended']

/**
 * poll แจ้งเตือนตลอดที่ล็อกอินอยู่ (รวมหน้ารออนุมัติที่ไม่มีกระดิ่ง)
 * ได้แจ้งเตือนใหม่ที่เปลี่ยนสถานะบัญชี → โหลด /me ใหม่ ผู้จัดงานที่ได้รับอนุมัติเข้าเมนูได้ภายในรอบ poll
 */
export default function NotificationWatcher() {
  const client = useQueryClient()
  const { account } = useAuth()
  const { data } = useNotifications()
  const seen = useRef<Set<string> | null>(null)
  const owner = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (owner.current !== account?.id) {
      owner.current = account?.id
      seen.current = null
    }
    if (!data) return
    const first = seen.current === null
    const known = seen.current ?? new Set<string>()
    const fresh = data.items.filter((n) => !known.has(n.id))
    fresh.forEach((n) => known.add(n.id))
    seen.current = known
    // รอบแรกหลังล็อกอินเป็นของเก่า /me ที่เพิ่งโหลดมีสถานะล่าสุดอยู่แล้ว
    if (!first && fresh.some((n) => !n.read && ACCOUNT_CHANGES.includes(n.type))) {
      void client.invalidateQueries({ queryKey: queryKeys.me })
    }
  }, [data, client, account?.id])

  return null
}
