import { api } from './client'
import type { NotificationListDto } from './dto'

/** ใหม่สุดก่อน 50 รายการ + จำนวนที่ยังไม่อ่านทั้งหมด (บัญชีที่ยังไม่ active ก็เรียกได้) */
export const listNotifications = (signal?: AbortSignal) => api.get<NotificationListDto>('/notifications', { signal })

/** อ่านบางรายการ หรือ all: true อ่านทั้งหมด */
export const markNotificationsRead = (body: { ids: string[] } | { all: true }) =>
  api.post<{ updated: number; unreadCount: number }>('/notifications/read', body)
