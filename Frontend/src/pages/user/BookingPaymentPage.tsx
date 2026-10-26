import { useState, type ChangeEvent } from 'react'
import { Link, Navigate } from 'react-router'
import QrCode from '../../components/common/QrCode'
import BookingStepper from '../../components/user/BookingStepper'
import BookingSummary from '../../components/user/BookingSummary'
import { LIMITS } from '../../data/settings'
import { useAppStore, useEvent, useMyShop } from '../../hooks/useAppStore'
import { useToast } from '../../hooks/useToast'
import { baht, TODAY } from '../../utils/format'
import { checkoutTotal, lotStateOn } from '../../utils/pricing'

const MAX_SLIP_BYTES = LIMITS.maxSlipMB * 1024 * 1024

export default function BookingPaymentPage() {
  const { draft, submitBooking } = useAppStore()
  const { shop } = useMyShop()
  const event = useEvent(draft?.eventId)
  const toast = useToast()
  const [slip, setSlip] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [sentId, setSentId] = useState<string | null>(null)

  if (sentId) return <Navigate to={`/booking/sent/${sentId}`} replace />
  if (!draft || !event) return <Navigate to="/events" replace />
  if (!draft.shop) return <Navigate to="/booking/shop-info" replace />

  // จ่ายครั้งเดียวสำหรับทุกล็อกที่เลือก
  const amount = checkoutTotal(event, draft.lots, draft.days, draft.shop.power)

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('ใช้ได้เฉพาะไฟล์รูปภาพ JPG หรือ PNG')
      return
    }
    if (file.size > MAX_SLIP_BYTES) {
      setError(`ไฟล์ใหญ่เกิน ${LIMITS.maxSlipMB} MB ลองถ่ายหน้าจอสลิปใหม่`)
      return
    }
    setError('')
    setSlip(file.name)
  }

  const send = () => {
    if (!slip) {
      setError('แนบสลิปก่อนส่งคำขอ ผู้จัดงานใช้สลิปยืนยันการชำระเงิน')
      return
    }
    // ระหว่างกรอกข้อมูล อาจมีคนอื่นส่งคำขอล็อกเดียวกันไปก่อน
    const taken = draft.lots.filter((lot) => draft.days.some((d) => lotStateOn(event, d, lot) !== 'free'))
    if (taken.length) {
      toast(`ล็อก ${taken.join(', ')} ถูกจองไปแล้ว เลือกใหม่อีกครั้ง`, 'danger')
      return
    }
    const result = submitBooking(slip, shop.id)
    if (result.error) toast(result.error, 'danger')
    else if (result.id) setSentId(result.id)
  }

  return (
    <section className="max-w-6xl mx-auto px-5 py-10">
      <Link to="/booking/shop-info" className="text-sm text-muted hover:text-ink">
        กลับไปแก้ข้อมูลร้าน
      </Link>
      <BookingStepper step={2} />
      <div className="mt-8 grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        <div>
          <h1 className="font-display text-3xl font-bold">โอนเงินและแนบสลิป</h1>
          <p className="text-muted mt-1">สแกนด้วยแอปธนาคารใดก็ได้ ยอดเงินถูกใส่ไว้ให้แล้ว</p>
          <div className="mt-7 grid sm:grid-cols-[auto_1fr] gap-7 items-start">
            <div className="bg-white p-3 rounded-xl border border-line w-fit">
              <QrCode value={`${event.payment.bank}:${event.payment.accountNo}:${amount}:${TODAY}`} size={180} />
            </div>
            <div>
              <p className="text-sm text-muted">
                {event.payment.bank} {event.payment.accountName} {event.payment.accountNo}
              </p>
              <p className="font-display text-4xl font-bold mt-1">{baht(amount)}</p>
              <p className="text-sm text-muted mt-1">QR นี้ใช้ได้ถึง 23:59 น. วันนี้</p>
              <label className="mt-6 block border-[1.5px] border-dashed border-cobalt/40 rounded-xl p-5 hover:border-cobalt hover:bg-cobalt/5 cursor-pointer">
                <input type="file" accept="image/*" className="sr-only" onChange={onFile} />
                <span className="font-semibold block">{slip ? `แนบแล้ว: ${slip}` : 'แตะเพื่อแนบสลิปการโอน'}</span>
                <span className="text-sm text-muted">ไฟล์ JPG หรือ PNG ขนาดไม่เกิน {LIMITS.maxSlipMB} MB</span>
              </label>
              {error && <p className="text-sm text-danger mt-2">{error}</p>}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button type="button" onClick={send} className="bg-cobalt text-oncobalt rounded-xl px-7 py-3.5 font-semibold press">
                  ส่งคำขอจอง
                </button>
              </div>
            </div>
          </div>
        </div>
        <aside className="lg:sticky lg:top-24">
          <BookingSummary event={event} lots={draft.lots} days={draft.days} power={draft.shop.power} />
        </aside>
      </div>
    </section>
  )
}
