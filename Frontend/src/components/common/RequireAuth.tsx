import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { ROLE_HOME, ROLE_LABEL } from '../../data/options'
import { SITE } from '../../data/settings'
import { useAuth } from '../../hooks/useAuth'
import type { Role } from '../../types'

interface RequireAuthProps {
  role: Role
  children: ReactNode
  /** แสดงเต็มจอ (ใช้กับหน้าที่ไม่มี layout ครอบ เช่น ฝั่งผู้จัดงาน) */
  fullScreen?: boolean
}

/**
 * แสดงเนื้อหาเมื่อเข้าสู่ระบบด้วยบทบาทที่ต้องการ และบัญชีใช้งานได้แล้ว
 * ไม่งั้นแสดงหน้าขอให้เข้าสู่ระบบ (เปิด popup ให้อัตโนมัติ) หรือหน้าสถานะรออนุมัติ/ไม่อนุมัติ
 * บัญชีของบทบาทอื่นถูกพากลับหน้าของตัวเอง
 */
export default function RequireAuth({ role, children, fullScreen = false }: RequireAuthProps) {
  const { account, openLogin, logout } = useAuth()
  const label = ROLE_LABEL[role]
  const signupAllowed = role !== 'admin'

  // เปิด popup ให้เองเฉพาะตอนเข้าหน้านี้มาโดยยังไม่ได้เข้าสู่ระบบ
  // (ตอนกดออกจากระบบจากหน้านี้ ระบบจะพากลับหน้าแรก ไม่ต้องเด้ง popup)
  const [promptOnEnter] = useState(() => !account)
  useEffect(() => {
    if (promptOnEnter) openLogin({ role, message: `หน้านี้สำหรับ${label} เข้าสู่ระบบเพื่อดำเนินการต่อ` })
  }, [promptOnEnter, role, label, openLogin])

  if (account?.role === role && account.status === 'active') return children
  // หนึ่งบัญชีหนึ่งบทบาท บัญชีของบทบาทอื่นพากลับหน้าของตัวเอง
  if (account && account.role !== role) return <Navigate to={ROLE_HOME[account.role]} replace />

  const shell = (title: string, text: ReactNode, actions: ReactNode) => (
    <section className={`px-5 text-center grid place-items-center ${fullScreen ? 'min-h-screen' : 'py-24'}`}>
      <div className="max-w-md">
        <p className="font-display text-sm font-semibold text-cobalt">
          {SITE.name} สำหรับ{label}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">{title}</h1>
        <div className="mt-2 text-muted">{text}</div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {actions}
          {/* บัญชีผู้จัดงานเปิดหน้าฝั่งผู้ขายไม่ได้ จึงมีแค่ปุ่มออกจากระบบ */}
          {!account && (
            <Link to="/" className="border-[1.5px] border-cobalt text-cobalt rounded-xl px-5 py-3 font-semibold hover:bg-cobalt/5">
              กลับหน้าแรก
            </Link>
          )}
        </div>
      </div>
    </section>
  )

  const logoutButton = (
    <button type="button" onClick={logout} className="bg-cobalt text-oncobalt rounded-xl px-5 py-3 font-semibold press">
      ออกจากระบบ
    </button>
  )

  // บัญชีถูกต้องแต่ยังใช้งานไม่ได้
  if (account?.status === 'pending') {
    return shell(
      'รอผู้ดูแลระบบอนุมัติ',
      <p>บัญชีผู้จัดงาน {account.email} สมัครเรียบร้อยแล้ว ผู้ดูแลระบบจะตรวจสอบและแจ้งผลในเว็บ เมื่ออนุมัติแล้วหน้านี้จะเปิดใช้งานได้ทันที</p>,
      logoutButton,
    )
  }
  if (account?.status === 'rejected') {
    return shell(
      'บัญชีไม่ได้รับอนุมัติ',
      <>
        <p>ผู้ดูแลระบบไม่อนุมัติบัญชีผู้จัดงานนี้</p>
        {account.statusReason && <p className="mt-2 text-danger">เหตุผล: {account.statusReason}</p>}
        <p className="mt-2">สอบถามเพิ่มเติมได้ที่ {SITE.supportEmail}</p>
      </>,
      logoutButton,
    )
  }

  return shell(
    'เข้าสู่ระบบก่อนใช้งาน',
    <p>หน้านี้ใช้ได้เฉพาะ{label}ที่เข้าสู่ระบบแล้ว</p>,
    <>
      <button type="button" onClick={() => openLogin({ role })} className="bg-cobalt text-oncobalt rounded-xl px-5 py-3 font-semibold press">
        เข้าสู่ระบบ
      </button>
      {signupAllowed && (
        <button
          type="button"
          onClick={() => openLogin({ role, mode: 'register' })}
          className="border-[1.5px] border-cobalt text-cobalt rounded-xl px-5 py-3 font-semibold hover:bg-cobalt/5"
        >
          สมัครเป็น{label}
        </button>
      )}
    </>,
  )
}
