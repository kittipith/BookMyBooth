import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import type { SideNavItem } from '../../data/content'
import { SITE } from '../../data/settings'
import { useAccountProfile, useAuth } from '../../hooks/useAuth'
import { initial } from '../../utils/format'
import Logo from '../common/Logo'
import LogoutDialog from '../popup/LogoutDialog'
import NotificationBell from '../popup/NotificationBell'

interface DashboardLayoutProps {
  /** ชื่อส่วน เช่น ผู้จัดงาน หรือ ผู้ดูแลระบบ */
  area: string
  home: string
  nav: SideNavItem[]
  /** ตัวเลขบนเมนูที่ตั้ง badge ไว้ */
  badgeCount: number
}

/** โครงหน้าฝั่งจัดการ (ผู้จัดงานและผู้ดูแลระบบ): แถบเมนูซ้าย กระดิ่งแจ้งเตือน และออกจากระบบ */
export default function DashboardLayout({ area, home, nav, badgeCount }: DashboardLayoutProps) {
  const { account } = useAuth()
  const profile = useAccountProfile()
  const [confirmLogout, setConfirmLogout] = useState(false)

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden lg:flex flex-col sticky top-0 h-screen border-r border-line bg-surface px-4 py-6">
        <div className="flex items-center gap-2 px-2">
          <Link to={home} className="flex items-center gap-2.5 min-w-0">
            <Logo />
            <span className="font-display text-lg font-bold truncate">{SITE.name}</span>
          </Link>
          <span className="ml-auto">
            <NotificationBell align="left" />
          </span>
        </div>
        <p className="px-2 mt-1 text-xs text-muted">{area}</p>
        <nav className="mt-6 flex flex-col gap-1" aria-label={`เมนู${area}`}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `text-left px-3 py-2.5 rounded-lg text-[15px] flex items-center justify-between ${
                  isActive ? 'bg-cobalt text-oncobalt font-semibold' : 'hover:bg-mist'
                }`
              }
            >
              {item.label}
              {item.badge && badgeCount > 0 && (
                <span className="text-xs font-semibold rounded px-1.5 py-0.5 bg-sun text-onsun">{badgeCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-line pt-4 px-2">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 shrink-0 rounded-full bg-cobalt text-oncobalt grid place-items-center font-display font-semibold">
              {initial(profile?.name ?? '')}
            </span>
            <div className="leading-tight min-w-0">
              <p className="text-sm font-semibold truncate">{profile?.name}</p>
              <p className="text-xs text-muted truncate">{profile?.org}</p>
              <p className="text-xs text-muted truncate">{account?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm font-semibold text-danger hover:border-danger/40 hover:bg-danger/5"
          >
            <LogOut className="size-4" aria-hidden="true" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="lg:hidden sticky top-0 z-30 bg-surface border-b border-line">
          <div className="px-5 h-14 flex items-center justify-between gap-3">
            <span className="font-display text-lg font-bold truncate">
              {SITE.name} <span className="text-sm font-normal text-muted">{area}</span>
            </span>
            <div className="flex items-center gap-3 text-sm">
              <NotificationBell />
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-line px-2.5 py-1.5 font-semibold text-danger hover:border-danger/40 hover:bg-danger/5"
              >
                <LogOut className="size-4" aria-hidden="true" />
                ออกจากระบบ
              </button>
            </div>
          </div>
          <nav className="flex gap-1 px-3 pb-2 overflow-x-auto" aria-label={`เมนู${area}`}>
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap px-3 py-1.5 rounded-md text-sm ${isActive ? 'bg-cobalt text-oncobalt font-semibold' : 'hover:bg-mist'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <main className="px-5 sm:px-8 lg:px-12 py-8 lg:py-10 w-full">
          <Outlet />
        </main>
        <LogoutDialog open={confirmLogout} onClose={() => setConfirmLogout(false)} />
      </div>
    </div>
  )
}
