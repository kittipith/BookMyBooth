import { useState, type FormEvent } from 'react'
import { useAppStore } from '../../hooks/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { accountProfile, normalizeEmail } from '../../services/auth'
import OtpField from './OtpField'

interface VerifyEmailFormProps {
  email: string
  onBack: () => void
}

/** ยืนยันอีเมลด้วยรหัส OTP หลังสมัคร หรือตอนเข้าสู่ระบบด้วยบัญชีที่ยังไม่ยืนยัน */
export default function VerifyEmailForm({ email, onBack }: VerifyEmailFormProps) {
  const { verifyEmail } = useAuth()
  const { accounts, shops, organizers } = useAppStore()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const account = accounts.find((a) => a.email === normalizeEmail(email))
    const err = verifyEmail(email, code)
    if (err) {
      setError(err)
      return
    }
    if (!account) return
    const { name } = accountProfile(account, shops, organizers)
    toast(
      account.role === 'organizer' && account.status === 'pending'
        ? `ยืนยันอีเมลแล้ว บัญชีผู้จัดงานของคุณรอผู้ดูแลระบบอนุมัติ`
        : `ยืนยันอีเมลแล้ว ยินดีต้อนรับ คุณ${name}`,
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <p className="mt-2 text-sm text-muted">
        เราส่งรหัสยืนยันไปที่ <b className="text-ink">{email}</b> กรอกรหัสเพื่อเปิดใช้งานบัญชี
      </p>
      <OtpField
        email={email}
        purpose="verify"
        value={code}
        onChange={(v) => {
          setCode(v)
          setError('')
        }}
        error={error}
      />
      <div className="mt-6 flex justify-between gap-3">
        <button type="button" onClick={onBack} className="px-4 py-2.5 rounded-xl hover:bg-mist">
          กลับ
        </button>
        <button className="bg-cobalt text-oncobalt rounded-xl px-6 py-2.5 font-semibold press">ยืนยันอีเมล</button>
      </div>
    </form>
  )
}
