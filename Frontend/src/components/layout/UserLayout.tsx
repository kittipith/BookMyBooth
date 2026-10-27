import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router'
import { SELLER_NAV } from '../../data/content'
import { ROLE_HOME } from '../../data/options'
import { SITE } from '../../data/settings'
import { useAuth } from '../../hooks/useAuth'
import { useMyBookings } from '../../queries/bookings'
import type { Account } from '../../types'
import Logo from '../common/Logo'
import AccountMenu from '../popup/AccountMenu'
import OrganizerSignupButton from '../popup/OrganizerSignupButton'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md hover:bg-mist whitespace-nowrap ${isActive ? 'bg-mist' : ''}`

export default function UserLayout() {
  const navigate = useNavigate()
  const { account, openLogin } = useAuth()
  const { data: myBookings = [] } = useMyBookings()
  // รอแนบสลิป + รอผู้จัดงานตรวจ
  const pending = myBookings.filter((b) => b.status === 'awaiting_slip' || b.status === 'pending').length
  const nav = SELLER_NAV.filter((item) => !item.role || item.role === account?.role)
  // ผู้จัดงานและผู้ดูแลระบบที่เข้าสู่ระบบจากหน้านี้ พาไปหน้าของตัวเองเลย
  const goToRoleHome = (a: Account) => a.role !== 'seller' && navigate(ROLE_HOME[a.role])
  // หนึ่งบัญชีหนึ่งบทบาท ผู้จัดงานและผู้ดูแลระบบเปิดหน้าฝั่งผู้ขายไม่ได้
  if (account && account.role !== 'seller') return <Navigate to={ROLE_HOME[account.role]} replace />

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-paper/95 backdrop-blur border-b border-line">
        {/* จอเล็กกว่า sm เมนูลงไปเป็นแถวที่สอง แถวบนเหลือโลโก้กับปุ่มบัญชี */}
        <div className="max-w-7xl mx-auto px-4 sm:px-5 pt-2.5 sm:pt-0 sm:h-16 flex flex-wrap sm:flex-nowrap items-center gap-x-3 sm:gap-x-6">
          <Link to="/" className="flex items-center gap-2.5 shrink-0" aria-label={`${SITE.name} หน้าแรก`}>
            <Logo />
            <span className="font-display text-lg sm:text-xl font-bold tracking-tight">{SITE.name}</span>
          </Link>
          <nav className="order-last sm:order-0 w-full sm:w-auto -mx-3 sm:mx-0 px-0.5 sm:px-0 py-1.5 sm:py-0 flex gap-1 text-[15px] overflow-x-auto" aria-label="เมนูหลัก">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} className={(s) => `${navClass(s)} ${item.hideOnMobile ? 'hidden sm:block' : ''}`}>
                {item.label}
                {item.badge && pending > 0 && (
                  <span className="ml-1 text-xs font-semibold bg-sun text-onsun rounded px-1.5 py-0.5">{pending}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {/* สมัครบัญชีผู้จัดงาน (แยกจากบัญชีผู้ขาย) แสดงเฉพาะผู้ที่ยังไม่เข้าสู่ระบบ */}
            {!account && (
              <OrganizerSignupButton className="hidden md:block whitespace-nowrap text-sm text-muted hover:text-ink underline underline-offset-4 decoration-line" />
            )}
            {account ? (
              <AccountMenu />
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => openLogin({ mode: 'login', onSuccess: goToRoleHome })}
                  className="whitespace-nowrap px-2 sm:px-3 py-1.5 text-sm font-semibold hover:text-cobalt"
                >
                  เข้าสู่ระบบ
                </button>
                <button
                  type="button"
                  onClick={() => openLogin({ mode: 'register', onSuccess: goToRoleHome })}
                  className="whitespace-nowrap bg-cobalt text-oncobalt rounded-lg px-3 sm:px-4 py-1.5 text-sm font-semibold hover:opacity-90"
                >
                  สมัครสมาชิก
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line mt-10">
        <div className="max-w-7xl mx-auto px-5 py-8 flex flex-wrap justify-between gap-4 text-sm text-muted">
          <span>{SITE.footer}</span>
          <span>ติดต่อทีมงาน {SITE.supportEmail}</span>
        </div>
      </footer>
    </div>
  )
}
