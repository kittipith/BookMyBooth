import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import OtpField from './OtpField'

interface VerifyEmailFormProps {
  email: string
  onBack: () => void
}

/** ยืนยันอีเมลด้วยรหัสหลังสมัคร หรือตอนเข้าสู่ระบบด้วยบัญชีที่ยังไม่ยืนยัน */
export default function VerifyEmailForm({ email, onBack }: VerifyEmailFormProps) {
  const { verifyEmail } = useAuth()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const result = await verifyEmail(email, code)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (!result.signedIn) {
      toast('ยืนยันอีเมลแล้ว เข้าสู่ระบบด้วยอีเมลและรหัสผ่านได้เลย')
      onBack()
      return
    }
    // บัญชีผู้จัดงานใหม่จะเห็นหน้ารออนุมัติเอง (RequireAuth)
    toast(`ยืนยันอีเมลแล้ว ยินดีต้อนรับ คุณ${result.name ?? ''}`)
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
        <button disabled={busy} className="bg-cobalt text-oncobalt rounded-xl px-6 py-2.5 font-semibold press disabled:opacity-60">
          {busy ? 'กำลังยืนยัน…' : 'ยืนยันอีเมล'}
        </button>
      </div>
    </form>
  )
}
