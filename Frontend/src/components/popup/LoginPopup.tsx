import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { LoginRequest } from '../../store/authContext'
import ForgotPasswordForm from './ForgotPasswordForm'
import LoginForm from './LoginForm'
import Modal from './Modal'
import RegisterForm from './RegisterForm'
import VerifyEmailForm from './VerifyEmailForm'

type Step = { mode: 'login' } | { mode: 'register' } | { mode: 'forgot' } | { mode: 'verify'; email: string }

const TABS = [
  { mode: 'login', label: 'เข้าสู่ระบบ' },
  { mode: 'register', label: 'สมัครสมาชิก' },
] as const

const TITLE: Record<Step['mode'], string> = {
  login: 'บัญชีของคุณ',
  register: 'บัญชีของคุณ',
  forgot: 'ลืมรหัสผ่าน',
  verify: 'ยืนยันอีเมล',
}

/** popup เข้าสู่ระบบ สมัครสมาชิก ยืนยันอีเมล และลืมรหัสผ่าน เปิดได้จากทุกหน้าผ่าน useAuth().openLogin() */
export default function LoginPopup() {
  const { loginRequest, closeLogin } = useAuth()
  return (
    <Modal open={!!loginRequest} onClose={closeLogin} title={null} className="w-[460px] max-h-[calc(100vh-2rem)] overflow-y-auto">
      {loginRequest && <AuthSteps request={loginRequest} />}
    </Modal>
  )
}

function AuthSteps({ request }: { request: LoginRequest }) {
  const [step, setStep] = useState<Step>({ mode: request.mode ?? 'login' } as Step)
  const toVerify = (email: string) => setStep({ mode: 'verify', email })
  const tabbed = step.mode === 'login' || step.mode === 'register'

  return (
    <>
      <h2 className="font-display text-xl font-semibold">{TITLE[step.mode]}</h2>
      {tabbed && (
        <div className="mt-4 grid grid-cols-2 gap-1 bg-mist rounded-xl p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.mode}
              type="button"
              role="tab"
              aria-selected={step.mode === t.mode}
              onClick={() => setStep({ mode: t.mode })}
              className={`rounded-lg py-2 text-sm font-semibold ${step.mode === t.mode ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {tabbed && request.message && <p className="mt-4 text-sm bg-sun/30 rounded-lg px-3 py-2">{request.message}</p>}

      {step.mode === 'login' && (
        <LoginForm onRegister={() => setStep({ mode: 'register' })} onForgot={() => setStep({ mode: 'forgot' })} onNeedVerify={toVerify} />
      )}
      {step.mode === 'register' && (
        <RegisterForm lockedRole={request.role === 'admin' ? undefined : request.role} onLogin={() => setStep({ mode: 'login' })} onRegistered={toVerify} />
      )}
      {step.mode === 'verify' && <VerifyEmailForm email={step.email} onBack={() => setStep({ mode: 'login' })} />}
      {step.mode === 'forgot' && <ForgotPasswordForm onDone={() => setStep({ mode: 'login' })} />}
    </>
  )
}
