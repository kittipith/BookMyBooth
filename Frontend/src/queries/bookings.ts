import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { attachSlip, cancelMyBooking, createBooking, getSlipUploadUrl, listMyBookings, uploadSlipFile } from '../api/bookings'
import type { CreateBookingDto } from '../api/dto'
import { sellerBookingFromDto } from '../api/mappers'
import { useAuth } from '../hooks/useAuth'
import { queryKeys } from './queryKeys'

/** การจองของผู้ขายที่ล็อกอินอยู่ (บทบาทอื่นไม่โหลด) */
export function useMyBookings() {
  const { account } = useAuth()
  return useQuery({
    queryKey: queryKeys.myBookings,
    queryFn: async ({ signal }) => (await listMyBookings(signal)).items.map(sellerBookingFromDto),
    enabled: account?.role === 'seller',
  })
}

/** หลังจอง/แนบสลิป/ยกเลิก สถานะล็อกบนผังของงานนั้นเปลี่ยนด้วย */
function useRefresh() {
  const client = useQueryClient()
  return (eventId: string) =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.myBookings }),
      client.invalidateQueries({ queryKey: queryKeys.events.lots(eventId) }),
    ])
}

export function useCreateBooking() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (body: CreateBookingDto) => createBooking(body),
    onSettled: (_data, _error, body) => refresh(body.eventId),
    // หน้าแสดงข้อความเองตาม code (LOT_NOT_AVAILABLE ฯลฯ)
    meta: { silentError: true },
  })
}

/** ขอที่อัปโหลด → อัปโหลดตรงไป S3 → ผูกสลิปกับทั้งชุด (F19) */
export function useSendSlip() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: async ({ bookingId, file }: { bookingId: string; eventId: string; file: File }) => {
      const upload = await getSlipUploadUrl(bookingId, file.type)
      await uploadSlipFile(upload, file)
      return attachSlip(bookingId, upload.key)
    },
    onSettled: (_data, _error, { eventId }) => refresh(eventId),
    meta: { silentError: true },
  })
}

export function useCancelMyBooking() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ bookingId }: { bookingId: string; eventId: string }) => cancelMyBooking(bookingId),
    onSettled: (_data, _error, { eventId }) => refresh(eventId),
  })
}
