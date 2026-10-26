import { useState, type FormEvent } from 'react'
import { BANKS } from '../../data/options'
import { useAppStore, useOrganizerData } from '../../hooks/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import type { Organizer, PaymentAccount } from '../../types'
import { dateTimeLabel } from '../../utils/format'
import SelectBox from '../../components/common/SelectBox'

const field = 'fld mt-2'

export default function OrganizerProfilePage() {
  const { organizer } = useOrganizerData()
  // key ให้ฟอร์มเริ่มใหม่เมื่อข้อมูลถูกแทนที่ เช่น คืนค่าข้อมูลตัวอย่าง
  return <OrganizerProfileForm key={JSON.stringify(organizer)} organizer={organizer} />
}

function OrganizerProfileForm({ organizer }: { organizer: Organizer }) {
  const { updateOrganizer } = useAppStore()
  const { account } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState<Organizer>(() => ({
    ...organizer,
    payment: organizer.payment ?? { bank: BANKS[0], accountName: organizer.name, accountNo: organizer.phone ?? '' },
  }))
  const dirty = JSON.stringify(form) !== JSON.stringify({ ...organizer, payment: organizer.payment ?? form.payment })

  const set = <K extends keyof Organizer>(key: K, value: Organizer[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setPayment = (patch: Partial<PaymentAccount>) => setForm((f) => ({ ...f, payment: { ...f.payment!, ...patch } }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.contactName.trim()) {
      toast('กรอกชื่อองค์กรและชื่อผู้ติดต่อ', 'danger')
      return
    }
    updateOrganizer({ ...form, name: form.name.trim(), contactName: form.contactName.trim() })
    toast('บันทึกข้อมูลผู้จัดงานแล้ว')
  }

  return (
    <section className="max-w-3xl">
      <h1 className="font-display text-4xl font-bold">ข้อมูลผู้จัดงาน</h1>
      <p className="mt-1 text-muted">ผู้ขายเห็นชื่อองค์กรในหน้ารายละเอียดงาน บัญชีรับโอนนี้เป็นค่าตั้งต้นของงานใหม่</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-8">
        <section className="bg-surface border border-line rounded-2xl p-6 grid sm:grid-cols-2 gap-5">
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">ชื่อองค์กรหรือกลุ่มผู้จัด</span>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)} className={field} />
          </label>
          <label>
            <span className="text-sm font-semibold">ชื่อผู้ติดต่อ</span>
            <input required value={form.contactName} onChange={(e) => set('contactName', e.target.value)} className={field} />
          </label>
          <label>
            <span className="text-sm font-semibold">เบอร์โทร</span>
            <input type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} className={field} />
          </label>
          <div className="sm:col-span-2 text-sm text-muted">
            อีเมลเข้าสู่ระบบ <b className="text-ink">{account?.email}</b>
            {account && <> · สมัครเมื่อ {dateTimeLabel(account.createdAt)}</>}
          </div>
        </section>

        <section className="bg-surface border border-line rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">บัญชีรับโอนตั้งต้น</h2>
          <div className="mt-5 grid sm:grid-cols-3 gap-5">
            <label>
              <span className="text-sm font-semibold">ธนาคาร</span>
              <SelectBox value={form.payment?.bank ?? ''} onChange={(bank) => setPayment({ bank })} options={BANKS} className="mt-2" aria-label="ธนาคาร" />
            </label>
            <label>
              <span className="text-sm font-semibold">ชื่อบัญชี</span>
              <input value={form.payment?.accountName ?? ''} onChange={(e) => setPayment({ accountName: e.target.value })} className={field} />
            </label>
            <label>
              <span className="text-sm font-semibold">เลขบัญชีหรือพร้อมเพย์</span>
              <input value={form.payment?.accountNo ?? ''} onChange={(e) => setPayment({ accountNo: e.target.value })} className={field} />
            </label>
          </div>
        </section>

        <button disabled={!dirty} className="bg-cobalt text-oncobalt rounded-xl px-6 py-3 font-semibold press disabled:opacity-40 disabled:cursor-not-allowed">
          บันทึกข้อมูล
        </button>
      </form>
    </section>
  )
}
