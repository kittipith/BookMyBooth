import { errorMessage } from '../api/client'
import { useApproveBooking, useCancelBookingAsOrganizer, useRejectBooking } from '../queries/organizer'
import type { OrganizerBooking } from '../types'
import { useToast } from './useToast'

/** อนุมัติ ย้ายล็อก ไม่อนุมัติ และยกเลิกการจองของผู้จัดงาน พร้อมแจ้งผลหรือ error ให้เห็น */
export function useBookingDecisions() {
  const approveMutation = useApproveBooking()
  const rejectMutation = useRejectBooking()
  const cancelMutation = useCancelBookingAsOrganizer()
  const toast = useToast()

  return {
    busy: approveMutation.isPending || rejectMutation.isPending || cancelMutation.isPending,
    async approve(b: OrganizerBooking, moveTo?: string) {
      try {
        await approveMutation.mutateAsync({ booking: b, moveTo })
      } catch (e) {
        toast(errorMessage(e), 'danger')
        return false
      }
      toast(moveTo ? `ย้าย ${b.shopName} จาก ${b.lot} ไป ${moveTo} และอนุมัติแล้ว` : `อนุมัติ ${b.shopName} ล็อก ${b.lot} แล้ว`)
      return true
    },
    /** ทีละรายการ รายการที่สถานะเปลี่ยนไปแล้วข้ามไป แล้วสรุปผลครั้งเดียว */
    async approveMany(list: OrganizerBooking[]) {
      let done = 0
      let lastError: unknown
      for (const b of list) {
        try {
          await approveMutation.mutateAsync({ booking: b })
          done++
        } catch (e) {
          lastError = e
        }
      }
      if (done === list.length) toast(`อนุมัติแล้ว ${done} รายการ`)
      else toast(`อนุมัติแล้ว ${done} จาก ${list.length} รายการ (${errorMessage(lastError)})`, 'danger')
    },
    async reject(b: OrganizerBooking, reason: string) {
      try {
        await rejectMutation.mutateAsync({ booking: b, reason })
      } catch (e) {
        toast(errorMessage(e), 'danger')
        return false
      }
      toast(`ไม่อนุมัติ ${b.shopName} ล็อก ${b.lot} แล้ว ระบบแจ้งผู้ขายพร้อมเหตุผล`)
      return true
    },
    async cancel(b: OrganizerBooking, reason: string) {
      try {
        await cancelMutation.mutateAsync({ booking: b, reason })
      } catch (e) {
        toast(errorMessage(e), 'danger')
        return false
      }
      toast(`ยกเลิกการจองของ ${b.shopName} แล้ว ล็อก ${b.lot} กลับมาว่าง`)
      return true
    },
  }
}
