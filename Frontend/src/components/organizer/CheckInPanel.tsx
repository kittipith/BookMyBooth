import { useState, type FormEvent } from 'react'
import { errorMessage } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { useCheckIn } from '../../queries/organizer'
import { isEventDay } from '../../services/organizer'
import type { OrganizerBooking, PublicEvent } from '../../types'
import { dateTimeLabel } from '../../utils/format'

interface CheckInPanelProps {
  events: PublicEvent[]
  bookings: OrganizerBooking[]
}

/**
 * เช็กอินหน้างาน (F27): สแกน QR ของผู้ขายด้วยเครื่องสแกนที่พิมพ์เป็นข้อความ หรือพิมพ์รหัสการจองแล้วกด Enter
 * หรือค้นหาร้าน/ล็อกในรายการร้านที่อนุมัติแล้วของงานที่จัดวันนี้
 */
export default function CheckInPanel({ events, bookings }: CheckInPanelProps) {
  const [q, setQ] = useState('')
  const checkIn = useCheckIn()
  const toast = useToast()

  const today = new Set(events.filter(isEventDay).map((e) => e.id))
  const approved = bookings.filter((b) => b.status === 'approved' && today.has(b.eventId)).sort((a, b) => a.lot.localeCompare(b.lot))
  const keyword = q.trim().toLowerCase()
  const shown = approved.filter((b) => !keyword || `${b.id} ${b.lot} ${b.shopName}`.toLowerCase().includes(keyword))
  const arrived = approved.filter((b) => b.checkedIn).length

  const run = async (bookingId: string) => {
    try {
      const result = await checkIn.mutateAsync(bookingId)
      toast(`เช็กอิน ${result.shopName} ล็อก ${result.lotId} แล้ว`)
      setQ('')
    } catch (e) {
      toast(errorMessage(e), 'danger')
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const code = q.trim()
    if (!code || checkIn.isPending) return
    // ตรงกับร้านเดียวในรายการ หรือเป็นรหัสการจองเต็ม (จาก QR) ก็เช็กอินเลย
    const only = shown.length === 1 && !shown[0].checkedIn ? shown[0].id : undefined
    const id = only ?? (approved.some((b) => b.id.toLowerCase() === code.toLowerCase()) || !approved.length ? code : undefined)
    if (id) void run(id)
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="fld text-sm flex-1"
          placeholder="สแกน QR หรือพิมพ์รหัสการจอง ล็อก ชื่อร้าน"
          aria-label="รหัสการจอง ล็อก หรือชื่อร้าน"
        />
        <button type="submit" disabled={!q.trim() || checkIn.isPending} className="bg-cobalt text-oncobalt rounded-xl px-4 text-sm font-semibold disabled:opacity-40">
          เช็กอิน
        </button>
      </form>
      {approved.length ? (
        <>
          <p className="mt-3 text-sm text-muted">
            วันนี้มาแล้ว {arrived} จาก {approved.length} ร้าน
          </p>
          <ul className="mt-2 max-h-72 overflow-y-auto divide-y divide-line">
            {shown.map((b) => (
              <li key={b.id} className="py-2 flex items-center gap-3">
                <span className="font-display text-lg font-bold w-12 shrink-0">{b.lot}</span>
                <span className="flex-1 min-w-0 truncate">{b.shopName}</span>
                {b.checkedIn ? (
                  <span className="text-xs text-muted">{b.checkedInAt ? dateTimeLabel(b.checkedInAt) : 'มาแล้ว'}</span>
                ) : (
                  <button
                    type="button"
                    disabled={checkIn.isPending}
                    onClick={() => run(b.id)}
                    className="border border-cobalt text-cobalt rounded-lg px-3 py-1 text-sm font-semibold hover:bg-cobalt/5 disabled:opacity-40"
                  >
                    เช็กอิน
                  </button>
                )}
              </li>
            ))}
            {!shown.length && <li className="py-4 text-center text-sm text-muted">ไม่พบร้านที่ค้นหา</li>}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">วันนี้ไม่มีงานที่จัดอยู่ เช็กอินได้เฉพาะวันที่จัดงาน</p>
      )}
    </div>
  )
}
