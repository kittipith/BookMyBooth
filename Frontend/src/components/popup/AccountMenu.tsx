import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ACCOUNT_MENU } from '../../data/content'
import { ROLE_LABEL } from '../../data/options'
import { useAccountProfile, useAuth } from '../../hooks/useAuth'
import { initial } from '../../utils/format'
import LogoutDialog from './LogoutDialog'

/** ปุ่มรูปโปรไฟล์มุมขวาบน กดแล้วเปิดเมนูบัญชี (ปิดได้ด้วย Esc หรือคลิกข้างนอก) */
export default function AccountMenu() {
  const { account } = useAuth()
  const profile = useAccountProfile()
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!account || !profile) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`บัญชี ${profile.name}`}
        className="w-9 h-9 rounded-full bg-cobalt text-oncobalt font-display font-semibold grid place-items-center"
      >
        {initial(profile.name)}
      </button>
      {open && (
        <div
          role="menu"
          className="toast-in absolute right-0 top-full mt-2 z-40 w-64 bg-surface border border-line rounded-2xl shadow-[0_24px_60px_-20px_rgb(16_28_64/.35)] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-line">
            <p className="font-semibold truncate">{profile.name}</p>
            <p className="text-sm text-muted truncate">{profile.org}</p>
            <p className="mt-1 text-xs text-muted truncate">
              {ROLE_LABEL[account.role]} · {account.email}
            </p>
          </div>
          <div className="py-1">
            {ACCOUNT_MENU[account.role].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-[15px] hover:bg-mist"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setConfirmLogout(true)
            }}
            className="w-full text-left px-4 py-3 text-[15px] text-danger border-t border-line hover:bg-mist"
          >
            ออกจากระบบ
          </button>
        </div>
      )}
      <LogoutDialog open={confirmLogout} onClose={() => setConfirmLogout(false)} />
    </div>
  )
}

