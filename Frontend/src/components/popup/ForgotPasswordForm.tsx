import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { isEmail, PASSWORD_HINT } from '../../services/auth'
import OtpField from './OtpField'
import PasswordInput from './PasswordInput'

const field = 'mt-2 w-full bg-surface border border-line rounded-lg px-3 py-2.5 outline-none focus:border-cobalt'

/** ลืมรหัสผ่าน: กรอกอีเมล รับรหัสทางอีเมล แล้วตั้งรหัสผ่านใหม่ */
export default function ForgotPasswordForm({ onDone }: { onDone: () => void }) {
  const { sendOtp, resetPassword } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const requestCode = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!isEmail(email)) {
      setError('รูปแบบอีเมลไม่ถูกต้อง')
      return
    }
    setBusy(true)
    const err = await sendOtp(email, 'reset')
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setSent(true)
    setError('')
  }

  const submitReset = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (password !== confirm) {
      setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
      return
    }
    setBusy(true)
    const err = await resetPassword(email, code, password)
    setBusy(false)
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
          <button disabled={busy} className="bg-cobalt text-oncobalt rounded-xl px-6 py-2.5 font-semibold press disabled:opacity-60">
            {busy ? 'กำลังส่ง…' : 'ส่งรหัส'}
          </button>
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
      <PasswordInput label="รหัสผ่านใหม่" autoComplete="new-password" value={password} onChange={setPassword} hint={PASSWORD_HINT} />
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
        <button disabled={busy} className="bg-cobalt text-oncobalt rounded-xl px-6 py-2.5 font-semibold press disabled:opacity-60">
          {busy ? 'กำลังบันทึก…' : 'ตั้งรหัสผ่านใหม่'}
        </button>
      </div>
    </form>
  )
}
