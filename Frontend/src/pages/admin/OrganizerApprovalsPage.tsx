import { useState } from 'react'
import Chip from '../../components/common/Chip'
import { AccountStatusBadge } from '../../components/common/StatusBadge'
import ReasonDialog from '../../components/popup/ReasonDialog'
import { ACCOUNT_STATUS_LABEL, ORGANIZER_REJECT_REASONS } from '../../data/options'
import { useAppStore } from '../../hooks/useAppStore'
import { useToast } from '../../hooks/useToast'
import type { Account, AccountStatus } from '../../types'
import { dateTimeLabel } from '../../utils/format'

type Tab = AccountStatus | 'all'
const TABS: Tab[] = ['pending', 'active', 'rejected', 'suspended', 'all']

/** ผู้ดูแลระบบตรวจและอนุมัติผู้สมัครเป็นผู้จัดงาน */
export default function OrganizerApprovalsPage() {
  const { accounts, organizers, events, bookings, reviewOrganizer } = useAppStore()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('pending')
  const [rejecting, setRejecting] = useState<Account | null>(null)

  const orgAccounts = accounts
    .filter((a) => a.role === 'organizer')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const count = (t: Tab) => (t === 'all' ? orgAccounts.length : orgAccounts.filter((a) => a.status === t).length)
  const rows = tab === 'all' ? orgAccounts : orgAccounts.filter((a) => a.status === tab)
  const orgOf = (a: Account) => organizers.find((o) => o.id === a.organizerId)

  const stats = [
    { label: 'ผู้ใช้ทั้งหมด', value: accounts.length },
    { label: 'ผู้ขาย', value: accounts.filter((a) => a.role === 'seller').length },
    { label: 'ผู้จัดงานที่ใช้งานได้', value: accounts.filter((a) => a.role === 'organizer' && a.status === 'active').length },
    { label: 'งานในระบบ', value: events.filter((e) => e.status !== 'draft').length },
    { label: 'การจองทั้งหมด', value: bookings.length },
  ]

  const approve = (a: Account) => {
    reviewOrganizer(a.id, true)
    toast(`อนุมัติ ${orgOf(a)?.name ?? a.email} เป็นผู้จัดงานแล้ว`)
  }

  return (
    <section>
      <h1 className="font-display text-4xl font-bold">อนุมัติผู้จัดงาน</h1>
      <p className="mt-1 text-muted">ผู้ที่สมัครเป็นผู้จัดงานต้องได้รับอนุมัติก่อนสร้างงานได้</p>

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface border border-line rounded-2xl p-5">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="font-display text-3xl font-bold mt-1">{s.value.toLocaleString('en-US')}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <Chip key={t} role="tab" pressed={tab === t} onClick={() => setTab(t)}>
            {t === 'all' ? 'ทั้งหมด' : ACCOUNT_STATUS_LABEL[t]} <span className="opacity-60">{count(t)}</span>
          </Chip>
        ))}
      </div>

      <div className="mt-5 bg-surface border border-line rounded-2xl relative overflow-x-auto">
        <table className="w-full text-left min-w-[820px]">
          <thead className="text-sm text-muted border-b border-line">
            <tr>
              <th className="font-medium px-6 py-3">องค์กร</th>
              <th className="font-medium px-4 py-3">ผู้ติดต่อ</th>
              <th className="font-medium px-4 py-3">สมัครเมื่อ</th>
              <th className="font-medium px-4 py-3">สถานะ</th>
              <th className="px-6 py-3">
                <span className="sr-only">จัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((a) => {
              const org = orgOf(a)
              return (
                <tr key={a.id}>
                  <td className="px-6 py-4">
                    <p className="font-semibold">{org?.name ?? '-'}</p>
                    <p className="text-sm text-muted">{a.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p>{org?.contactName ?? '-'}</p>
                    <p className="text-sm text-muted">{org?.phone ?? '-'}</p>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {dateTimeLabel(a.createdAt)}
                    {!a.emailVerified && <p className="text-xs text-danger">ยังไม่ยืนยันอีเมล</p>}
                  </td>
                  <td className="px-4 py-4">
                    <AccountStatusBadge status={a.status} />
                    {a.statusReason && <p className="mt-1 text-xs text-muted max-w-48">{a.statusReason}</p>}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    {a.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          disabled={!a.emailVerified}
                          title={a.emailVerified ? undefined : 'รอผู้สมัครยืนยันอีเมลก่อน'}
                          onClick={() => approve(a)}
                          className="bg-cobalt text-oncobalt rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          อนุมัติ
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(a)}
                          className="ml-2 border border-line rounded-lg px-3 py-1.5 text-sm hover:border-danger hover:text-danger"
                        >
                          ไม่อนุมัติ
                        </button>
                      </>
                    )}
                    {a.status === 'rejected' && (
                      <button type="button" onClick={() => approve(a)} className="text-sm text-cobalt font-semibold hover:underline underline-offset-4">
                        อนุมัติแทน
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-6 py-14 text-center text-muted">
                  {tab === 'pending' ? 'ไม่มีผู้สมัครที่รออนุมัติ' : 'ไม่มีบัญชีในหมวดนี้'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ReasonDialog
        open={!!rejecting}
        title="ไม่อนุมัติผู้จัดงาน"
        description={rejecting ? `${orgOf(rejecting)?.name ?? rejecting.email} จะได้รับแจ้งเหตุผลนี้ในเว็บ` : ''}
        reasons={ORGANIZER_REJECT_REASONS}
        confirmLabel="ไม่อนุมัติ"
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => {
          if (rejecting) {
            reviewOrganizer(rejecting.id, false, reason)
            toast(`ไม่อนุมัติ ${orgOf(rejecting)?.name ?? rejecting.email} แล้ว`)
          }
          setRejecting(null)
        }}
      />
    </section>
  )
}
