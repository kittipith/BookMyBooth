import { useState } from 'react'

interface PasswordInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  error?: string
  hint?: string
}

/** ช่องรหัสผ่านพร้อมปุ่มแสดง/ซ่อน ใช้ในฟอร์มเข้าสู่ระบบและสมัครสมาชิก */
export default function PasswordInput({ label, value, onChange, autoComplete, error, hint }: PasswordInputProps) {
  const [show, setShow] = useState(false)
  return (
    <label className="mt-4 block">
      <span className="text-sm font-semibold flex justify-between">
        {label}
        <button type="button" onClick={() => setShow((s) => !s)} className="font-normal text-muted underline underline-offset-4">
          {show ? 'ซ่อน' : 'แสดง'}
        </button>
      </span>
      <input
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={`mt-2 w-full bg-surface border rounded-lg px-3 py-2.5 outline-none focus:border-cobalt ${error ? 'border-danger' : 'border-line'}`}
      />
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}
