/**
 * แปลงค่าจาก backend (dto.ts) เป็น type ใน types.ts ที่หน้าจอใช้ (F4, F5)
 */

import { POWER_OPTIONS } from '../data/options'
import type {
  Account,
  AccountStatus,
  AppNotification,
  BookingUiStatus,
  EventStatus,
  LotState,
  LotStates,
  OrganizerBooking,
  PublicEvent,
  PublishStatus,
  Role,
  SellerBooking,
  VendorStat,
} from '../types'
import type {
  AccountStatusDto,
  BookingDto,
  BookingStatusDto,
  EventDto,
  EventListItemDto,
  EventStatusDto,
  LotDto,
  LotStatusDto,
  NotificationDto,
  PublishStatusDto,
  RoleDto,
  UserDto,
  VendorStatDto,
} from './dto'

export const roleFromDto = (role: RoleDto): Role => role.toLowerCase() as Role
export const roleToDto = (role: Role): RoleDto => role.toUpperCase() as RoleDto

export const accountStatusFromDto = (status: AccountStatusDto): AccountStatus => status.toLowerCase() as AccountStatus

export const publishStatusFromDto = (status: PublishStatusDto): PublishStatus => status.toLowerCase() as PublishStatus
export const publishStatusToDto = (status: PublishStatus): PublishStatusDto => status.toUpperCase() as PublishStatusDto

export const eventStatusFromDto = (status: EventStatusDto): EventStatus => status.toLowerCase() as EventStatus

const LOT_STATE: Record<LotStatusDto, LotState> = {
  AVAILABLE: 'free',
  HELD: 'pending',
  BOOKED: 'booked',
  DISABLED: 'disabled',
}

export const lotStateFromDto = (status: LotStatusDto): LotState => LOT_STATE[status]

export function lotStatesFromDto(lots: LotDto[]): LotStates {
  return Object.fromEntries(lots.map((lot) => [lot.lotId, lotStateFromDto(lot.status)]))
}

/** GET /events (ไม่มีผัง) หรือ GET /events/{id} (มีผังและบัญชีรับเงิน) → PublicEvent */
export function eventFromDto(dto: EventDto | EventListItemDto): PublicEvent {
  const detail = dto as Partial<EventDto>
  return {
    id: dto.eventId,
    type: dto.type,
    title: dto.title,
    round: dto.round ?? undefined,
    organizerId: dto.organizerId,
    organizer: dto.organizerName ?? '',
    venue: dto.venue,
    hours: dto.hours ?? '',
    description: dto.description ?? '',
    startDate: dto.startDate,
    endDate: dto.endDate,
    bookingOpensAt: dto.bookingOpensAt,
    bookingClosesAt: dto.bookingClosesAt,
    status: eventStatusFromDto(dto.status),
    publishStatus: publishStatusFromDto(dto.publishStatus),
    maxLotsPerSeller: dto.maxLotsPerSeller ?? null,
    slipDeadlineMinutes: dto.slipDeadlineMinutes,
    zones: dto.zones.map((z) => ({ ...z, amenities: z.amenities ?? [] })),
    cols: dto.cols ?? 0,
    rows: dto.rows ?? 0,
    layout: detail.layout ?? [],
    disabledCells: detail.disabledCells ?? [],
    lotSizes: detail.lotSizes ?? {},
    payment: detail.payment,
  }
}

export type { BookingUiStatus }

const BOOKING_STATUS: Record<BookingStatusDto, BookingUiStatus> = {
  PENDING_PAYMENT: 'awaiting_slip',
  PENDING_REVIEW: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
}

export const bookingStatusFromDto = (status: BookingStatusDto): BookingUiStatus => BOOKING_STATUS[status]

export const bookingStatusToDto = (status: BookingUiStatus): BookingStatusDto =>
  (Object.keys(BOOKING_STATUS) as BookingStatusDto[]).find((key) => BOOKING_STATUS[key] === status)!

export function sellerBookingFromDto(dto: BookingDto): SellerBooking {
  return {
    id: dto.bookingId,
    groupId: dto.groupId,
    eventId: dto.eventId,
    eventTitle: dto.eventTitle,
    lot: dto.lotId,
    status: bookingStatusFromDto(dto.status),
    amount: dto.amount,
    expiresAt: dto.expiresAt,
    hasSlip: !!dto.slipKey,
    shopName: dto.shopName,
    category: dto.category ?? '',
    staff: dto.staff ?? '',
    power: !!dto.power,
    note: dto.note ?? '',
    reason: dto.reason,
    moves: (dto.moves ?? []).map((m) => ({ from: m.from, to: m.to, at: m.at })),
    checkedIn: !!dto.checkedIn,
    createdAt: dto.createdAt,
  }
}

export function organizerBookingFromDto(dto: BookingDto): OrganizerBooking {
  return {
    ...sellerBookingFromDto(dto),
    sellerId: dto.sellerId,
    productDescription: dto.productDescription ?? '',
    checkedInAt: dto.checkedInAt,
  }
}

/** GET /organizer/vendors → VendorStat (โปรไฟล์ร้านที่ไม่มีให้เป็นค่าว่าง) */
export function vendorFromDto(dto: VendorStatDto): VendorStat {
  const { shop } = dto
  return {
    shop: {
      id: shop.userId,
      name: shop.shopName ?? '',
      category: shop.category ?? '',
      owner: shop.displayName ?? '',
      phone: shop.phone ?? '',
      line: shop.line ?? '',
      power: shop.power ?? POWER_OPTIONS[0],
      bio: shop.bio ?? '',
    },
    approved: dto.approved,
    total: dto.total,
    showRate: dto.showRate,
    pastCount: dto.pastCount,
    flagged: dto.flagged,
  }
}

/**
 * โปรไฟล์จาก GET /me → Account เดิม
 * id ของผู้ใช้ใช้ userId ตัวเดียว (F5) จึงตั้ง shopId / organizerId เป็นค่าเดียวกัน
 */
export function accountFromDto(user: UserDto): Account {
  const role = roleFromDto(user.role)
  return {
    id: user.userId,
    email: user.email,
    role,
    status: accountStatusFromDto(user.status),
    statusReason: user.statusReason,
    displayName: user.displayName,
    createdAt: user.createdAt,
  }
}

/**
 * ลิงก์ของแจ้งเตือน backend ใส่มาเฉพาะบางประเภท (organizer_approved, organizer_pending)
 * ที่เหลือหน้าเว็บสร้างจากประเภท บทบาท และ bookingId/eventId
 */
function notificationLink(item: NotificationDto, role: Role): string | undefined {
  if (item.link) return item.link
  if (role === 'seller') return item.bookingId || item.eventId ? '/my-bookings' : undefined
  if (role !== 'organizer') return undefined
  const params = new URLSearchParams()
  if (item.type === 'booking_slip_uploaded') params.set('tab', 'pending')
  else if (item.type === 'booking_new') params.set('tab', 'awaiting_slip')
  else params.set('tab', 'all')
  if (item.eventId) params.set('event', item.eventId)
  if (item.bookingId) params.set('id', item.bookingId)
  return item.bookingId || item.eventId ? `/organizer/bookings?${params}` : undefined
}

/** แจ้งเตือนจาก backend ไม่มี accountId (เป็นของผู้ใช้ที่ล็อกอินอยู่เสมอ) */
export function notificationFromDto(item: NotificationDto, account: Pick<Account, 'id' | 'role'>): AppNotification {
  return {
    id: item.id,
    accountId: account.id,
    type: item.type,
    message: item.message,
    link: notificationLink(item, account.role),
    createdAt: item.createdAt,
    read: item.read,
  }
}
