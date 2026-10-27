import { CANCEL_REASONS, REJECT_REASONS } from '../../data/options'
import { POLICY } from '../../data/settings'
import type { OrganizerBooking } from '../../types'
import ReasonDialog from './ReasonDialog'

interface BookingReasonDialogProps {
  /** reject = ไม่อนุมัติคำขอ, cancel = ยกเลิกการจองที่อนุมัติแล้ว */
  kind: 'reject' | 'cancel'
  booking: OrganizerBooking | null
  onClose: () => void
  onConfirm: (booking: OrganizerBooking, reason: string) => void
}

/** popup ใส่เหตุผลก่อนไม่อนุมัติหรือยกเลิกการจอง ผู้ขายจะเห็นเหตุผลนี้ */
export default function BookingReasonDialog({ kind, booking, onClose, onConfirm }: BookingReasonDialogProps) {
  const reject = kind === 'reject'
  return (
    <ReasonDialog
      open={!!booking}
      title={reject ? 'ไม่อนุมัติคำขอนี้' : 'ยกเลิกการจองนี้'}
      description={
        booking
          ? `${booking.shopName} ล็อก ${booking.lot} ${reject ? '' : 'จะถูกยกเลิกและล็อกกลับมาว่าง '}ผู้ขายจะเห็นเหตุผลนี้ และระบบคืนเงินให้ภายใน ${POLICY.refundBusinessDays} วันทำการ`
          : ''
      }
      reasons={reject ? REJECT_REASONS : CANCEL_REASONS}
      confirmLabel={reject ? 'ไม่อนุมัติ' : 'ยกเลิกการจอง'}
      onClose={onClose}
      onConfirm={(reason) => booking && onConfirm(booking, reason)}
    />
  )
}
