import { useEffect, useState } from 'react'
import { AUTH_RULES } from '../../data/settings'
import { useAuth } from '../../hooks/useAuth'
import type { OtpPurpose } from '../../store/authContext'

interface OtpFieldProps {
  email: string
  purpose: OtpPurpose
  value: string
  onChange: (value: string) => void
  error?: string
}

/** ช่องกรอกรหัสยืนยันจากอีเมล พร้อมปุ่มส่งรหัสใหม่ (เว้นระยะกันส่งถี่เกิน) */
export default function OtpField({ email, purpose, value, onChange, error }: OtpFieldProps) {
  const { sendOtp, authMode } = useAuth()
  // เพิ่งส่งรหัสไปตอนเปิดฟอร์มนี้ จึงเริ่มนับถอยหลังทันที
  const [resendAt, setResendAt] = useState(() => Date.now() + AUTH_RULES.resendSeconds * 1000)
  const [now, setNow] = useState(() => Date.now())
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000))

  const resend = async () => {
    setSending(true)
    const err = await sendOtp(email, purpose)
    setSending(false)
    setNotice(err ?? 'ส่งรหัสใหม่แล้ว ตรวจสอบอีเมล (รวมถึงโฟลเดอร์สแปม)')
    if (!err) setResendAt(Date.now() + AUTH_RULES.resendSeconds * 1000)
  }

  return (
    <>
      <label className="mt-5 block">
        <span className="text-sm font-semibold">รหัสยืนยัน {AUTH_RULES.otpLength} หลัก</span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={AUTH_RULES.otpLength}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          aria-invalid={!!error}
          className={`mt-2 w-full bg-surface border rounded-lg px-3 py-3 outline-none focus:border-cobalt font-display text-2xl tracking-[0.5em] text-center ${
            error ? 'border-danger' : 'border-line'
          }`}
        />
        {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
      </label>
      <div className="mt-2 flex justify-between text-sm text-muted">
        <span>{notice || 'ยังไม่ได้รับรหัส?'}</span>
        <button
          type="button"
          onClick={resend}
          disabled={wait > 0 || sending}
          className="text-cobalt font-semibold hover:underline underline-offset-4 disabled:text-muted disabled:no-underline"
        >
          {sending ? 'กำลังส่ง…' : wait > 0 ? `ส่งรหัสใหม่ได้ใน ${wait} วิ` : 'ส่งรหัสใหม่'}
        </button>
      </div>
      {authMode === 'dev' && (
        <p className="mt-4 text-sm bg-mist rounded-lg px-3 py-2">โหมดทดลอง (API จำลอง) ไม่มีอีเมลจริง กรอกตัวเลขอะไรก็ได้ {AUTH_RULES.otpLength} หลัก</p>
      )}
    </>
  )
}
