import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import BookingStepper from '../../components/user/BookingStepper'
import BookingSummary from '../../components/user/BookingSummary'
import { PRODUCT_CATEGORIES, STAFF_OPTIONS } from '../../data/options'
import { useAppStore, useEvent, useMyShop } from '../../hooks/useAppStore'
import { FEES } from '../../data/settings'
import type { ShopInfo } from '../../types'
import { baht } from '../../utils/format'
import SelectBox from '../../components/common/SelectBox'

const field = 'mt-2 w-full bg-surface border border-line rounded-lg px-3 py-2.5 outline-none focus:border-cobalt'

export default function BookingShopInfoPage() {
  const navigate = useNavigate()
  const { draft, setDraft } = useAppStore()
  const { shop: myShop, myBookings } = useMyShop()
  const event = useEvent(draft?.eventId)
  // ค่าตั้งต้นมาจากข้อมูลร้าน และจำนวนคนจากการจองครั้งล่าสุด
  const [shop, setShop] = useState<ShopInfo>(
    () =>
      draft?.shop ?? {
        shopName: myShop.name,
        category: myShop.category,
        staff: [...myBookings].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]?.staff ?? STAFF_OPTIONS[0],
        power: myShop.power.startsWith('15A'),
        note: '',
      },
  )

  if (!draft || !event) return <Navigate to="/events" replace />

  const set = <K extends keyof ShopInfo>(key: K, value: ShopInfo[K]) => setShop((s) => ({ ...s, [key]: value }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setDraft({ ...draft, shop: { ...shop, shopName: shop.shopName.trim() } })
    navigate('/booking/payment')
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
              <input required value={shop.shopName} onChange={(e) => set('shopName', e.target.value)} className={field} />
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
                <span className="block text-sm text-muted">สำหรับหม้อหุงข้าว เตาไฟฟ้า หรือตู้แช่ เพิ่ม {baht(FEES.power)} ต่อวัน</span>
              </span>
            </label>
            <label className="sm:col-span-2">
              <span className="text-sm font-semibold">
                ข้อความถึงผู้จัดงาน <span className="font-normal text-muted">(ไม่บังคับ)</span>
              </span>
              <textarea
                rows={3}
                value={shop.note}
                onChange={(e) => set('note', e.target.value)}
                className={field}
                placeholder="เช่น ขอติดกับร้านเพื่อน ล็อก A06"
              />
            </label>
            <div className="sm:col-span-2">
              <button className="bg-cobalt text-oncobalt rounded-xl px-7 py-3.5 font-semibold press">ไปที่การชำระเงิน</button>
            </div>
          </form>
        </div>
        <aside className="lg:sticky lg:top-24">
          <BookingSummary event={event} lots={draft.lots} days={draft.days} power={shop.power} />
        </aside>
      </div>
    </section>
  )
}
