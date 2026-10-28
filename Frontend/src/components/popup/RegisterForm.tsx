import { useState, type FormEvent, type ReactNode } from 'react'
import { PRODUCT_CATEGORIES, ROLE_LABEL } from '../../data/options'
import { useAuth } from '../../hooks/useAuth'
import { PASSWORD_HINT } from '../../services/auth'
import type { RegisterErrors, RegisterInput } from '../../types'
import PasswordInput from './PasswordInput'
import SelectBox from '../common/SelectBox'

type SignupRole = RegisterInput['role']

/** บทบาทที่สมัครเองได้ (ผู้ดูแลระบบสร้างโดยทีมพัฒนาเท่านั้น) */
const SIGNUP_ROLES: SignupRole[] = ['seller', 'organizer']

const ROLE_HINT: Record<SignupRole, string> = {
  seller: 'จองล็อกขายของในงานต่างๆ ใช้งานได้ทันที',
  organizer: 'สร้างงาน วาดผัง และอนุมัติการจอง ต้องรอผู้ดูแลระบบอนุมัติ',
}

interface RegisterFormProps {
  /** บังคับบทบาท เช่น เปิดจากปุ่มจองล็อกต้องเป็นผู้ขายเท่านั้น */
  lockedRole?: SignupRole
  onLogin: () => void
  /** สมัครสำเร็จ ไปขั้นยืนยันอีเมล */
  onRegistered: (email: string) => void
}

export default function RegisterForm({ lockedRole, onLogin, onRegistered }: RegisterFormProps) {
  const { register, closeLogin } = useAuth()
  const [form, setForm] = useState<RegisterInput>({
    role: lockedRole ?? 'seller',
    orgName: '',
    name: '',
    phone: '',
    category: PRODUCT_CATEGORIES[0],
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const seller = form.role === 'seller'

  const set = <K extends keyof RegisterInput>(key: K, value: RegisterInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    setError('')
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const result = await register(form)
    setBusy(false)
    if (result.errors) {
      setErrors(result.errors)
      return
    }
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.verifyEmail) onRegistered(result.verifyEmail)
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-5">
      {lockedRole ? (
        <p className="text-sm text-muted">สมัครเป็น{ROLE_LABEL[lockedRole]}</p>
      ) : (
        <fieldset>
          <legend className="text-sm font-semibold">สมัครเป็น</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SIGNUP_ROLES.map((r) => (
              <label
                key={r}
                className={`rounded-xl border-[1.5px] p-3 cursor-pointer ${form.role === r ? 'border-cobalt bg-cobalt/5' : 'border-line hover:border-cobalt'}`}
              >
                <input type="radio" name="role" value={r} checked={form.role === r} onChange={() => set('role', r)} className="sr-only" />
                <span className="block font-semibold">{ROLE_LABEL[r]}</span>
                <span className="block text-xs text-muted mt-0.5">{ROLE_HINT[r]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Field label={seller ? 'ชื่อร้าน' : 'ชื่อองค์กรหรือกลุ่มผู้จัด'} error={errors.orgName}>
        <input
          value={form.orgName}
          onChange={(e) => set('orgName', e.target.value)}
          placeholder={seller ? 'เช่น ข้าวเหนียวมะม่วงป้าแดง' : 'เช่น กลุ่มตลาดเขียว'}
          className={input(errors.orgName)}
        />
      </Field>
      <div className="grid sm:grid-cols-2 gap-x-3">
        <Field label={seller ? 'ชื่อเจ้าของร้าน' : 'ชื่อผู้ติดต่อ'} error={errors.name}>
          <input autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} className={input(errors.name)} />
        </Field>
        <Field label="เบอร์โทร" error={errors.phone}>
          <input
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="081 234 5678"
            className={input(errors.phone)}
          />
        </Field>
      </div>
      {seller && (
        <Field label="ประเภทสินค้า" error={errors.category}>
          <SelectBox
            value={form.category}
            onChange={(category) => set('category', category)}
            options={PRODUCT_CATEGORIES}
            invalid={!!errors.category}
            className={errors.category ? 'border-danger' : undefined}
            aria-label="ประเภทสินค้า"
          />
        </Field>
      )}
      <Field label="อีเมล" error={errors.email}>
        <input
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="you@example.com"
          className={input(errors.email)}
        />
      </Field>
      <PasswordInput
        label="รหัสผ่าน"
        autoComplete="new-password"
        value={form.password}
        onChange={(v) => set('password', v)}
        error={errors.password}
        hint={PASSWORD_HINT}
      />
      <PasswordInput
        label="ยืนยันรหัสผ่าน"
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={(v) => set('confirmPassword', v)}
        error={errors.confirmPassword}
      />

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {/* ปุ่มตรึงไว้ด้านล่างกล่อง กดสมัครได้โดยไม่ต้องเลื่อนลงสุด */}
      <div className="sticky -bottom-6 z-10 mt-3 -mx-6 px-6 py-3 flex justify-end gap-3 bg-surface shadow-[0_-10px_16px_-14px_rgb(16_28_64/.4)]">
        <button type="button" onClick={closeLogin} className="px-4 py-2.5 rounded-xl hover:bg-mist">
          ยกเลิก
        </button>
        <button disabled={busy} className="bg-cobalt text-oncobalt rounded-xl px-6 py-2.5 font-semibold press disabled:opacity-60">
          {busy ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
        </button>
      </div>
      <p className="mt-2 pt-4 border-t border-line text-sm text-muted text-center">
        มีบัญชีอยู่แล้ว?{' '}
        <button type="button" onClick={onLogin} className="text-cobalt font-semibold hover:underline underline-offset-4">
          เข้าสู่ระบบ
        </button>
      </p>
    </form>
  )
}

const input = (error?: string) =>
  `mt-2 w-full bg-surface border rounded-lg px-3 py-2.5 outline-none focus:border-cobalt ${error ? 'border-danger' : 'border-line'}`

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}
