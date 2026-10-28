import { useEffect, useRef, useState } from 'react'
import { isEventDay, movableLots } from '../../services/organizer'
import type { BookingGroup, LotStates, OrganizerBooking, PublicEvent } from '../../types'
import { baht, dateTimeLabel, fullTitle, rangeLabel } from '../../utils/format'
import { lotZoneId } from '../../utils/pricing'
import { BookingStatusBadge } from '../common/StatusBadge'
import FloorMiniMap from '../organizer/FloorMiniMap'
import SlipCard from '../organizer/SlipCard'
import SelectBox from '../common/SelectBox'

interface BookingDrawerProps {
  /** การจองทั้งชุด ปุ่มทุกปุ่มทำทั้งชุด (D7) */
  booking: BookingGroup<OrganizerBooking>
  event: PublicEvent
  /** สถานะล็อกของงาน (ยังโหลดไม่เสร็จ = undefined) */
  states: LotStates | undefined
  busy: boolean
  onClose: () => void
  /** อนุมัติทั้งชุด หรือย้ายบางล็อก {ล็อกเดิม: ล็อกใหม่} แล้วอนุมัติ */
  onApprove: (moves?: Record<string, string>) => void
  onReject: () => void
  onCancel: () => void
  onCheckIn: () => void
}

function positionText(event: PublicEvent, lot: string) {
  const ids = event.zones.map((z) => z.id)
  const i = ids.indexOf(lotZoneId(lot))
  if (i === 0) return 'แถวหน้าเวที'
  if (i === ids.length - 1) return 'แถวหน้าทางเข้า'
  return 'แถวกลางงาน'
}

/** ลิ้นชักรายละเอียดการจองด้านขวา ปิดได้ด้วย Esc หรือแตะพื้นหลัง */
export default function BookingDrawer({
  booking,
  event,
  states,
  busy,
  onClose,
  onApprove,
  onReject,
  onCancel,
  onCheckIn,
}: BookingDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [moving, setMoving] = useState(false)
  const [moveFrom, setMoveFrom] = useState(booking.lots[0])
  const [moveTo, setMoveTo] = useState('')

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const many = booking.lots.length > 1
  const targets = booking.status === 'pending' && states ? movableLots(event, states, moveFrom) : []
  // ผังแสดงตำแหน่งหลังย้ายถ้าเลือกล็อกปลายทางแล้ว
  const preview = moving && moveTo ? booking.lots.map((l) => (l === moveFrom ? moveTo : l)) : booking.lots
  const eventDay = isEventDay(event)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[rgb(16_28_64/.3)]" onClick={onClose} />
      <aside
        className="drawer-in fixed top-0 right-0 z-50 h-full w-full sm:w-[520px] bg-surface border-l border-line overflow-y-auto"
        aria-label="รายละเอียดการจอง"
      >
        <div className="p-6 border-b border-line flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted break-all">
              {booking.id} จองเมื่อ {dateTimeLabel(booking.createdAt)}
            </p>
            <h2 className="font-display text-2xl font-semibold mt-1">{booking.shopName}</h2>
            <div className="mt-2">
              <BookingStatusBadge status={booking.status} />
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="w-9 h-9 shrink-0 rounded-full hover:bg-mist text-xl leading-none" aria-label="ปิด">
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-end justify-between bg-mist rounded-xl p-5 gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted">{many ? `${booking.lots.length} ล็อก` : 'ล็อก'}</p>
              <p className={`font-display font-bold leading-none mt-1 ${many ? 'text-3xl' : 'text-5xl'}`}>{booking.lot}</p>
            </div>
            <div className="text-right text-sm">
              <p>{fullTitle(event)}</p>
              <p className="text-muted">{rangeLabel(event.startDate, event.endDate)}</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted mb-2">ตำแหน่งบนผังงาน</p>
            {states ? <FloorMiniMap event={event} states={states} targets={preview} /> : <p className="text-sm text-muted">กำลังโหลดผัง…</p>}
            <ul className="mt-3 text-sm space-y-0.5">
              {booking.lots.map((lot) => (
                <li key={lot}>
                  <b>{lot}</b> อยู่โซน {lotZoneId(lot)} {positionText(event, lot)}
                </li>
              ))}
            </ul>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted">ประเภทสินค้า</dt>
              <dd className="font-semibold">{booking.category || '-'}</dd>
            </div>
            <div>
              <dt className="text-muted">ยอดที่ต้องชำระ</dt>
              <dd className="font-display text-lg font-semibold">{baht(booking.amount)}</dd>
            </div>
            <div>
              <dt className="text-muted">คนประจำร้าน</dt>
              <dd className="font-semibold">{booking.staff || '-'}</dd>
            </div>
            <div>
              <dt className="text-muted">ไฟฟ้า</dt>
              <dd className="font-semibold">{booking.power ? 'ขอเพิ่มเป็น 15A' : 'มาตรฐาน 5A'}</dd>
            </div>
            {booking.status === 'approved' && (
              <div>
                <dt className="text-muted">เช็กอินหน้างาน</dt>
                <dd className={`font-semibold ${!booking.checkedIn && event.status === 'ended' ? 'text-danger' : ''}`}>
                  {booking.checkedIn
                    ? `มาแล้ว ${booking.checkedInAt ? dateTimeLabel(booking.checkedInAt) : ''}`
                    : event.status === 'ended'
                      ? 'ไม่มาตามนัด'
                      : 'ยังไม่เช็กอิน'}
                </dd>
              </div>
            )}
          </dl>

          {booking.productDescription && (
            <div className="bg-mist rounded-xl p-4 text-sm">
              <p className="text-muted">สินค้าที่ขาย</p>
              <p className="mt-1">{booking.productDescription}</p>
            </div>
          )}
          {booking.note && (
            <div className="bg-mist rounded-xl p-4 text-sm">
              <p className="text-muted">ข้อความจากผู้ขาย</p>
              <p className="mt-1">{booking.note}</p>
            </div>
          )}
          {!!booking.moves.length && (
            <div className="bg-mist rounded-xl p-4 text-sm">
              <p className="text-muted">ประวัติการย้ายล็อก</p>
              <ul className="mt-1 space-y-0.5">
                {booking.moves.map((m) => (
                  <li key={m.at + m.to}>
                    {m.from} → <b>{m.to}</b> <span className="text-muted">{dateTimeLabel(m.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {booking.reason && (booking.status === 'rejected' || booking.status === 'cancelled') && (
            <div className="border border-danger/40 rounded-xl p-4 text-sm">
              <p className="text-muted">เหตุผล</p>
              <p className="mt-1 text-danger">{booking.reason}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-muted mb-2">สลิปการโอน</p>
            {many && (
              <p className="mb-3 text-sm bg-mist rounded-lg px-3 py-2">
                สลิปเดียวสำหรับ {booking.lots.length} ล็อก ยอดรวม <b>{baht(booking.amount)}</b> อนุมัติหรือไม่อนุมัติทั้งชุดพร้อมกัน
              </p>
            )}
            {booking.hasSlip ? (
              <SlipCard bookingId={booking.id} />
            ) : (
              <p className="text-sm text-muted">
                {booking.status === 'awaiting_slip' ? `ผู้ขายยังไม่แนบสลิป หมดเวลา ${dateTimeLabel(booking.expiresAt)}` : 'ไม่มีสลิป'}
              </p>
            )}
          </div>

          {booking.status === 'pending' && moving && (
            <div className="border-[1.5px] border-cobalt/40 rounded-xl p-4">
              {many && (
                <label className="block mb-3">
                  <span className="text-sm font-semibold">ย้ายล็อก</span>
                  <SelectBox
                    value={moveFrom}
                    onChange={(lot) => {
                      setMoveFrom(lot)
                      setMoveTo('')
                    }}
                    options={booking.lots}
                    className="mt-2"
                    aria-label="ล็อกที่จะย้าย"
                  />
                </label>
              )}
              <label className="block">
                <span className="text-sm font-semibold">ย้ายไปล็อก</span>
                <SelectBox
                  value={moveTo}
                  onChange={setMoveTo}
                  placeholder="เลือกล็อกที่ว่างอยู่"
                  options={event.zones
                    .map((z) => ({ group: `โซน ${z.id} ${z.name}`, options: targets.filter((l) => l.zone === z.id).map((l) => l.code) }))
                    .filter((g) => g.options.length > 0)}
                  className="mt-2"
                  aria-label="ย้ายไปล็อก"
                />
              </label>
              <p className="mt-2 text-xs text-muted">
                {targets.length ? `มี ${targets.length} ล็อกที่ว่าง ยอดชำระเดิมไม่เปลี่ยน` : 'ไม่มีล็อกที่ว่าง'}
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  disabled={!moveTo || busy}
                  onClick={() => onApprove({ [moveFrom]: moveTo })}
                  className="flex-1 bg-cobalt text-oncobalt rounded-xl py-2.5 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ย้ายแล้วอนุมัติ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoving(false)
                    setMoveTo('')
                  }}
                  className="px-4 py-2.5 rounded-xl hover:bg-mist"
                >
                  ไม่ย้าย
                </button>
              </div>
            </div>
          )}
          {booking.status === 'pending' && (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onApprove()}
                className="flex-1 bg-cobalt text-oncobalt rounded-xl py-3 font-semibold press disabled:opacity-40"
              >
                {many ? 'อนุมัติทั้งชุด' : 'อนุมัติ'}
              </button>
              {!moving && (
                <button
                  type="button"
                  onClick={() => setMoving(true)}
                  className="flex-1 border-[1.5px] border-cobalt text-cobalt rounded-xl py-3 font-semibold hover:bg-cobalt/5"
                >
                  ย้ายล็อก
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={onReject}
                className="flex-1 border-[1.5px] border-line rounded-xl py-3 font-semibold hover:border-danger hover:text-danger disabled:opacity-40"
              >
                ไม่อนุมัติ
              </button>
            </div>
          )}
          {booking.status === 'approved' && (
            <div className="flex gap-3">
              {!booking.checkedIn && eventDay && (
                <button type="button" disabled={busy} onClick={onCheckIn} className="flex-1 bg-cobalt text-oncobalt rounded-xl py-3 font-semibold press disabled:opacity-40">
                  เช็กอิน
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="flex-1 border-[1.5px] border-line rounded-xl py-3 font-semibold hover:border-danger hover:text-danger disabled:opacity-40"
              >
                {many ? 'ยกเลิกทั้งชุด' : 'ยกเลิกการจองนี้'}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
