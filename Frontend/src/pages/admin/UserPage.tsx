import { useState } from 'react'
import Chip from '../../components/common/Chip'
import { AccountStatusBadge } from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/popup/ConfirmDialog'
import ReasonDialog from '../../components/popup/ReasonDialog'
import { ROLE_LABEL, SUSPEND_REASONS } from '../../data/options'
import { useAppStore } from '../../hooks/useAppStore'
import { useToast } from '../../hooks/useToast'
import { accountProfile } from '../../services/auth'
import type { Account, Role } from '../../types'
import { dateTimeLabel } from '../../utils/format'

type RoleTab = Role | 'all'
const ROLE_TABS: RoleTab[] = ['all', 'seller', 'organizer', 'admin']

/** ผู้ดูแลระบบดูผู้ใช้ทั้งหมด และระงับบัญชีที่ทำผิดกฎ */
export default function UsersPage() {
  const { accounts, shops, organizers, setSuspended } = useAppStore()
  const toast = useToast()
  const [role, setRole] = useState<RoleTab>('all')
  const [q, setQ] = useState('')
  const [suspending, setSuspending] = useState<Account | null>(null)
  const [restoring, setRestoring] = useState<Account | null>(null)

  const rows = accounts
    .map((a) => ({ account: a, ...accountProfile(a, shops, organizers) }))
    .filter(({ account, name, org }) => {
      const keyword = q.trim().toLowerCase()
      return (role === 'all' || account.role === role) && (!keyword || `${name} ${org} ${account.email}`.toLowerCase().includes(keyword))
    })
    .sort((a, b) => b.account.createdAt.localeCompare(a.account.createdAt))
  const nameOf = (a: Account) => accountProfile(a, shops, organizers).name

  return (
    <section>
      <h1 className="font-display text-4xl font-bold">ผู้ใช้ทั้งหมด</h1>
      <p className="mt-1 text-muted">ระงับบัญชีที่ทำผิดกฎ บัญชีที่ถูกระงับจะเข้าสู่ระบบไม่ได้</p>

      <div className="mt-6 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2" role="tablist">
          {ROLE_TABS.map((r) => (
            <Chip key={r} role="tab" pressed={role === r} onClick={() => setRole(r)}>
              {r === 'all' ? 'ทั้งหมด' : ROLE_LABEL[r]}{' '}
              <span className="opacity-60">{r === 'all' ? accounts.length : accounts.filter((a) => a.role === r).length}</span>
            </Chip>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} className="fld text-sm sm:w-64!" placeholder="ค้นหาชื่อ ร้าน หรืออีเมล" />
      </div>

      <div className="mt-5 bg-surface border border-line rounded-2xl relative overflow-x-auto">
        <table className="w-full text-left min-w-[820px]">
          <thead className="text-sm text-muted border-b border-line">
            <tr>
              <th className="font-medium px-6 py-3">ผู้ใช้</th>
              <th className="font-medium px-4 py-3">บทบาท</th>
              <th className="font-medium px-4 py-3">สมัครเมื่อ</th>
              <th className="font-medium px-4 py-3">สถานะ</th>
              <th className="px-6 py-3">
                <span className="sr-only">จัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ account: a, name, org }) => (
              <tr key={a.id}>
                <td className="px-6 py-4">
                  <p className="font-semibold">
                    {name} <span className="font-normal text-muted">· {org}</span>
                  </p>
                  <p className="text-sm text-muted">{a.email}</p>
                </td>
                <td className="px-4 py-4 text-sm">{ROLE_LABEL[a.role]}</td>
                <td className="px-4 py-4 text-sm">
                  {dateTimeLabel(a.createdAt)}
                  {!a.emailVerified && <p className="text-xs text-danger">ยังไม่ยืนยันอีเมล</p>}
                </td>
                <td className="px-4 py-4">
                  <AccountStatusBadge status={a.status} />
                  {a.statusReason && <p className="mt-1 text-xs text-muted max-w-48">{a.statusReason}</p>}
                </td>
                <td className="px-6 py-4 text-right whitespace-nowrap">
                  {a.role !== 'admin' && a.status !== 'suspended' && (
                    <button
                      type="button"
                      onClick={() => setSuspending(a)}
                      className="border border-line rounded-lg px-3 py-1.5 text-sm hover:border-danger hover:text-danger"
                    >
                      ระงับบัญชี
                    </button>
                  )}
                  {a.status === 'suspended' && (
                    <button type="button" onClick={() => setRestoring(a)} className="text-sm text-cobalt font-semibold hover:underline underline-offset-4">
                      ยกเลิกการระงับ
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-6 py-14 text-center text-muted">
                  ไม่พบผู้ใช้ที่ค้นหา
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ReasonDialog
        open={!!suspending}
        title="ระงับบัญชี"
        description={suspending ? `${nameOf(suspending)} (${suspending.email}) จะเข้าสู่ระบบไม่ได้จนกว่าจะยกเลิกการระงับ` : ''}
        reasons={SUSPEND_REASONS}
        confirmLabel="ระงับบัญชี"
        onClose={() => setSuspending(null)}
        onConfirm={(reason) => {
          if (suspending) {
            setSuspended(suspending.id, true, reason)
            toast(`ระงับบัญชี ${suspending.email} แล้ว`)
          }
          setSuspending(null)
        }}
      />
      <ConfirmDialog
        open={!!restoring}
        title="ยกเลิกการระงับ"
        message={restoring ? `${nameOf(restoring)} (${restoring.email}) จะกลับมาเข้าสู่ระบบได้ตามปกติ` : ''}
        confirmLabel="ยกเลิกการระงับ"
        onClose={() => setRestoring(null)}
        onConfirm={() => {
          if (restoring) {
            setSuspended(restoring.id, false)
            toast(`ยกเลิกการระงับ ${restoring.email} แล้ว`)
          }
          setRestoring(null)
        }}
      />
    </section>
  )
}
