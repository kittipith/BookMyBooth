import { useState, type FormEvent } from 'react'
import { AUTH_RULES } from '../../data/settings'
import { useAppStore } from '../../hooks/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { normalizeEmail } from '../../services/auth'
import OtpField from './OtpField'
import PasswordInput from './PasswordInput'

const field = 'mt-2 w-full bg-surface border border-line rounded-lg px-3 py-2.5 outline-none focus:border-cobalt'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** ลืมรหัสผ่าน: กรอกอีเมล รับรหัส OTP แล้วตั้งรหัสผ่านใหม่ */
export default function ForgotPasswordForm({ onDone }: { onDone: () => void }) {
  const { sendOtp, resetPassword } = useAuth()
  const { accounts } = useAppStore()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const requestCode = (e: FormEvent) => {
    e.preventDefault()
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('รูปแบบอีเมลไม่ถูกต้อง')
      return
    }
    // ไม่บอกว่ามีบัญชีนี้หรือไม่ เพื่อไม่ให้ใช้เดาอีเมลในระบบได้
    if (accounts.some((a) => a.email === normalizeEmail(email))) sendOtp(email, 'reset')
    setSent(true)
    setError('')
  }

  const submitReset = (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
      return
    }
    const err = resetPassword(email, code, password)
    if (err) {
      setError(err)
      return
    }
    toast('ตั้งรหัสผ่านใหม่แล้ว เข้าสู่ระบบด้วยรหัสใหม่ได้เลย')
    onDone()
  }

  if (!sent) {
    return (
      <form onSubmit={requestCode} noValidate>
        <p className="mt-2 text-sm text-muted">กรอกอีเมลที่ใช้สมัคร ระบบจะส่งรหัสสำหรับตั้งรหัสผ่านใหม่ไปให้</p>
        <label className="mt-5 block">
          <span className="text-sm font-semibold">อีเมล</span>
          <input
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
            className={field}
          />
          {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
        </label>
        <div className="mt-6 flex justify-between gap-3">
          <button type="button" onClick={onDone} className="px-4 py-2.5 rounded-xl hover:bg-mist">
            กลับไปเข้าสู่ระบบ
          </button>
          <button className="bg-cobalt text-oncobalt rounded-xl px-6 py-2.5 font-semibold press">ส่งรหัส</button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={submitReset} noValidate>
      <p className="mt-2 text-sm text-muted">
        ถ้ามีบัญชีของ <b className="text-ink">{email}</b> ในระบบ เราส่งรหัสไปแล้ว กรอกรหัสและตั้งรหัสผ่านใหม่
      </p>
      <OtpField email={email} purpose="reset" value={code} onChange={setCode} />
      <PasswordInput
        label="รหัสผ่านใหม่"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        hint={`อย่างน้อย ${AUTH_RULES.minPasswordLength} ตัว มีทั้งตัวอักษรและตัวเลข`}
      />
      <PasswordInput label="ยืนยันรหัสผ่านใหม่" autoComplete="new-password" value={confirm} onChange={setConfirm} />
      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-between gap-3">
        <button type="button" onClick={() => setSent(false)} className="px-4 py-2.5 rounded-xl hover:bg-mist">
          เปลี่ยนอีเมล
        </button>
        <button className="bg-cobalt text-oncobalt rounded-xl px-6 py-2.5 font-semibold press">ตั้งรหัสผ่านใหม่</button>
      </div>
    </form>
  )
}
