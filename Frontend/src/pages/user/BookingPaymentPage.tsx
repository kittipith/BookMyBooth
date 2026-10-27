import { useEffect, useState, type ChangeEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import QrCode from '../../components/common/QrCode'
import BookingStepper from '../../components/user/BookingStepper'
import BookingSummary from '../../components/user/BookingSummary'
import { LIMITS } from '../../data/settings'
import { useToast } from '../../hooks/useToast'
import { useMyBookings, useSendSlip } from '../../queries/bookings'
import { useEventDetail } from '../../queries/events'
import { countdownLabel, groupOf, secondsLeft } from '../../services/bookings'
import type { PublicEvent, SellerBooking } from '../../types'
import { baht } from '../../utils/format'

const MAX_SLIP_BYTES = LIMITS.maxSlipMB * 1024 * 1024
/** ชนิดไฟล์ที่ backend รับ (SlipUrlInput) */
const SLIP_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

export default function BookingPaymentPage() {
  const { groupId = '' } = useParams()
  const bookings = useMyBookings()
  const group = groupOf(bookings.data ?? [], groupId)
  const event = useEventDetail(group[0]?.eventId)

  if (bookings.isPending || (group.length && event.isPending)) return <p className="py-20 text-center text-muted">กำลังโหลด…</p>
  if (!group.length || !event.data) return <Navigate to="/my-bookings" replace />
  // แนบสลิปแล้ว / หมดเวลา / ยกเลิก ไม่ต้องจ่ายอีก
  if (group[0].status !== 'awaiting_slip') return <Navigate to={`/booking/sent/${groupId}`} replace />
  return <Payment group={group} event={event.data} />
}

function Payment({ group, event }: { group: SellerBooking[]; event: PublicEvent }) {
  const navigate = useNavigate()
  const toast = useToast()
  const send = useSendSlip()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const amount = group.reduce((sum, b) => sum + b.amount, 0)
  const left = secondsLeft(group[0].expiresAt, now)
  const expired = left === 0
  const payment = event.payment

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked) return
    if (!SLIP_TYPES.includes(picked.type)) {
      setError('ใช้ได้เฉพาะไฟล์ JPG, PNG หรือ PDF')
      return
    }
    if (picked.size > MAX_SLIP_BYTES) {
      setError(`ไฟล์ใหญ่เกิน ${LIMITS.maxSlipMB} MB ลองถ่ายหน้าจอสลิปใหม่`)
      return
    }
    setError('')
    setFile(picked)
  }

  const submit = () => {
    if (!file) {
      setError('แนบสลิปก่อนส่งคำขอ ผู้จัดงานใช้สลิปยืนยันการชำระเงิน')
      return
    }
    send.mutate(
      { bookingId: group[0].id, eventId: event.id, file },
      {
        onSuccess: () => navigate(`/booking/sent/${group[0].groupId}`, { replace: true }),
        onError: (err) => {
          // err อาจเป็น Error ธรรมดาจากการอัปโหลดไป S3 (ไม่มี code)
          if (err.code === 'BOOKING_EXPIRED') {
            toast('หมดเวลาแนบสลิปแล้ว ล็อกถูกปล่อยให้คนอื่นจอง กรุณาจองใหม่', 'danger')
            navigate(`/events/${event.id}`, { replace: true })
            return
          }
          setError(err.message)
        },
      },
    )
  }

  return (
    <section className="max-w-6xl mx-auto px-5 py-10">
      <Link to="/my-bookings" className="text-sm text-muted hover:text-ink">
        ไปที่การจองของฉัน
      </Link>
      <BookingStepper step={2} />
      <div className="mt-8 grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        <div>
          <h1 className="font-display text-3xl font-bold">โอนเงินและแนบสลิป</h1>
          <p className="text-muted mt-1">ล็อก {group.map((b) => b.lot).join(', ')} ถูกกันไว้ให้คุณแล้ว โอนเงินแล้วแนบสลิปเดียวสำหรับทุกล็อก</p>
          <p className={`mt-4 inline-block rounded-lg px-3 py-2 text-sm font-semibold ${expired ? 'bg-danger text-white' : 'bg-sun text-onsun'}`} role="timer">
            {expired ? 'หมดเวลาแนบสลิปแล้ว' : `เหลือเวลาแนบสลิป ${countdownLabel(left)}`}
          </p>
          <div className="mt-7 grid sm:grid-cols-[auto_1fr] gap-7 items-start">
            {payment && (
              <div className="bg-white p-3 rounded-xl border border-line w-fit">
                <QrCode value={`${payment.bank}:${payment.accountNo}:${amount}:${group[0].groupId}`} size={180} />
              </div>
            )}
            <div>
              {payment && (
                <p className="text-sm text-muted">
                  {payment.bank} {payment.accountName} {payment.accountNo}
                </p>
              )}
              <p className="font-display text-4xl font-bold mt-1">{baht(amount)}</p>
              <label
                className={`mt-6 block border-[1.5px] border-dashed border-cobalt/40 rounded-xl p-5 ${expired ? 'opacity-50' : 'hover:border-cobalt hover:bg-cobalt/5 cursor-pointer'}`}
              >
                <input type="file" accept={SLIP_TYPES.join(',')} className="sr-only" onChange={onFile} disabled={expired || send.isPending} />
                <span className="font-semibold block">{file ? `แนบแล้ว: ${file.name}` : 'แตะเพื่อแนบสลิปการโอน'}</span>
                <span className="text-sm text-muted">ไฟล์ JPG, PNG หรือ PDF ขนาดไม่เกิน {LIMITS.maxSlipMB} MB</span>
              </label>
              {error && <p className="text-sm text-danger mt-2">{error}</p>}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={submit}
                  disabled={expired || send.isPending}
                  className="bg-cobalt text-oncobalt rounded-xl px-7 py-3.5 font-semibold press disabled:opacity-50"
                >
                  {send.isPending ? 'กำลังส่งสลิป…' : 'ส่งสลิป'}
                </button>
                {expired && (
                  <Link to={`/events/${event.id}`} className="text-sm font-semibold text-cobalt underline underline-offset-4">
                    กลับไปจองใหม่
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
        <aside className="lg:sticky lg:top-24">
          <BookingSummary event={event} items={group.map((b) => ({ lot: b.lot, amount: b.amount }))} power={group[0].power} />
        </aside>
      </div>
    </section>
  )
}
