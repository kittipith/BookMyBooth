import { api } from './client'
import type {
  BookingDto,
  BookingStatusDto,
  EventDto,
  EventInputDto,
  EventSummaryDto,
  ItemsDto,
  LotDto,
  LotInputDto,
  PublishStatusDto,
  VendorStatDto,
} from './dto'

const eventPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}`
const bookingPath = (bookingId: string) => `/bookings/${encodeURIComponent(bookingId)}`

/** งานของผู้จัดงานที่ล็อกอินอยู่ รวมฉบับร่าง พร้อมผังและบัญชีรับเงิน */
export const listMyEvents = (signal?: AbortSignal) => api.get<ItemsDto<EventDto>>('/organizer/events', { signal })

/** สร้างเป็นฉบับร่างเสมอ */
export const createEvent = (body: EventInputDto) => api.post<EventDto>('/events', body)

/** แก้บางฟิลด์ได้ · publishStatus: "OPEN" = เผยแพร่ฉบับร่าง (ต้องมีล็อกแล้ว ไม่งั้น 409 NO_LOTS) · งานที่ปิดแล้วแก้ไม่ได้ (409 EVENT_CLOSED) */
export const updateEvent = (eventId: string, body: Partial<EventInputDto> & { publishStatus?: Extract<PublishStatusDto, 'OPEN'> }) =>
  api.put<EventDto>(eventPath(eventId), body)

/** ปิดรับจอง (OPEN → CLOSED) ย้อนกลับไม่ได้ */
export const closeEvent = (eventId: string) => api.post<EventDto>(`${eventPath(eventId)}/close`)

/** ส่งล็อกทั้งหมดตามผัง backend สร้าง/แก้/ลบให้ตรง · ล็อกที่มีคนจองแก้/ลบไม่ได้ (409 LOT_IN_USE, details.lotIds) */
export const syncLots = (eventId: string, lots: LotInputDto[]) => api.put<ItemsDto<LotDto>>(`${eventPath(eventId)}/lots`, { lots })

/** จำนวนล็อกตามสถานะ จำนวนการจองตามสถานะ และยอดที่อนุมัติแล้ว (ใช้ได้กับงานฉบับร่างด้วย) */
export const getEventSummary = (eventId: string, signal?: AbortSignal) =>
  api.get<EventSummaryDto>(`${eventPath(eventId)}/summary`, { signal })

// ---------- ตรวจการจอง (F24–F28) ----------

/** การจองในงานของผู้จัดงาน ใหม่สุดก่อน (backend เปลี่ยนที่เลยเวลาแนบสลิปเป็น EXPIRED ให้ก่อนตอบ) */
export const listEventBookings = (eventId: string, status?: BookingStatusDto, signal?: AbortSignal) =>
  api.get<ItemsDto<BookingDto>>(`${eventPath(eventId)}/bookings`, { query: { status }, signal })

/**
 * อนุมัติการจองที่แนบสลิปแล้ว (PENDING_REVIEW) ส่ง newLotId เพื่อย้ายไปล็อกอื่นที่ว่างพร้อมอนุมัติ
 * 409: INVALID_STATUS, LOT_NOT_AVAILABLE (details.lotIds)
 */
export const approveBooking = (bookingId: string, newLotId?: string) =>
  api.post<BookingDto>(`${bookingPath(bookingId)}/approve`, newLotId ? { newLotId } : {})

/** ไม่อนุมัติ (PENDING_REVIEW) ล็อกกลับว่าง */
export const rejectBooking = (bookingId: string, reason: string) => api.post<BookingDto>(`${bookingPath(bookingId)}/reject`, { reason })

/** ยกเลิกหลังอนุมัติ ล็อกกลับว่าง */
export const cancelBookingAsOrganizer = (bookingId: string, reason: string) =>
  api.post<BookingDto>(`${bookingPath(bookingId)}/cancel`, { reason })

/** เช็กอินหน้างาน (เรียกซ้ำได้ผลเดิม) · 409 NOT_EVENT_DAY, INVALID_STATUS */
export const checkInBooking = (bookingId: string) => api.post<BookingDto>(`${bookingPath(bookingId)}/check-in`)

/** สถิติร้านที่เคยได้รับอนุมัติในงานของผู้จัดงานคนนี้ */
export const listVendors = (signal?: AbortSignal) => api.get<ItemsDto<VendorStatDto>>('/organizer/vendors', { signal })
