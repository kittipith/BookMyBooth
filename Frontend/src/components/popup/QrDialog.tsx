import type { Booking, MarketEvent } from '../../types'
import Modal from './Modal'
import QrCode from '../common/QrCode'

interface QrDialogProps {
  booking: Booking | null
  event: MarketEvent | undefined
  onClose: () => void
}

export default function QrDialog({ booking, event, onClose }: QrDialogProps) {
  return (
    <Modal open={!!booking && !!event} onClose={onClose} title="QR เช็กอินหน้างาน" className="w-[320px] text-center">
      {booking && event && (
        <>
          <p className="text-sm text-muted mt-1">{event.title}</p>
          <div className="mt-5 mx-auto bg-white p-3 rounded-lg w-fit border border-line">
            <QrCode value={`${booking.id}:${booking.lot}`} />
          </div>
          <p className="mt-4 font-display text-4xl font-bold">{booking.lot}</p>
          <p className="text-sm text-muted">ยื่นให้เจ้าหน้าที่สแกนที่จุดลงทะเบียน</p>
          <p className="text-xs text-muted mt-1">{booking.id}</p>
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
