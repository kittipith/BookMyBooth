import { useState, type FormEvent } from 'react'
import type { UpdateMeDto, UserDto } from '../../api/dto'
import { POWER_OPTIONS, PRODUCT_CATEGORIES } from '../../data/options'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useMyBookings } from '../../queries/bookings'
import { useEvents } from '../../queries/events'
import { useUpdateMe } from '../../queries/me'
import { sellerStats } from '../../services/bookings'
import { cleanPhone } from '../../services/auth'
import { baht, initial } from '../../utils/format'
import SelectBox from '../../components/common/SelectBox'

const field = 'mt-2 w-full bg-surface border border-line rounded-lg px-3 py-2.5 outline-none focus:border-cobalt'

/** ฟิลด์ที่ผู้ขายแก้ได้ผ่าน PUT /me (F8, F29) */
interface ShopForm {
  shopName: string
  displayName: string
  category: string
  phone: string
  line: string
  power: string
  bio: string
}

const toForm = (me: UserDto): ShopForm => ({
  shopName: me.shopName ?? '',
  displayName: me.displayName ?? '',
  category: me.category ?? PRODUCT_CATEGORIES[0],
  phone: me.phone ?? '',
  line: me.line ?? '',
  power: me.power ?? POWER_OPTIONS[0],
  bio: me.bio ?? '',
})

export default function ShopProfilePage() {
  const { me } = useAuth()
  if (!me) return null
  // key ให้ฟอร์มเริ่มใหม่เมื่อโปรไฟล์จาก backend เปลี่ยน
  return <ShopProfileForm key={me.updatedAt} me={me} />
}

function ShopProfileForm({ me }: { me: UserDto }) {
  const { data: bookings = [] } = useMyBookings()
  const { data: events = [] } = useEvents()
  const stats = sellerStats(bookings, events)
  const toast = useToast()
  const update = useUpdateMe()
  const saved = toForm(me)
  const [form, setForm] = useState<ShopForm>(saved)
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  const set = <K extends keyof ShopForm>(key: K, value: ShopForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const next: ShopForm = { ...form, shopName: form.shopName.trim(), displayName: form.displayName.trim(), phone: cleanPhone(form.phone) }
    // ส่งเฉพาะช่องที่เปลี่ยน
    const changes: UpdateMeDto = Object.fromEntries(
      (Object.keys(next) as (keyof ShopForm)[]).filter((key) => next[key] !== saved[key]).map((key) => [key, next[key]]),
    )
    update.mutate(changes, { onSuccess: () => toast('บันทึกข้อมูลร้านแล้ว') })
  }

  return (
    <section className="max-w-5xl mx-auto px-5 py-10">
      <h1 className="font-display text-4xl font-bold">ร้านของฉัน</h1>
      <p className="mt-2 text-muted">ผู้จัดงานจะเห็นข้อมูลนี้ตอนตรวจคำขอจอง ข้อมูลที่ครบช่วยให้อนุมัติเร็วขึ้น</p>
      <div className="mt-8 grid lg:grid-cols-[1fr_300px] gap-10 items-start">
        <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-5">
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">ชื่อร้าน</span>
            <input required maxLength={100} value={form.shopName} onChange={(e) => set('shopName', e.target.value)} className={field} />
          </label>
          <label>
            <span className="text-sm font-semibold">ชื่อเจ้าของร้าน</span>
            <input required maxLength={100} value={form.displayName} onChange={(e) => set('displayName', e.target.value)} className={field} />
          </label>
          <label>
            <span className="text-sm font-semibold">ประเภทสินค้า</span>
            <SelectBox value={form.category} onChange={(v) => set('category', v)} options={PRODUCT_CATEGORIES} className="mt-2" aria-label="ประเภทสินค้า" />
          </label>
          <label>
            <span className="text-sm font-semibold">เบอร์โทร</span>
            <input
              required
              type="tel"
              pattern="0[0-9 \-]{8,11}"
              title="ขึ้นต้นด้วย 0 ตัวเลข 9–10 หลัก"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className={field}
            />
          </label>
          <label>
            <span className="text-sm font-semibold">LINE ID</span>
            <input maxLength={50} value={form.line} onChange={(e) => set('line', e.target.value)} className={field} />
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">ต้องใช้ไฟฟ้า</span>
            <SelectBox value={form.power} onChange={(v) => set('power', v)} options={POWER_OPTIONS} className="mt-2" aria-label="ต้องใช้ไฟฟ้า" />
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">แนะนำร้าน</span>
            <textarea rows={4} maxLength={1000} value={form.bio} onChange={(e) => set('bio', e.target.value)} className={field} />
          </label>
          <div className="sm:col-span-2 flex items-center gap-4">
            <button
              disabled={!dirty || update.isPending}
              className="bg-cobalt text-oncobalt rounded-xl px-6 py-3 font-semibold press disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {update.isPending ? 'กำลังบันทึก…' : 'บันทึกข้อมูลร้าน'}
            </button>
            {dirty && !update.isPending && (
              <button type="button" onClick={() => setForm(saved)} className="text-sm text-muted underline underline-offset-4">
                ยกเลิกการแก้ไข
              </button>
            )}
          </div>
        </form>
        <div>
          <p className="text-sm text-muted mb-3">ผู้จัดงานจะเห็นร้านของคุณแบบนี้</p>
          <div className="bg-surface border border-line rounded-2xl p-5">
            <div className="w-12 h-12 rounded-full bg-cobalt text-oncobalt grid place-items-center font-display text-xl font-semibold">
              {initial(form.displayName || form.shopName)}
            </div>
            <h3 className="mt-3 font-display text-xl font-semibold">{form.shopName || 'ชื่อร้าน'}</h3>
            <p className="text-sm text-muted">
              {form.category} · {form.displayName}
            </p>
            <p className="mt-3 text-sm leading-relaxed">{form.bio}</p>
            <dl className="mt-4 pt-4 border-t border-line grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">จองสำเร็จ</dt>
                <dd className="font-display text-2xl font-semibold">{stats.approved} ครั้ง</dd>
              </div>
              <div>
                <dt className="text-muted">มาตามนัด</dt>
                <dd className="font-display text-2xl font-semibold">{stats.showRate === null ? '–' : `${stats.showRate}%`}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">ยอดค่าเช่ารวม</dt>
                <dd className="font-display text-lg font-semibold">{baht(stats.total)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
