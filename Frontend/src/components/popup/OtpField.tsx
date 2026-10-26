import { useEffect, useState } from 'react'
import { AUTH_RULES, SHOW_OTP_ON_SCREEN } from '../../data/settings'
import { useAuth } from '../../hooks/useAuth'
import type { OtpPurpose } from '../../store/authContext'

interface OtpFieldProps {
  email: string
  purpose: OtpPurpose
  value: string
  onChange: (value: string) => void
  error?: string
}

/** ช่องกรอกรหัส OTP พร้อมปุ่มส่งรหัสใหม่ (นับถอยหลัง) และกล่องแสดงรหัสในโหมดทดลอง */
export default function OtpField({ email, purpose, value, onChange, error }: OtpFieldProps) {
  const { sendOtp, lastOtp } = useAuth()
  const ticket = lastOtp(email, purpose)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const left = ticket ? Math.max(0, Math.ceil((ticket.expiresAt - now) / 1000)) : 0
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

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
        <span>{left > 0 ? `รหัสหมดอายุใน ${mm}:${ss}` : 'รหัสหมดอายุแล้ว'}</span>
        <button type="button" onClick={() => sendOtp(email, purpose)} className="text-cobalt font-semibold hover:underline underline-offset-4">
          ส่งรหัสใหม่
        </button>
      </div>
      {SHOW_OTP_ON_SCREEN && ticket && (
        <p className="mt-4 text-sm bg-mist rounded-lg px-3 py-2">
          โหมดทดลอง ยังไม่ได้เชื่อมระบบส่งอีเมล รหัสที่ส่งไปคือ <b className="font-display tracking-widest">{ticket.code}</b>
        </p>
      )}
    </>
  )
}
