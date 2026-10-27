import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NotificationListDto } from '../api/dto'
import { notificationFromDto } from '../api/mappers'
import { listNotifications, markNotificationsRead } from '../api/notifications'
import { POLL_SECONDS } from '../data/settings'
import { useAuth } from '../hooks/useAuth'
import { queryKeys } from './queryKeys'

/** แจ้งเตือนของผู้ใช้ที่ล็อกอินอยู่ poll ทุก POLL_SECONDS (F18) บัญชีที่รออนุมัติก็ได้รับ */
export function useNotifications() {
  const { account } = useAuth()
  return useQuery({
    // แยกตามผู้ใช้ ออกจากระบบแล้วเข้าบัญชีอื่นไม่เห็นของคนเดิม
    queryKey: [...queryKeys.notifications, account?.id ?? ''],
    queryFn: ({ signal }) => listNotifications(signal),
    enabled: !!account,
    refetchInterval: POLL_SECONDS * 1000,
    select: (data) => ({ items: data.items.map((item) => notificationFromDto(item, account!)), unreadCount: data.unreadCount }),
    // poll เบื้องหลัง เน็ตหลุดชั่วคราวไม่ต้องขึ้น toast ทุกรอบ
    meta: { silentError: true },
  })
}

/** ids = อ่านบางรายการ, ไม่ส่ง = อ่านทั้งหมด · ติ๊กว่าอ่านแล้วบนจอทันทีไม่ต้องรอ API */
export function useMarkNotificationsRead() {
  const client = useQueryClient()
  const { account } = useAuth()
  const key = [...queryKeys.notifications, account?.id ?? '']
  return useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead(ids ? { ids } : { all: true }),
    onMutate: (ids) => {
      client.setQueryData<NotificationListDto>(key, (data) => {
        if (!data) return data
        const items = data.items.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n))
        return { items, unreadCount: items.filter((n) => !n.read).length }
      })
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  })
}
