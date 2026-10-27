import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import LotMap from '../../components/user/LotMap'
import LotPanelEmpty from '../../components/user/LotPanelEmpty'
import LotPanelSelected from '../../components/user/LotPanelSelected'
import MapLegend from '../../components/user/MapLegend'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useMyBookings } from '../../queries/bookings'
import { useEventDetail, useEventLots } from '../../queries/events'
import { writeDraft } from '../../services/bookingDraft'
import { activeLots } from '../../services/bookings'
import { eventDayCount, lotStateOf } from '../../services/events'
import type { LotStates, PublicEvent } from '../../types'
import { rangeLabel } from '../../utils/format'

export default function EventMapPage() {
  const { eventId } = useParams()
  const event = useEventDetail(eventId)
  // โหลดล็อกเมื่อรู้แล้วว่างานเปิดรับจอง (งานที่ไม่มีจะได้ 404 ซ้ำ)
  const lots = useEventLots(event.data?.status === 'open' ? eventId : undefined)

  if (event.isPending || (event.data?.status === 'open' && lots.isPending)) {
    return (
      <section className="max-w-3xl mx-auto px-5 py-20 text-center text-muted" role="status">
        กำลังโหลดผังงาน…
      </section>
    )
  }

  if (!event.data || event.data.status !== 'open' || !lots.data) {
    return (
      <section className="max-w-3xl mx-auto px-5 py-20 text-center">
        <h1 className="font-display text-3xl font-bold">{event.isError && event.error.status !== 404 ? 'โหลดงานนี้ไม่สำเร็จ' : 'งานนี้ไม่เปิดรับจองแล้ว'}</h1>
        <p className="mt-2 text-muted">
          {event.isError && event.error.status !== 404 ? event.error.message : 'งานอาจปิดรับจองหรือถูกลบไปแล้ว ลองดูงานอื่นที่ยังเปิดอยู่'}
        </p>
        <Link to="/events" className="mt-6 inline-block bg-cobalt text-oncobalt rounded-xl px-6 py-3 font-semibold">
          ดูงานที่เปิดรับจอง
        </Link>
      </section>
    )
  }
  return <EventMap key={event.data.id} event={event.data} lotStates={lots.data} />
}

function EventMap({ event, lotStates }: { event: PublicEvent; lotStates: LotStates }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { requireAuth } = useAuth()
  // ล็อกที่ร้านของผู้ขายที่ล็อกอินอยู่ถือไว้แล้วในงานนี้ (รอสลิป / รอตรวจ / อนุมัติ)
  const { data: myBookings = [] } = useMyBookings()
  const myLots = activeLots(myBookings, event.id)

  const lotIsFree = (code: string) => lotStateOf(lotStates, code) === 'free'
  // ?lots=A01,A02 (หรือ ?lot=A01 แบบเดิม) กลับมาที่ผังพร้อมล็อกที่เลือกไว้
  const initialLots = (params.get('lots') ?? params.get('lot') ?? '').split(',').filter((code) => code && lotIsFree(code))

  const [picked, setLots] = useState<string[]>(initialLots)
  // ล็อกที่เลือกไว้แล้วมีคนอื่นจองไประหว่างนั้น (สถานะล็อกโหลดใหม่ทุก 15 วินาทีเมื่อกลับมาที่หน้า)
  const lots = picked.filter(lotIsFree)

  const days = eventDayCount(event)
  // เลือกได้อีกกี่ล็อก (null = ไม่จำกัด) นับล็อกที่ร้านนี้จองไว้แล้วด้วย
  const remaining = event.maxLotsPerSeller === null ? null : Math.max(0, event.maxLotsPerSeller - myLots.length)
  const limitMessage = (held: number) =>
    `งานนี้จองได้ไม่เกิน ${event.maxLotsPerSeller} ล็อกต่อร้าน${held ? ` คุณจองไว้แล้ว ${held} ล็อก` : ''}`

  /** กดล็อกว่างเพื่อเลือกเพิ่ม กดซ้ำเพื่อเอาออก */
  const selectLot = (code: string) => {
    if (lots.includes(code)) {
      setLots((l) => l.filter((x) => x !== code))
      return
    }
    if (remaining !== null && lots.length >= remaining) {
      toast(`${limitMessage(myLots.length)} เลือกได้อีก ${remaining} ล็อก`, 'danger')
      return
    }
    setLots((l) => [...l, code].sort())
  }

  const book = () => {
    if (!lots.length) return
    // ต้องเข้าสู่ระบบด้วยบัญชีผู้ขายก่อน แล้วไปขั้นตอนจองต่อทันที (backend ตรวจโควตาซ้ำ QUOTA_EXCEEDED)
    requireAuth(
      'seller',
      () => {
        writeDraft({ eventId: event.id, lots })
        navigate('/booking/shop-info')
      },
      `เข้าสู่ระบบบัญชีผู้ขายเพื่อจองล็อก ${lots.join(', ')}`,
    )
  }

  return (
    <section className="max-w-7xl mx-auto px-5 py-8">
      <Link to="/events" className="text-sm text-muted hover:text-ink">
        กลับไปรายการงาน
      </Link>
      <div className="mt-4 grid lg:grid-cols-[1fr_auto] gap-6 items-end">
        <div>
          <p className="text-sm text-muted">
            {event.type} โดย {event.organizer}
          </p>
          <h1 className="font-display text-[clamp(2rem,4.5vw,3.4rem)] font-bold leading-[1.05] mt-1">{event.title}</h1>
          <p className="mt-3 max-w-2xl text-muted leading-relaxed">{event.description}</p>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm border-t lg:border-t-0 lg:border-l border-line pt-4 lg:pt-0 lg:pl-6">
          <div>
            <dt className="text-muted">วันที่</dt>
            <dd className="font-semibold mt-0.5">{rangeLabel(event.startDate, event.endDate)}</dd>
          </div>
          <div>
            <dt className="text-muted">เวลาขาย</dt>
            <dd className="font-semibold mt-0.5">{event.hours}</dd>
          </div>
          <div>
            <dt className="text-muted">สถานที่</dt>
            <dd className="font-semibold mt-0.5">{event.venue}</dd>
          </div>
          <div>
            <dt className="text-muted">จำนวนล็อกต่อร้าน</dt>
            <dd className="font-semibold mt-0.5">{event.maxLotsPerSeller === null ? 'ไม่จำกัด' : `สูงสุด ${event.maxLotsPerSeller} ล็อก`}</dd>
            {myLots.length > 0 && (
              <dd className="text-xs text-muted mt-0.5">
                คุณจองแล้ว {myLots.length} ล็อก ({myLots.join(', ')})
              </dd>
            )}
          </div>
        </dl>
      </div>

      <div className="mt-8 grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              จองทั้งงาน <b>{rangeLabel(event.startDate, event.endDate)}</b> <span className="text-muted">({days} วัน)</span>
            </p>
            <MapLegend withSelected />
          </div>
          <div className="mt-5 bg-surface border border-line rounded-2xl p-4 sm:p-6 relative overflow-x-auto">
            <div style={{ minWidth: Math.max(600, event.cols * 38) }}>
              <LotMap event={event} lotStates={lotStates} selected={lots} onSelect={selectLot} />
            </div>
          </div>
        </div>
        <aside className="lg:sticky lg:top-24">
          {lots.length ? (
            <LotPanelSelected
              event={event}
              lots={lots}
              quotaLeft={remaining === null ? null : Math.max(0, remaining - lots.length)}
              onRemove={(code) => setLots((l) => l.filter((x) => x !== code))}
              onClear={() => setLots([])}
              onBook={book}
            />
          ) : (
            <LotPanelEmpty event={event} />
          )}
        </aside>
      </div>
    </section>
  )
}
