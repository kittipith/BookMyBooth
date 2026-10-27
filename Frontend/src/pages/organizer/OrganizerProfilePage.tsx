import { useState, type FormEvent } from 'react'
import type { UpdateMeDto, UserDto } from '../../api/dto'
import { BANKS } from '../../data/options'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useUpdateMe } from '../../queries/me'
import { cleanPhone } from '../../services/auth'
import type { PaymentAccount } from '../../types'
import { dateTimeLabel } from '../../utils/format'
import SelectBox from '../../components/common/SelectBox'

const field = 'fld mt-2'

/** ฟิลด์ที่ผู้จัดงานแก้ได้ผ่าน PUT /me (F8, F32) */
interface OrganizerForm {
  orgName: string
  displayName: string
  phone: string
  payment: PaymentAccount
}

const toForm = (me: UserDto): OrganizerForm => ({
  orgName: me.orgName ?? '',
  displayName: me.displayName ?? '',
  phone: me.phone ?? '',
  // ยังไม่เคยบันทึกบัญชีรับโอน ใช้ชื่อองค์กรและเบอร์โทรเป็นค่าเริ่ม
  payment: me.payment ?? { bank: BANKS[0], accountName: me.orgName ?? '', accountNo: me.phone ?? '' },
})

export default function OrganizerProfilePage() {
  const { me } = useAuth()
  if (!me) return null
  // key ให้ฟอร์มเริ่มใหม่เมื่อโปรไฟล์จาก backend เปลี่ยน
  return <OrganizerProfileForm key={me.updatedAt} me={me} />
}

function OrganizerProfileForm({ me }: { me: UserDto }) {
  const toast = useToast()
  const update = useUpdateMe()
  const saved = toForm(me)
  const [form, setForm] = useState<OrganizerForm>(saved)
  const dirty = JSON.stringify(form) !== JSON.stringify(saved) || !me.payment

  const set = <K extends keyof OrganizerForm>(key: K, value: OrganizerForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setPayment = (patch: Partial<PaymentAccount>) => setForm((f) => ({ ...f, payment: { ...f.payment, ...patch } }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const payment = {
      bank: form.payment.bank,
      accountName: form.payment.accountName.trim(),
      accountNo: form.payment.accountNo.trim(),
    }
    if (!form.orgName.trim() || !form.displayName.trim()) {
      toast('กรอกชื่อองค์กรและชื่อผู้ติดต่อ', 'danger')
      return
    }
    if (!payment.accountName || !payment.accountNo) {
      toast('กรอกชื่อบัญชีและเลขบัญชีรับโอน', 'danger')
      return
    }
    const changes: UpdateMeDto = {}
    if (form.orgName.trim() !== saved.orgName) changes.orgName = form.orgName.trim()
    if (form.displayName.trim() !== saved.displayName) changes.displayName = form.displayName.trim()
    // backend ลบเบอร์โทรไม่ได้ ช่องว่างจึงไม่ส่ง
    const phone = cleanPhone(form.phone)
    if (phone && phone !== saved.phone) changes.phone = phone
    if (!me.payment || JSON.stringify(payment) !== JSON.stringify(saved.payment)) changes.payment = payment
    update.mutate(changes, { onSuccess: () => toast('บันทึกข้อมูลผู้จัดงานแล้ว') })
  }

  return (
    <section className="max-w-3xl">
      <h1 className="font-display text-4xl font-bold">ข้อมูลผู้จัดงาน</h1>
      <p className="mt-1 text-muted">ผู้ขายเห็นชื่อองค์กรในหน้ารายละเอียดงาน บัญชีรับโอนนี้เป็นค่าตั้งต้นของงานใหม่</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-8">
        <section className="bg-surface border border-line rounded-2xl p-6 grid sm:grid-cols-2 gap-5">
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold">ชื่อองค์กรหรือกลุ่มผู้จัด</span>
            <input required maxLength={100} value={form.orgName} onChange={(e) => set('orgName', e.target.value)} className={field} />
          </label>
          <label>
            <span className="text-sm font-semibold">ชื่อผู้ติดต่อ</span>
            <input required maxLength={100} value={form.displayName} onChange={(e) => set('displayName', e.target.value)} className={field} />
          </label>
          <label>
            <span className="text-sm font-semibold">เบอร์โทร</span>
            <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={field} />
          </label>
          <div className="sm:col-span-2 text-sm text-muted">
            อีเมลเข้าสู่ระบบ <b className="text-ink">{me.email}</b> · สมัครเมื่อ {dateTimeLabel(me.createdAt)}
          </div>
        </section>

        <section className="bg-surface border border-line rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold">บัญชีรับโอนตั้งต้น</h2>
          {!me.payment && <p className="mt-1 text-sm text-muted">ยังไม่ได้บันทึก ตรวจสอบแล้วกดบันทึกข้อมูล</p>}
          <div className="mt-5 grid sm:grid-cols-3 gap-5">
            <label>
              <span className="text-sm font-semibold">ธนาคาร</span>
              <SelectBox value={form.payment.bank} onChange={(bank) => setPayment({ bank })} options={BANKS} className="mt-2" aria-label="ธนาคาร" />
            </label>
            <label>
              <span className="text-sm font-semibold">ชื่อบัญชี</span>
              <input maxLength={100} value={form.payment.accountName} onChange={(e) => setPayment({ accountName: e.target.value })} className={field} />
            </label>
            <label>
              <span className="text-sm font-semibold">เลขบัญชีหรือพร้อมเพย์</span>
              <input maxLength={30} value={form.payment.accountNo} onChange={(e) => setPayment({ accountNo: e.target.value })} className={field} />
            </label>
          </div>
        </section>

        <button
          disabled={!dirty || update.isPending}
          className="bg-cobalt text-oncobalt rounded-xl px-6 py-3 font-semibold press disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {update.isPending ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}
        </button>
      </form>
    </section>
  )
}
