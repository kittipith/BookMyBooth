import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approveOrganizer, listAdminEvents, listUsers, rejectOrganizer, suspendUser, unsuspendUser } from '../api/admin'
import { eventFromDto } from '../api/mappers'
import { queryKeys } from './queryKeys'

/** ผู้ใช้ทุกบทบาท (ใช้ทั้งหน้าผู้ใช้ หน้าอนุมัติผู้จัดงาน และตัวเลขสรุป) */
export function useAdminUsers() {
  return useQuery({
    queryKey: queryKeys.admin.users,
    queryFn: async ({ signal }) => (await listUsers(undefined, signal)).items,
  })
}

/** ทุกงานรวมฉบับร่าง + จำนวนการจองที่ถือล็อกอยู่และยอดที่อนุมัติแล้ว */
export function useAdminEvents() {
  return useQuery({
    queryKey: queryKeys.admin.events,
    queryFn: async ({ signal }) =>
      (await listAdminEvents(signal)).items.map((dto) => ({ event: eventFromDto(dto), bookingCount: dto.bookingCount, revenue: dto.revenue })),
  })
}

function useRefreshUsers() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: queryKeys.admin.users })
}

export function useReviewOrganizer() {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: ({ userId, approve, reason }: { userId: string; approve: boolean; reason?: string }) =>
      approve ? approveOrganizer(userId) : rejectOrganizer(userId, reason ?? ''),
    onSettled: refresh,
  })
}

export function useSetSuspended() {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: ({ userId, suspended, reason }: { userId: string; suspended: boolean; reason?: string }) =>
      suspended ? suspendUser(userId, reason ?? '') : unsuspendUser(userId),
    onSettled: refresh,
  })
}
