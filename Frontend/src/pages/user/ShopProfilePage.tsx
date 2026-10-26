import { useState, type FormEvent } from 'react'
import { POWER_OPTIONS, PRODUCT_CATEGORIES } from '../../data/options'
import { useAppStore, useMyShop } from '../../hooks/useAppStore'
import { useToast } from '../../hooks/useToast'
import type { Shop } from '../../types'
import { baht, initial } from '../../utils/format'
import SelectBox from '../../components/common/SelectBox'

const field = 'mt-2 w-full bg-surface border border-line rounded-lg px-3 py-2.5 outline-none focus:border-cobalt'

export default function ShopProfilePage() {
  const { shop } = useMyShop()
  // key ให้ฟอร์มเริ่มใหม่เมื่อข้อมูลร้านถูกแทนที่ เช่น คืนค่าข้อมูลตัวอย่าง
  return <ShopProfileForm key={JSON.stringify(shop)} shop={shop} />
}

function ShopProfileForm({ shop }: { shop: Shop }) {
  const { updateShop } = useAppStore()
  const { stats } = useMyShop()
  const toast = useToast()
  const [form, setForm] = useState<Shop>(shop)
  const dirty = JSON.stringify(form) !== JSON.stringify(shop)

  const set = <K extends keyof Shop>(key: K, value: Shop[K]) => setForm((f) => ({ ...f, [key]: value }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    updateShop({ ...form, name: form.name.trim() })
    toast('บันทึกข้อมูลร้านแล้ว')
  }

  return (
    <section className="max-w-5xl mx-auto px-5 py-10">
      <h1 className="font-display text-4xl font-bold">ร้านของฉัน</h1>
      <p className="mt-2 text-muted">ผู้จัดงานจะเห็นข้อมูลนี้ตอนตรวจคำขอจอง ข้อมูลที่ครบช่วยให้อนุมัติเร็วขึ้น</p>
      <div className="mt-8 grid lg:grid-cols-[1fr_300px] gap-10 items-start">
        <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-5">
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">ชื่อร้าน</span>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)} className={field} />
          </label>
          <label>
            <span className="text-sm font-semibold">ชื่อเจ้าของร้าน</span>
            <input required value={form.owner} onChange={(e) => set('owner', e.target.value)} className={field} />
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
              pattern="[0-9 ]{9,12}"
              title="ตัวเลข 9–10 หลัก"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className={field}
            />
          </label>
          <label>
            <span className="text-sm font-semibold">LINE ID</span>
            <input value={form.line} onChange={(e) => set('line', e.target.value)} className={field} />
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">ต้องใช้ไฟฟ้า</span>
            <SelectBox value={form.power} onChange={(v) => set('power', v)} options={POWER_OPTIONS} className="mt-2" aria-label="ต้องใช้ไฟฟ้า" />
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">แนะนำร้าน</span>
            <textarea rows={4} value={form.bio} onChange={(e) => set('bio', e.target.value)} className={field} />
          </label>
          <div className="sm:col-span-2 flex items-center gap-4">
            <button
              disabled={!dirty}
              className="bg-cobalt text-oncobalt rounded-xl px-6 py-3 font-semibold press disabled:opacity-40 disabled:cursor-not-allowed"
            >
              บันทึกข้อมูลร้าน
            </button>
            {dirty && (
              <button type="button" onClick={() => setForm(shop)} className="text-sm text-muted underline underline-offset-4">
                ยกเลิกการแก้ไข
              </button>
            )}
          </div>
        </form>
        <div>
          <p className="text-sm text-muted mb-3">ผู้จัดงานจะเห็นร้านของคุณแบบนี้</p>
          <div className="bg-surface border border-line rounded-2xl p-5">
            <div className="w-12 h-12 rounded-full bg-cobalt text-oncobalt grid place-items-center font-display text-xl font-semibold">
              {initial(form.owner)}
            </div>
            <h3 className="mt-3 font-display text-xl font-semibold">{form.name || 'ชื่อร้าน'}</h3>
            <p className="text-sm text-muted">
              {form.category} · {form.owner}
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
