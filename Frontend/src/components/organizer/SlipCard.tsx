import type { Booking } from '../../types'
import { baht, dateTimeLabel } from '../../utils/format'

interface SlipCardProps {
  booking: Booking
  payer: string
  organizer: string
}

/** สลิปการโอนที่ผู้ขายแนบมา (จำลองหน้าตาสลิปธนาคาร) */
export default function SlipCard({ booking, payer, organizer }: SlipCardProps) {
  return (
    <div className="mx-auto w-56 bg-white text-[#0E1A3D] rounded-xl border border-line p-4 text-sm">
      <p className="font-semibold">โอนเงินสำเร็จ</p>
      <p className="text-xs text-[#5c6680]">{dateTimeLabel(booking.submittedAt)}</p>
      <div className="my-3 border-t border-dashed border-[#d9dde8]" />
      <p className="text-xs text-[#5c6680]">จาก</p>
      <p className="font-semibold">{payer}</p>
      <p className="text-xs text-[#5c6680] mt-2">ไปยัง</p>
      <p className="font-semibold">{organizer}</p>
      <p className="text-xs text-[#5c6680] mt-2">จำนวนเงิน</p>
      <p className="font-display text-2xl font-bold">{baht(booking.slipAmount)}</p>
      <p className="text-[10px] text-[#5c6680] mt-2 truncate">{booking.slipName}</p>
    </div>
  )
}
