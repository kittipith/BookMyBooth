import type { Booking } from '../types'
import { useAppStore } from './useAppStore'
import { useToast } from './useToast'

/** อนุมัติ ย้ายล็อก ไม่อนุมัติ และยกเลิกการจองของผู้จัดงาน พร้อมแจ้งผลให้เห็น */
export function useBookingDecisions() {
  const { approveBooking, rejectBooking, cancelBooking } = useAppStore()
  const toast = useToast()

  return {
    approve(b: Booking, moveTo?: string) {
      const result = approveBooking(b.id, moveTo)
      if (!result.ok) toast(result.error ?? 'อนุมัติไม่ได้', 'danger')
      else toast(moveTo ? `ย้าย ${b.shopName} จาก ${b.lot} ไป ${moveTo} และอนุมัติแล้ว` : `อนุมัติ ${b.shopName} ล็อก ${b.lot} แล้ว`)
      return result.ok
    },
    approveMany(list: Booking[]) {
      // ถ้าเลือกคำขอล็อกเดียวกันวันเดียวกันมาหลายรายการ อนุมัติได้แค่รายการแรก
      const claimed = new Set<string>()
      let done = 0
      list.forEach((b) => {
        const keys = b.days.map((d) => `${b.eventId}|${d}|${b.lot}`)
        if (keys.some((k) => claimed.has(k)) || !approveBooking(b.id).ok) return
        keys.forEach((k) => claimed.add(k))
        done++
      })
      toast(done === list.length ? `อนุมัติแล้ว ${done} รายการ` : `อนุมัติแล้ว ${done} จาก ${list.length} รายการ บางรายการขอล็อกซ้ำกันหรือล็อกไม่ว่าง`)
    },
    reject(b: Booking, reason: string) {
      rejectBooking(b.id, reason)
      toast(`ไม่อนุมัติ ${b.shopName} ล็อก ${b.lot} แล้ว ระบบแจ้งผู้ขายพร้อมเหตุผล`)
    },
    cancel(b: Booking, reason: string) {
      cancelBooking(b.id, reason, 'organizer')
      toast(`ยกเลิกการจอง ${b.id} แล้ว ล็อก ${b.lot} กลับมาว่าง`)
    },
  }
}
