import { useNavigate } from 'react-router'
import { ORGANIZER_SIGNUP_MESSAGE } from '../../data/content'
import { ROLE_HOME } from '../../data/options'
import { useAuth } from '../../hooks/useAuth'

/** เปิด popup สมัครบัญชีผู้จัดงาน (บัญชีแยกจากผู้ขาย) สมัครและยืนยันอีเมลแล้วพาไปหน้าผู้จัดงาน */
export default function OrganizerSignupButton({ className }: { className?: string }) {
  const { openLogin } = useAuth()
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() =>
        openLogin({
          role: 'organizer',
          mode: 'register',
          message: ORGANIZER_SIGNUP_MESSAGE,
          onSuccess: (a) => a.role !== 'seller' && navigate(ROLE_HOME[a.role]),
        })
      }
      className={className}
    >
      สมัครเป็นผู้จัดงาน
    </button>
  )
}
