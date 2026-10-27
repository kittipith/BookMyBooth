import Modal from './Modal'
import QrCode from '../common/QrCode'

interface QrDialogProps {
  booking: { id: string; lot: string } | null
  eventTitle?: string
  onClose: () => void
}

/** QR เช็กอินหน้างาน ผู้จัดงานสแกนแล้วได้ bookingId ไปเรียก POST /bookings/{id}/check-in (F27) */
export default function QrDialog({ booking, eventTitle, onClose }: QrDialogProps) {
  return (
    <Modal open={!!booking} onClose={onClose} title="QR เช็กอินหน้างาน" className="w-[320px] text-center">
      {booking && (
        <>
          {eventTitle && <p className="text-sm text-muted mt-1">{eventTitle}</p>}
          <div className="mt-5 mx-auto bg-white p-3 rounded-lg w-fit border border-line">
            <QrCode value={booking.id} />
          </div>
          <p className="mt-4 font-display text-4xl font-bold">{booking.lot}</p>
          <p className="text-sm text-muted">ยื่นให้เจ้าหน้าที่สแกนที่จุดลงทะเบียน</p>
          <p className="text-xs text-muted mt-1 break-all">{booking.id}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full border-[1.5px] border-cobalt text-cobalt rounded-xl py-2.5 font-semibold hover:bg-cobalt/5"
          >
            ปิด
          </button>
        </>
      )}
    </Modal>
  )
}
