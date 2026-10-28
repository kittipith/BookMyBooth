import { api } from './client'
import type { BookingDto, BookingGroupDto, CreateBookingDto, ItemsDto, SlipUploadDto } from './dto'

const bookingPath = (bookingId: string) => `/bookings/${encodeURIComponent(bookingId)}`

/**
 * จองหลายล็อกแบบ all-or-nothing ได้ PENDING_PAYMENT ต้องแนบสลิปก่อน expiresAt
 * 409: LOT_NOT_AVAILABLE (details.lotIds), QUOTA_EXCEEDED, BOOKING_CLOSED
 */
export const createBooking = (body: CreateBookingDto) => api.post<BookingGroupDto>('/bookings', body)

/** การจองทั้งหมดของผู้ขาย (backend เปลี่ยนที่เลยเวลาเป็น EXPIRED ให้ก่อนตอบ) */
export const listMyBookings = (signal?: AbortSignal) => api.get<ItemsDto<BookingDto>>('/bookings/me', { signal })

/** ขอที่อัปโหลดสลิป (presigned POST อายุ 5 นาที ≤ 5 MB) ใช้ bookingId ใดก็ได้ในชุด */
export const getSlipUploadUrl = (bookingId: string, contentType: string) =>
  api.post<SlipUploadDto>(`${bookingPath(bookingId)}/slip-url`, { contentType })

/**
 * อัปโหลดตรงไป S3 (ไม่ผ่าน API) ใส่ทุกค่าใน fields ก่อน แล้ว file ท้ายสุด
 * S3 ตอบ 204 เมื่อสำเร็จ
 */
export async function uploadSlipFile(upload: SlipUploadDto, file: File) {
  const form = new FormData()
  Object.entries(upload.fields).forEach(([key, value]) => form.append(key, value))
  form.append('file', file)
  const response = await fetch(upload.url, { method: 'POST', body: form })
  if (!response.ok) throw new Error('อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่')
}

/** ผูกสลิปที่อัปโหลดแล้วกับทุกการจองในชุด → PENDING_REVIEW · 409 BOOKING_EXPIRED */
export const attachSlip = (bookingId: string, key: string) => api.post<BookingGroupDto>(`${bookingPath(bookingId)}/slip`, { key })

/** ลิงก์ดูสลิป (อายุ 5 นาที) */
export const getSlipUrl = (bookingId: string) => api.get<{ url: string }>(`${bookingPath(bookingId)}/slip`)

/** ผู้ขายยกเลิกได้ก่อนอนุมัติ ยกเลิกทั้งชุดของ bookingId นี้ (D7) */
export const cancelMyBooking = (bookingId: string) => api.post<BookingGroupDto>(`${bookingPath(bookingId)}/cancel`)
