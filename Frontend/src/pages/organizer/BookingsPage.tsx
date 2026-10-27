import { useCallback, useState, type MouseEvent } from 'react'
import { useSearchParams } from 'react-router'
import { errorMessage } from '../../api/client'
import BookingDrawer from '../../components/popup/BookingDrawer'
import BookingReasonDialog from '../../components/popup/BookingReasonDialog'
import Chip from '../../components/common/Chip'
import { BookingStatusBadge } from '../../components/common/StatusBadge'
import { BOOKING_STATUS_LABEL } from '../../data/options'
import { useBookingDecisions } from '../../hooks/useBookingDecisions'
import { useToast } from '../../hooks/useToast'
import { useEventLots } from '../../queries/events'
import { useCheckIn, useOrganizerBookings } from '../../queries/organizer'
import type { BookingUiStatus, OrganizerBooking } from '../../types'
import { baht, dateTimeLabel, fullTitle, rangeLabel } from '../../utils/format'
import SelectBox from '../../components/common/SelectBox'

type Tab = BookingUiStatus | 'all'
const TABS: Tab[] = ['pending', 'awaiting_slip', 'approved', 'rejected', 'cancelled', 'expired', 'all']
/** แท็บที่แสดงแม้ไม่มีรายการ */
const ALWAYS: Tab[] = ['pending', 'approved', 'all']

export default function BookingsPage() {
  const [params, setParams] = useSearchParams()
  const { events, bookings, isPending, isError } = useOrganizerBookings()
  const { approve, approveMany, reject, cancel, busy } = useBookingDecisions()
  const checkIn = useCheckIn()
  const toast = useToast()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejecting, setRejecting] = useState<OrganizerBooking | null>(null)
  const [cancelling, setCancelling] = useState<OrganizerBooking | null>(null)

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
  const scoped = bookings.filter(
    (b) =>
      (!eventFilter || b.eventId === eventFilter) &&
      (!keyword || b.shopName.toLowerCase().includes(keyword) || b.lot.toLowerCase().includes(keyword)),
  )
  const count = (t: Tab) => (t === 'all' ? scoped.length : scoped.filter((b) => b.status === t).length)
  const rows = tab === 'all' ? scoped : scoped.filter((b) => b.status === tab)
  const pendingRows = rows.filter((b) => b.status === 'pending')
  const chosen = pendingRows.filter((b) => selected.has(b.id))
  const allChecked = pendingRows.length > 0 && chosen.length === pendingRows.length

  const eventOf = (b: OrganizerBooking) => events.find((e) => e.id === b.eventId)
  const open = openId ? bookings.find((b) => b.id === openId) : undefined
  const openEvent = open && eventOf(open)
  const { data: openStates } = useEventLots(open?.eventId)
  const closeDrawer = useCallback(() => update({ id: null }), [update])

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const onRowClick = (e: MouseEvent, b: OrganizerBooking) => {
    if ((e.target as HTMLElement).closest('button, input, label')) return
    update({ id: b.id })
  }

  const onCheckIn = async (b: OrganizerBooking) => {
    try {
      await checkIn.mutateAsync(b.id)
      toast(`เช็กอิน ${b.shopName} ล็อก ${b.lot} แล้ว`)
    } catch (e) {
      toast(errorMessage(e), 'danger')
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-bold">การจอง</h1>
        {chosen.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              await approveMany(chosen)
              setSelected(new Set())
            }}
            className="bg-cobalt text-oncobalt rounded-xl px-5 py-3 font-semibold press disabled:opacity-40"
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
              ...events.filter((e) => e.publishStatus !== 'draft').map((e) => ({ value: e.id, label: fullTitle(e) })),
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
          {TABS.filter((t) => t === tab || ALWAYS.includes(t) || count(t) > 0).map((t) => (
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
              <th className="font-medium py-3 pr-4">งาน</th>
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
                      {b.category} · {dateTimeLabel(b.createdAt)}
                    </p>
                  </td>
                  <td className="py-4 pr-4">
                    <p className="text-sm">{event ? fullTitle(event) : b.eventTitle}</p>
                    <p className="text-sm text-muted">{event && rangeLabel(event.startDate, event.endDate)}</p>
                  </td>
                  <td className="py-4 pr-4 text-right font-display font-semibold">{baht(b.amount)}</td>
                  <td className="py-4 pr-4">
                    <BookingStatusBadge status={b.status} />
                    {b.status === 'approved' && b.checkedIn && <p className="mt-1 text-xs text-muted">เช็กอินแล้ว</p>}
                  </td>
                  <td className="py-4 pr-5 text-right whitespace-nowrap">
                    {b.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => approve(b)}
                          className="bg-cobalt text-oncobalt rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
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
                  {isPending ? 'กำลังโหลดการจอง…' : isError ? 'โหลดการจองไม่ได้' : 'ไม่มีการจองที่ตรงกับตัวกรอง'}
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
          states={openStates}
          allBookings={bookings}
          busy={busy || checkIn.isPending}
          onClose={closeDrawer}
          onApprove={(moveTo) => approve(open, moveTo)}
          onReject={() => setRejecting(open)}
          onCancel={() => setCancelling(open)}
          onCheckIn={() => onCheckIn(open)}
        />
      )}
      <BookingReasonDialog
        kind="reject"
        booking={rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={async (b, reason) => {
          if (await reject(b, reason)) setRejecting(null)
        }}
      />
      <BookingReasonDialog
        kind="cancel"
        booking={cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={async (b, reason) => {
          if (await cancel(b, reason)) setCancelling(null)
        }}
      />
    </section>
  )
}
