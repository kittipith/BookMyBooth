import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import DevAccountPicker from './DevAccountPicker'
import PasswordInput from './PasswordInput'

const field = 'mt-2 w-full bg-surface border border-line rounded-lg px-3 py-2.5 outline-none focus:border-cobalt'

interface LoginFormProps {
  onRegister: () => void
  onForgot: () => void
  /** บัญชียังไม่ยืนยันอีเมล ไปหน้ากรอกรหัส */
  onNeedVerify: (email: string) => void
}

export default function LoginForm({ onRegister, onForgot, onNeedVerify }: LoginFormProps) {
  const { login, closeLogin } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const result = await login(email, password)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.verifyEmail) {
      onNeedVerify(result.verifyEmail)
      return
    }
    if (result.name) toast(`ยินดีต้อนรับ คุณ${result.name}`)
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-5">
      {/* แสดงเองเมื่อมีบัญชีเดโม (โหมด dev หรือตั้ง VITE_DEMO_PASSWORD) */}
      <DevAccountPicker
        onPick={(account) => {
          setEmail(account.email)
          setPassword(account.password)
          setError('')
        }}
      />
      <label className="block">
        <span className="text-sm font-semibold">อีเมล</span>
        <input
          type="email"
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setError('')
          }}
          className={field}
          placeholder="you@example.com"
        />
      </label>
      <PasswordInput
        label="รหัสผ่าน"
        autoComplete="current-password"
        value={password}
        onChange={(v) => {
          setPassword(v)
          setError('')
        }}
      />
      <div className="mt-2 text-right">
        <button type="button" onClick={onForgot} className="text-sm text-cobalt hover:underline underline-offset-4">
          ลืมรหัสผ่าน?
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-3">
        <button type="button" onClick={closeLogin} className="px-4 py-2.5 rounded-xl hover:bg-mist">
          ยกเลิก
        </button>
        <button disabled={busy} className="bg-cobalt text-oncobalt rounded-xl px-6 py-2.5 font-semibold press disabled:opacity-60">
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </div>
      <p className="mt-5 pt-4 border-t border-line text-sm text-muted text-center">
        ยังไม่มีบัญชี?{' '}
        <button type="button" onClick={onRegister} className="text-cobalt font-semibold hover:underline underline-offset-4">
          สมัครสมาชิก
        </button>
      </p>
    </form>
  )
}
