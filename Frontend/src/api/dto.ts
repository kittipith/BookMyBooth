/**
 * รูปแบบ JSON ที่ backend ส่งมา (Backend/PLAN.md หัวข้อ 4 และ 6)
 * ชื่อฟิลด์และค่าสถานะตามที่ backend ใช้ (ตัวพิมพ์ใหญ่) หน้าจอใช้ผ่าน mappers.ts
 */

import type { EventType, PaymentAccount, Zone } from '../types'

// ---------- ผู้ใช้ ----------

export type RoleDto = 'SELLER' | 'ORGANIZER' | 'ADMIN'
export type AccountStatusDto = 'ACTIVE' | 'PENDING' | 'REJECTED' | 'SUSPENDED'

/** GET /me, PUT /me, รายการใน /admin/users และ /admin/organizers */
export interface UserDto {
  userId: string
  email: string
  role: RoleDto
  status: AccountStatusDto
  statusReason?: string
  statusChangedBy?: string
  displayName?: string
  phone?: string
  /** ผู้ขาย */
  shopName?: string
  category?: string
  line?: string
  bio?: string
  power?: string
  /** ผู้จัดงาน */
  orgName?: string
  payment?: PaymentAccount
  createdAt: string
  updatedAt: string
}

/** body ของ PUT /me ส่งเฉพาะที่แก้ (แต่ละ role แก้ได้ไม่เท่ากัน) */
export type UpdateMeDto = Partial<
  Pick<UserDto, 'displayName' | 'phone' | 'shopName' | 'category' | 'line' | 'bio' | 'power' | 'orgName' | 'payment'>
>

// ---------- งานและล็อก ----------

export type PublishStatusDto = 'DRAFT' | 'OPEN' | 'CLOSED'
/** คำนวณจากเวลาโดย backend */
export type EventStatusDto = PublishStatusDto | 'SCHEDULED' | 'ENDED'

/** ข้อมูลงานที่ผู้จัดงานกรอก (body ของ POST /events, PUT /events/{id} ส่งบางฟิลด์ได้) */
export interface EventInputDto {
  title: string
  round?: string | null
  type: EventType
  description: string
  venue: string
  hours: string
  /** YYYY-MM-DD */
  startDate: string
  endDate: string
  /** ISO-8601 ที่มี timezone */
  bookingOpensAt: string
  bookingClosesAt: string
  payment: PaymentAccount
  /** null = ไม่จำกัด */
  maxLotsPerSeller: number | null
  slipDeadlineMinutes: number
  zones: Zone[]
  cols?: number | null
  rows?: number | null
  layout?: string[] | null
  disabledCells?: number[]
  lotSizes?: Record<string, string>
}

/** GET /events/{id}, GET /organizer/events (มี payment และผังครบ) */
export interface EventDto extends EventInputDto {
  eventId: string
  organizerId: string
  organizerName: string
  publishStatus: PublishStatusDto
  status: EventStatusDto
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

/** GET /events (หน้ารายการ ไม่มีบัญชีรับเงินและผัง) */
export type EventListItemDto = Omit<EventDto, 'payment' | 'layout' | 'disabledCells' | 'lotSizes'>

/** GET /admin/events */
export interface AdminEventDto extends EventDto {
  /** การจองที่ยังถือล็อกอยู่ */
  bookingCount: number
  /** ยอดที่อนุมัติแล้ว (บาท) */
  revenue: number
}

export type LotStatusDto = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'DISABLED'

/** GET /events/{id}/lots */
export interface LotDto {
  lotId: string
  zoneId: string
  size: string
  price: number
  status: LotStatusDto
}

/** รายการใน PUT /events/{id}/lots */
export interface LotInputDto {
  lotId: string
  zoneId: string
  size?: string | null
  disabled?: boolean
}

/** GET /events/{id}/summary */
export interface EventSummaryDto {
  eventId: string
  status: EventStatusDto
  lots: { total: number } & Record<LotStatusDto, number>
  bookings: Partial<Record<BookingStatusDto, number>>
  revenue: number
}

// ---------- การจอง ----------

export type BookingStatusDto = 'PENDING_PAYMENT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'

export interface LotMoveDto {
  from: string
  to: string
  at: string
  by: string
}

/** 1 รายการ = 1 ล็อก การจองหลายล็อกพร้อมกันผูกด้วย groupId */
export interface BookingDto {
  bookingId: string
  groupId: string
  eventId: string
  eventTitle: string
  organizerId: string
  lotId: string
  sellerId: string
  shopName: string
  productDescription: string
  category: string
  staff: string
  power: boolean
  note: string
  status: BookingStatusDto
  /** ราคาโซน (บาท) */
  amount: number
  /** เส้นตายแนบสลิป */
  expiresAt: string
  slipKey?: string
  reason?: string
  moves: LotMoveDto[]
  checkedIn?: boolean
  checkedInAt?: string
  createdAt: string
  updatedAt: string
}

/** body ของ POST /bookings */
export interface CreateBookingDto {
  eventId: string
  lotIds: string[]
  shopName: string
  productDescription?: string
  category?: string
  staff?: string
  power?: boolean
  note?: string
}

/** POST /bookings, POST /bookings/{id}/slip */
export interface BookingGroupDto {
  groupId: string
  bookings: BookingDto[]
}

/** POST /bookings/{id}/slip-url — อัปโหลดด้วย FormData: ทุกค่าใน fields แล้ว file ท้ายสุด */
export interface SlipUploadDto {
  url: string
  fields: Record<string, string>
  key: string
}

/** GET /organizer/vendors */
export interface VendorStatDto {
  shop: Partial<UserDto> & { userId: string }
  approved: number
  total: number
  pastCount: number
  showRate: number | null
  flagged: boolean
}

// ---------- แจ้งเตือน ----------

export type NotificationTypeDto =
  | 'booking_new'
  | 'booking_slip_uploaded'
  | 'booking_cancelled'
  | 'booking_approved'
  | 'booking_moved'
  | 'booking_rejected'
  | 'booking_expired'
  | 'organizer_pending'
  | 'organizer_approved'
  | 'organizer_rejected'
  | 'account_suspended'
  | 'account_unsuspended'

export interface NotificationDto {
  id: string
  type: NotificationTypeDto
  message: string
  read: boolean
  createdAt: string
  link?: string
  bookingId?: string
  eventId?: string
}

/** GET /notifications */
export interface NotificationListDto {
  items: NotificationDto[]
  unreadCount: number
}

// ---------- ทั่วไป ----------

export interface ItemsDto<T> {
  items: T[]
}

/** รูปแบบ details ของ error ที่บอกล็อกที่มีปัญหา (LOT_NOT_AVAILABLE, LOT_IN_USE) */
export interface LotIdsDetails {
  lotIds: string[]
}
