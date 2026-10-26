import { useCallback, useState, type MouseEvent } from 'react'
import { useSearchParams } from 'react-router'
import BookingDrawer from '../../components/popup/BookingDrawer'
import BookingReasonDialog from '../../components/popup/BookingReasonDialog'
import Chip from '../../components/common/Chip'
import { BookingStatusBadge } from '../../components/common/StatusBadge'
import { BOOKING_STATUS_LABEL } from '../../data/options'
import { useAppStore, useOrganizerData } from '../../hooks/useAppStore'
import { useBookingDecisions } from '../../hooks/useBookingDecisions'
import { byNewest } from '../../services/selectors'
import type { Booking, BookingStatus } from '../../types'
import { baht, dateTimeLabel, fullTitle } from '../../utils/format'
import SelectBox from '../../components/common/SelectBox'

type Tab = BookingStatus | 'all'
const TABS: Tab[] = ['pending', 'approved', 'rejected', 'cancelled', 'all']

export default function BookingsPage() {
  const [params, setParams] = useSearchParams()
  const { shops } = useAppStore()
  const { myEvents, myBookings } = useOrganizerData()
  const { approve, approveMany, reject, cancel } = useBookingDecisions()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejecting, setRejecting] = useState<Booking | null>(null)
  const [cancelling, setCancelling] = useState<Booking | null>(null)

  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'pending') as Tab
  const eventFilter = params.get('event') ?? ''
  const q = params.get('q') ?? ''
  const openId = params.get('id')

  const update = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p)
          Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const keyword = q.trim().toLowerCase()
  const scoped = myBookings.filter(
    (b) =>
      (!eventFilter || b.eventId === eventFilter) &&
      (!keyword || b.shopName.toLowerCase().includes(keyword) || b.lot.toLowerCase().includes(keyword)),
  )
  const count = (t: Tab) => (t === 'all' ? scoped.length : scoped.filter((b) => b.status === t).length)
  const rows = (tab === 'all' ? scoped : scoped.filter((b) => b.status === tab)).sort(byNewest)
  const pendingRows = rows.filter((b) => b.status === 'pending')
  const chosen = pendingRows.filter((b) => selected.has(b.id))
  const allChecked = pendingRows.length > 0 && chosen.length === pendingRows.length

  const eventOf = (b: Booking) => myEvents.find((e) => e.id === b.eventId)
  const open = openId ? myBookings.find((b) => b.id === openId) : undefined
  const openEvent = open && eventOf(open)
  const closeDrawer = useCallback(() => update({ id: null }), [update])

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const onRowClick = (e: MouseEvent, b: Booking) => {
    if ((e.target as HTMLElement).closest('button, input, label')) return
    update({ id: b.id })
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-bold">การจอง</h1>
        {chosen.length > 0 && (
          <button
            type="button"
            onClick={() => {
              approveMany(chosen)
              setSelected(new Set())
            }}
            className="bg-cobalt text-oncobalt rounded-xl px-5 py-3 font-semibold press"
          >
            อนุมัติที่เลือก {chosen.length} รายการ
          </button>
        )}
      </div>

      {/* ซ้าย: กรองตามงาน (กล่องกว้างตามชื่อที่เลือก) และช่องค้นหา · ขวา: กรองตามสถานะ */}
      <div className="mt-6 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SelectBox
            value={eventFilter}
            onChange={(event) => update({ event })}
            options={[
              { value: '', label: 'ทุกงาน' },
              ...myEvents.filter((e) => e.status !== 'draft').map((e) => ({ value: e.id, label: fullTitle(e) })),
            ]}
            className="w-auto max-w-full text-sm!"
            aria-label="กรองตามงาน"
          />
          <input
            value={q}
            onChange={(e) => update({ q: e.target.value })}
            className="fld text-sm w-full sm:w-56!"
            placeholder="ค้นหาร้านหรือรหัสล็อก"
            aria-label="ค้นหาร้านหรือรหัสล็อก"
          />
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2" role="tablist">
          {TABS.map((t) => (
            <Chip key={t} role="tab" pressed={tab === t} onClick={() => update({ tab: t })}>
              {t === 'all' ? 'ทั้งหมด' : BOOKING_STATUS_LABEL[t]} <span className="opacity-60">{count(t)}</span>
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-5 bg-surface border border-line rounded-2xl relative overflow-x-auto">
        <table className="w-full text-left min-w-[900px] text-[15px]">
          <thead className="text-sm text-muted border-b border-line">
            <tr>
              <th className="px-5 py-3 w-10">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={allChecked}
                  disabled={!pendingRows.length}
                  onChange={() => setSelected(allChecked ? new Set() : new Set(pendingRows.map((b) => b.id)))}
                  aria-label="เลือกทั้งหมดที่รออนุมัติ"
                />
              </th>
              <th className="font-medium py-3 pr-4">ล็อก</th>
              <th className="font-medium py-3 pr-4">ร้าน</th>
              <th className="font-medium py-3 pr-4">งานและวัน</th>
              <th className="font-medium py-3 pr-4 text-right">ยอด</th>
              <th className="font-medium py-3 pr-4">สถานะ</th>
              <th className="py-3 pr-5">
                <span className="sr-only">จัดการ</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((b) => {
              const event = eventOf(b)
              return (
                <tr key={b.id} className="hover:bg-mist/50 cursor-pointer" onClick={(e) => onRowClick(e, b)}>
                  <td className="px-5 py-4">
                    {b.status === 'pending' && (
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={selected.has(b.id)}
                        onChange={() => toggle(b.id)}
                        aria-label={`เลือก ${b.shopName}`}
                      />
                    )}
                  </td>
                  <td className="py-4 pr-4 font-display text-xl font-bold">{b.lot}</td>
                  <td className="py-4 pr-4">
                    <p className="font-semibold">{b.shopName}</p>
                    <p className="text-sm text-muted">
                      {b.category} · {dateTimeLabel(b.submittedAt)}
                    </p>
                  </td>
                  <td className="py-4 pr-4">
                    <p className="text-sm">{event && fullTitle(event)}</p>
                    <p className="text-sm text-muted">{b.days.map((d) => event?.days[d]?.label).join(', ')}</p>
                  </td>
                  <td className="py-4 pr-4 text-right font-display font-semibold">
                    {baht(b.amount)}
                    {b.slipAmount !== b.amount && <p className="font-body text-xs font-normal text-danger">สลิปไม่ตรง</p>}
                  </td>
                  <td className="py-4 pr-4">
                    <BookingStatusBadge status={b.status} />
                  </td>
                  <td className="py-4 pr-5 text-right whitespace-nowrap">
                    {b.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => approve(b)}
                          className="bg-cobalt text-oncobalt rounded-lg px-3 py-1.5 text-sm font-semibold"
                        >
                          อนุมัติ
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(b)}
                          className="ml-2 border border-line rounded-lg px-3 py-1.5 text-sm hover:border-danger hover:text-danger"
                        >
                          ไม่อนุมัติ
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => update({ id: b.id })} className="text-sm text-cobalt font-semibold hover:underline underline-offset-4">
                        ดูรายละเอียด
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-6 py-14 text-center text-muted">
                  ไม่มีการจองที่ตรงกับตัวกรอง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && openEvent && (
        <BookingDrawer
          key={open.id}
          booking={open}
          event={openEvent}
          shop={shops.find((s) => s.id === open.shopId)}
          allBookings={myBookings}
          onClose={closeDrawer}
          onApprove={(moveTo) => approve(open, moveTo)}
          onReject={() => setRejecting(open)}
          onCancel={() => setCancelling(open)}
        />
      )}
      <BookingReasonDialog
        kind="reject"
        booking={rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={(b, reason) => {
          reject(b, reason)
          setRejecting(null)
        }}
      />
      <BookingReasonDialog
        kind="cancel"
        booking={cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={(b, reason) => {
          cancel(b, reason)
          setCancelling(null)
        }}
      />
    </section>
  )
}
