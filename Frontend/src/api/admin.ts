import { api } from './client'
import type { AccountStatusDto, AdminEventDto, ItemsDto, RoleDto, UserDto } from './dto'

const userPath = (userId: string) => `/admin/users/${encodeURIComponent(userId)}`
const organizerPath = (userId: string) => `/admin/organizers/${encodeURIComponent(userId)}`

/** ผู้ใช้ทั้งหมด หรือเฉพาะบทบาท เรียงตามวันสมัคร (เก่าก่อน) */
export const listUsers = (role?: RoleDto, signal?: AbortSignal) => api.get<ItemsDto<UserDto>>('/admin/users', { query: { role }, signal })

/** ผู้สมัครผู้จัดงานตามสถานะ (ไม่ส่ง = PENDING) */
export const listOrganizers = (status?: AccountStatusDto, signal?: AbortSignal) =>
  api.get<ItemsDto<UserDto>>('/admin/organizers', { query: { status }, signal })

/** อนุมัติผู้จัดงานที่รออยู่ (PENDING) · 409 INVALID_STATUS */
export const approveOrganizer = (userId: string) => api.post<UserDto>(`${organizerPath(userId)}/approve`)

export const rejectOrganizer = (userId: string, reason: string) => api.post<UserDto>(`${organizerPath(userId)}/reject`, { reason })

/** ระงับบัญชี (ไม่ใช่ Admin) มีผลทันที · 409 CANNOT_SUSPEND_ADMIN, INVALID_STATUS */
export const suspendUser = (userId: string, reason: string) => api.post<UserDto>(`${userPath(userId)}/suspend`, { reason })

export const unsuspendUser = (userId: string) => api.post<UserDto>(`${userPath(userId)}/unsuspend`)

/** ทุกงานรวมฉบับร่าง ใหม่สุดก่อน พร้อม bookingCount และ revenue */
export const listAdminEvents = (signal?: AbortSignal) => api.get<ItemsDto<AdminEventDto>>('/admin/events', { signal })
