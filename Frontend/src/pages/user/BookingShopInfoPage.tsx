import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import BookingStepper from '../../components/user/BookingStepper'
import BookingSummary from '../../components/user/BookingSummary'
import { PRODUCT_CATEGORIES, STAFF_OPTIONS } from '../../data/options'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useCreateBooking, useMyBookings } from '../../queries/bookings'
import { useEventDetail } from '../../queries/events'
import { clearDraft, readDraft, type BookingDraft } from '../../services/bookingDraft'
import { zonePrice } from '../../services/events'
import type { PublicEvent, ShopInfo } from '../../types'
import { lotZoneId } from '../../utils/pricing'
import SelectBox from '../../components/common/SelectBox'

const field = 'mt-2 w-full bg-surface border border-line rounded-lg px-3 py-2.5 outline-none focus:border-cobalt'

export default function BookingShopInfoPage() {
  const [draft] = useState(readDraft)
  const event = useEventDetail(draft?.eventId)

  if (!draft?.lots.length) return <Navigate to="/events" replace />
  if (event.isPending) return <p className="py-20 text-center text-muted">กำลังโหลด…</p>
  if (!event.data || event.data.status !== 'open') return <Navigate to={`/events/${draft.eventId}`} replace />
  return <ShopInfoForm draft={draft} event={event.data} />
}

function ShopInfoForm({ draft, event }: { draft: BookingDraft; event: PublicEvent }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { me } = useAuth()
  const { data: myBookings = [] } = useMyBookings()
  const create = useCreateBooking()
  // ค่าตั้งต้นมาจากโปรไฟล์ร้าน (GET /me) และจำนวนคนจากการจองครั้งล่าสุด
  const [shop, setShop] = useState<ShopInfo>(() => ({
    shopName: me?.shopName ?? '',
    category: me?.category || PRODUCT_CATEGORIES[0],
    staff: [...myBookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.staff || STAFF_OPTIONS[0],
    power: !!me?.power?.startsWith('15A'),
    note: '',
  }))

  const set = <K extends keyof ShopInfo>(key: K, value: ShopInfo[K]) => setShop((s) => ({ ...s, [key]: value }))
  const backToMap = (lots: string[]) => navigate(`/events/${event.id}${lots.length ? `?lots=${lots.join(',')}` : ''}`)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (create.isPending) return
    create.mutate(
      {
        eventId: event.id,
        lotIds: draft.lots,
        shopName: shop.shopName.trim(),
        category: shop.category,
        staff: shop.staff,
        power: shop.power,
        note: shop.note.trim(),
      },
      {
        onSuccess: (result) => {
          clearDraft()
          navigate(`/booking/payment/${result.groupId}`)
        },
        onError: (error) => {
          if (error.code === 'LOT_NOT_AVAILABLE') {
            // ระหว่างกรอกข้อมูล มีคนอื่นจองล็อกนี้ไปก่อน กลับไปเลือกใหม่ โดยเก็บล็อกที่ยังว่างไว้
            const taken = (error.details as { lotIds?: string[] } | undefined)?.lotIds ?? []
            toast(`ล็อก ${taken.join(', ')} ถูกจองไปแล้ว เลือกใหม่อีกครั้ง`, 'danger')
            backToMap(draft.lots.filter((l) => !taken.includes(l)))
            return
          }
          if (error.code === 'QUOTA_EXCEEDED' || error.code === 'BOOKING_CLOSED') {
            toast(error.message, 'danger')
            backToMap([])
            return
          }
          toast(error.message, 'danger')
        },
      },
    )
  }

  return (
    <section className="max-w-6xl mx-auto px-5 py-10">
      <Link to={`/events/${event.id}?lots=${draft.lots.join(',')}`} className="text-sm text-muted hover:text-ink">
        กลับไปที่ผัง
      </Link>
      <BookingStepper step={1} />
      <div className="mt-8 grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        <div>
          <h1 className="font-display text-3xl font-bold">ข้อมูลร้านสำหรับงานนี้</h1>
          <p className="text-muted mt-1">ดึงมาจากข้อมูลร้านของคุณ แก้เฉพาะงานนี้ได้</p>
          <form onSubmit={onSubmit} className="mt-7 grid sm:grid-cols-2 gap-5">
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold">ชื่อร้าน</span>
              <input required maxLength={100} value={shop.shopName} onChange={(e) => set('shopName', e.target.value)} className={field} />
            </label>
            <label>
              <span className="text-sm font-semibold">ประเภทสินค้า</span>
              <SelectBox value={shop.category} onChange={(v) => set('category', v)} options={PRODUCT_CATEGORIES} className="mt-2" aria-label="ประเภทสินค้า" />
            </label>
            <label>
              <span className="text-sm font-semibold">จำนวนคนประจำร้าน</span>
              <SelectBox value={shop.staff} onChange={(v) => set('staff', v)} options={STAFF_OPTIONS} className="mt-2" aria-label="จำนวนคนประจำร้าน" />
            </label>
            <label className="sm:col-span-2 flex items-start gap-3 bg-mist rounded-xl p-4">
              <input type="checkbox" checked={shop.power} onChange={(e) => set('power', e.target.checked)} className="w-4 h-4 mt-1" />
              <span>
                <span className="font-semibold">ขอไฟฟ้าเพิ่มเป็น 15A</span>
                <span className="block text-sm text-muted">สำหรับหม้อหุงข้าว เตาไฟฟ้า หรือตู้แช่ ผู้จัดงานจะเห็นคำขอนี้ ค่าไฟตกลงกับผู้จัดงานโดยตรง</span>
              </span>
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold">
                ข้อความถึงผู้จัดงาน <span className="font-normal text-muted">(ไม่บังคับ)</span>
              </span>
              <textarea
                rows={3}
                maxLength={500}
                value={shop.note}
                onChange={(e) => set('note', e.target.value)}
                className={field}
                placeholder="เช่น ขอติดกับร้านเพื่อน ล็อก A06"
              />
            </label>
            <div className="sm:col-span-2">
              <button disabled={create.isPending} className="bg-cobalt text-oncobalt rounded-xl px-7 py-3.5 font-semibold press disabled:opacity-60">
                {create.isPending ? 'กำลังจองล็อก…' : 'จองล็อกแล้วไปชำระเงิน'}
              </button>
              <p className="mt-2 text-sm text-muted">
                ระบบกันล็อกไว้ให้ทันที แล้วต้องโอนเงินและแนบสลิปภายใน{' '}
                {event.slipDeadlineMinutes >= 60 ? `${Math.round(event.slipDeadlineMinutes / 60)} ชั่วโมง` : `${event.slipDeadlineMinutes} นาที`} ไม่งั้นการจองหมดเวลา
              </p>
            </div>
          </form>
        </div>
        <aside className="lg:sticky lg:top-24">
          <BookingSummary event={event} items={draft.lots.map((lot) => ({ lot, amount: zonePrice(event, lotZoneId(lot)) }))} power={shop.power} />
        </aside>
      </div>
    </section>
  )
}
