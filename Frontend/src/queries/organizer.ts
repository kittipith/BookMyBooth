import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { EventInputDto, EventSummaryDto, LotInputDto } from '../api/dto'
import { eventFromDto, organizerBookingFromDto, vendorFromDto } from '../api/mappers'
import {
  approveBooking,
  cancelBookingAsOrganizer,
  checkInBooking,
  closeEvent,
  createEvent,
  getEventSummary,
  listEventBookings,
  listMyEvents,
  listVendors,
  rejectBooking,
  syncLots,
  updateEvent,
} from '../api/organizer'
import { groupBookings } from '../services/bookings'
import type { OrganizerBooking, PublicEvent, Zone } from '../types'
import { queryKeys } from './queryKeys'

/** งานทั้งหมดของผู้จัดงาน (รวมฉบับร่าง) มีผังครบ ใช้ทั้งหน้ารายการและตัววาดผัง */
export function useMyEvents() {
  return useQuery({
    queryKey: queryKeys.organizerEvents,
    queryFn: async ({ signal }) => (await listMyEvents(signal)).items.map(eventFromDto),
  })
}

/** สรุปล็อกและยอดของหลายงานพร้อมกัน งานที่ยังโหลดไม่เสร็จไม่อยู่ในผลลัพธ์ */
export function useEventSummaries(eventIds: string[]): Record<string, EventSummaryDto> {
  return useQueries({
    queries: eventIds.map((id) => ({
      queryKey: queryKeys.events.summary(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getEventSummary(id, signal),
    })),
    combine: (results) =>
      Object.fromEntries(results.flatMap((r, i) => (r.data ? [[eventIds[i], r.data] as const] : []))) as Record<string, EventSummaryDto>,
  })
}

export interface SaveEventInput {
  /** ไม่มี = สร้างงานใหม่ */
  eventId?: string
  /** โซนที่บันทึกไว้ก่อนแก้ */
  previousZones: Zone[]
  input: EventInputDto
  lots: LotInputDto[]
  /** เผยแพร่ฉบับร่างหลังบันทึก */
  publish: boolean
}

/** error ระหว่างบันทึก ถ้าสร้างงานไปแล้วจะมี savedEventId (ฉบับร่าง) ให้แก้ต่อจากงานนั้นได้ ไม่สร้างซ้ำ */
export type SaveEventError = Error & { savedEventId?: string }

/**
 * บันทึกงาน: ข้อมูลงาน → ล็อกตามผัง (PUT /lots) → เผยแพร่
 * ต้องบันทึกล็อกก่อนเผยแพร่ (backend ตรวจ NO_LOTS จากตาราง Lots)
 * โซนที่ลบยังมีล็อกเดิมค้างในตารางจนกว่าจะ sync ล็อก (ZONE_IN_USE) จึงเก็บโซนเดิมไว้ก่อน แล้วค่อยลบในรอบสุดท้าย
 */
async function saveEvent({ eventId, previousZones, input, lots, publish }: SaveEventInput): Promise<PublicEvent> {
  let id = eventId
  const removed = previousZones.filter((z) => !input.zones.some((n) => n.id === z.id))
  try {
    let saved = id ? await updateEvent(id, removed.length ? { ...input, zones: [...input.zones, ...removed] } : input) : await createEvent(input)
    id = saved.eventId
    await syncLots(id, lots)
    if (removed.length || publish) {
      saved = await updateEvent(id, removed.length ? { ...input, ...(publish && { publishStatus: 'OPEN' }) } : { publishStatus: 'OPEN' })
    }
    return eventFromDto(saved)
  } catch (error) {
    if (id && error instanceof Error) (error as SaveEventError).savedEventId = id
    throw error
  }
}

function useInvalidateEvent() {
  const client = useQueryClient()
  return (eventId: string) =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.organizerEvents }),
      // งานสาธารณะ รายละเอียด ล็อก และสรุปของงานนี้ (key ขึ้นต้นด้วย ['events'])
      client.invalidateQueries({ queryKey: queryKeys.events.all }),
      client.invalidateQueries({ queryKey: queryKeys.events.detail(eventId) }),
    ])
}

export function useSaveEvent() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: saveEvent,
    onSettled: (event, error, variables) => {
      const id = event?.id ?? (error as SaveEventError | null)?.savedEventId ?? variables.eventId
      if (id) void invalidate(id)
    },
    // หน้าตัววาดผังแสดงข้อความเอง (ไฮไลต์ล็อกที่มีคนจอง ฯลฯ)
    meta: { silentError: true },
  })
}

export function useCloseEvent() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: (eventId: string) => closeEvent(eventId),
    onSuccess: (event) => invalidate(event.eventId),
  })
}

// ---------- ตรวจการจอง (F24–F28) ----------

/** งานที่มีการจองได้ (ฉบับร่างยังไม่มีใครจอง) */
export const bookableEventIds = (events: PublicEvent[]) => events.filter((e) => e.publishStatus !== 'draft').map((e) => e.id)

/**
 * การจองทุกงานของผู้จัดงาน (API ให้ทีละงาน) รวมเป็นชุดแล้ว (D7) ใหม่สุดก่อน
 * isPending = ยังโหลดงานหรือการจองไม่ครบ
 */
export function useOrganizerBookings() {
  const events = useMyEvents()
  const ids = bookableEventIds(events.data ?? [])
  const bookings = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.events.bookings(id),
      queryFn: async ({ signal }: { signal: AbortSignal }) => (await listEventBookings(id, undefined, signal)).items.map(organizerBookingFromDto),
    })),
    combine: (results) => ({
      data: groupBookings(results.flatMap((r) => r.data ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      isPending: results.some((r) => r.isPending),
    }),
  })
  return { events: events.data ?? [], bookings: bookings.data, isPending: events.isPending || bookings.isPending, isError: events.isError }
}

export function useVendors() {
  return useQuery({
    queryKey: queryKeys.vendors,
    queryFn: async ({ signal }) => (await listVendors(signal)).items.map(vendorFromDto),
  })
}

/** หลังตัดสินการจอง: รายการจอง สถานะล็อก สรุปงาน (key ขึ้นต้นด้วย ['events', id]) และสถิติร้าน */
function useRefreshBookings() {
  const client = useQueryClient()
  return (eventId: string) =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.events.detail(eventId) }),
      client.invalidateQueries({ queryKey: queryKeys.vendors }),
    ])
}

type BookingRef = Pick<OrganizerBooking, 'id' | 'eventId'>

export function useApproveBooking() {
  const refresh = useRefreshBookings()
  return useMutation({
    mutationFn: ({ booking, moves }: { booking: BookingRef; moves?: Record<string, string> }) => approveBooking(booking.id, moves),
    onSettled: (_data, _error, { booking }) => refresh(booking.eventId),
    // useBookingDecisions แจ้ง error เอง (อนุมัติหลายรายการสรุปครั้งเดียว)
    meta: { silentError: true },
  })
}

export function useRejectBooking() {
  const refresh = useRefreshBookings()
  return useMutation({
    mutationFn: ({ booking, reason }: { booking: BookingRef; reason: string }) => rejectBooking(booking.id, reason),
    onSettled: (_data, _error, { booking }) => refresh(booking.eventId),
    // useBookingDecisions แจ้ง error เอง (อนุมัติหลายรายการสรุปครั้งเดียว)
    meta: { silentError: true },
  })
}

export function useCancelBookingAsOrganizer() {
  const refresh = useRefreshBookings()
  return useMutation({
    mutationFn: ({ booking, reason }: { booking: BookingRef; reason: string }) => cancelBookingAsOrganizer(booking.id, reason),
    onSettled: (_data, _error, { booking }) => refresh(booking.eventId),
    // useBookingDecisions แจ้ง error เอง (อนุมัติหลายรายการสรุปครั้งเดียว)
    meta: { silentError: true },
  })
}

/** เช็กอินทั้งชุดด้วยรหัสการจอง (จาก QR ของผู้ขาย) ไม่ต้องรู้ eventId ล่วงหน้า · ผู้เรียกแสดง error เอง */
export function useCheckIn() {
  const refresh = useRefreshBookings()
  return useMutation({
    mutationFn: (bookingId: string) => checkInBooking(bookingId),
    onSuccess: (group) => refresh(group.bookings[0].eventId),
    meta: { silentError: true },
  })
}
