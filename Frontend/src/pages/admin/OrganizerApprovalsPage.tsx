import { useState } from 'react'
import Chip from '../../components/common/Chip'
import { AccountStatusBadge } from '../../components/common/StatusBadge'
import ReasonDialog from '../../components/popup/ReasonDialog'
import { ACCOUNT_STATUS_LABEL, ORGANIZER_REJECT_REASONS } from '../../data/options'
import type { UserDto } from '../../api/dto'
import { accountStatusFromDto } from '../../api/mappers'
import { useToast } from '../../hooks/useToast'
import { useAdminEvents, useAdminUsers, useReviewOrganizer } from '../../queries/admin'
import type { AccountStatus } from '../../types'
import { dateTimeLabel } from '../../utils/format'

type Tab = AccountStatus | 'all'
const TABS: Tab[] = ['pending', 'active', 'rejected', 'suspended', 'all']

/** ผู้ดูแลระบบตรวจและอนุมัติผู้สมัครเป็นผู้จัดงาน */
export default function OrganizerApprovalsPage() {
  const { data: users = [], isPending, isError } = useAdminUsers()
  const { data: events = [] } = useAdminEvents()
  const review = useReviewOrganizer()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('pending')
  const [rejecting, setRejecting] = useState<UserDto | null>(null)

  const statusOf = (u: UserDto) => accountStatusFromDto(u.status)
  const orgAccounts = users.filter((u) => u.role === 'ORGANIZER').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const count = (t: Tab) => (t === 'all' ? orgAccounts.length : orgAccounts.filter((u) => statusOf(u) === t).length)
  const rows = tab === 'all' ? orgAccounts : orgAccounts.filter((u) => statusOf(u) === tab)
  const nameOf = (u: UserDto) => u.orgName || u.email

  const stats = [
    { label: 'ผู้ใช้ทั้งหมด', value: users.length },
    { label: 'ผู้ขาย', value: users.filter((u) => u.role === 'SELLER').length },
    { label: 'ผู้จัดงานที่ใช้งานได้', value: orgAccounts.filter((u) => u.status === 'ACTIVE').length },
    { label: 'งานในระบบ', value: events.filter((e) => e.event.publishStatus !== 'draft').length },
    // การจองที่ยังถือล็อกอยู่ (รอสลิป รอตรวจ อนุมัติแล้ว)
    { label: 'การจองที่ใช้งานอยู่', value: events.reduce((sum, e) => sum + e.bookingCount, 0) },
  ]

  const approve = (u: UserDto) =>
    review.mutate({ userId: u.userId, approve: true }, { onSuccess: () => toast(`อนุมัติ ${nameOf(u)} เป็นผู้จัดงานแล้ว`) })

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
            {rows.map((u) => {
              const status = statusOf(u)
              return (
                <tr key={u.userId}>
                  <td className="px-6 py-4">
                    <p className="font-semibold">{u.orgName || '-'}</p>
                    <p className="text-sm text-muted">{u.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p>{u.displayName || '-'}</p>
                    <p className="text-sm text-muted">{u.phone || '-'}</p>
                  </td>
                  <td className="px-4 py-4 text-sm">{dateTimeLabel(u.createdAt)}</td>
                  <td className="px-4 py-4">
                    <AccountStatusBadge status={status} />
                    {u.statusReason && <p className="mt-1 text-xs text-muted max-w-48">{u.statusReason}</p>}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    {status === 'pending' && (
                      <>
                        <button
                          type="button"
                          disabled={review.isPending}
                          onClick={() => approve(u)}
                          className="bg-cobalt text-oncobalt rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          อนุมัติ
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(u)}
                          className="ml-2 border border-line rounded-lg px-3 py-1.5 text-sm hover:border-danger hover:text-danger"
                        >
                          ไม่อนุมัติ
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-6 py-14 text-center text-muted">
                  {isPending ? 'กำลังโหลด…' : isError ? 'โหลดรายชื่อไม่ได้' : tab === 'pending' ? 'ไม่มีผู้สมัครที่รออนุมัติ' : 'ไม่มีบัญชีในหมวดนี้'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ReasonDialog
        open={!!rejecting}
        title="ไม่อนุมัติผู้จัดงาน"
        description={rejecting ? `${nameOf(rejecting)} จะได้รับแจ้งเหตุผลนี้ในเว็บ` : ''}
        reasons={ORGANIZER_REJECT_REASONS}
        confirmLabel="ไม่อนุมัติ"
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => {
          if (!rejecting || review.isPending) return
          const target = rejecting
          review.mutate(
            { userId: target.userId, approve: false, reason },
            {
              onSuccess: () => {
                toast(`ไม่อนุมัติ ${nameOf(target)} แล้ว`)
                setRejecting(null)
              },
            },
          )
        }}
      />
    </section>
  )
}
