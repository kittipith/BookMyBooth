import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import LotMap from '../../components/user/LotMap'
import LotPanelEmpty from '../../components/user/LotPanelEmpty'
import LotPanelSelected from '../../components/user/LotPanelSelected'
import MapLegend from '../../components/user/MapLegend'
import { useAppStore, useEvent } from '../../hooks/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { lotLimitReached, sellerLots } from '../../services/selectors'
import type { MarketEvent } from '../../types'
import { rangeLabel } from '../../utils/format'
import { allDays, lotStateAll } from '../../utils/pricing'

export default function EventMapPage() {
  const { eventId } = useParams()
  const event = useEvent(eventId)

  if (!event || event.status !== 'open') {
    return (
      <section className="max-w-3xl mx-auto px-5 py-20 text-center">
        <h1 className="font-display text-3xl font-bold">งานนี้ไม่เปิดรับจองแล้ว</h1>
        <p className="mt-2 text-muted">งานอาจปิดรับจองหรือถูกลบไปแล้ว ลองดูงานอื่นที่ยังเปิดอยู่</p>
        <Link to="/events" className="mt-6 inline-block bg-cobalt text-oncobalt rounded-xl px-6 py-3 font-semibold">
          ดูงานที่เปิดรับจอง
        </Link>
      </section>
    )
  }
  return <EventMap key={event.id} event={event} />
}

function EventMap({ event }: { event: MarketEvent }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { bookings, setDraft } = useAppStore()
  const toast = useToast()
  const { account, requireAuth } = useAuth()
  // ล็อกที่ร้านของผู้ขายที่เข้าสู่ระบบอยู่จองไว้แล้วในงานนี้
  const myLots = account?.role === 'seller' && account.shopId ? sellerLots(bookings, event.id, account.shopId) : []

  // ผู้ขายจองทั้งงาน ล็อกว่างเมื่อว่างครบทุกวัน
  const lotIsFree = (code: string) => lotStateAll(event, code) === 'free'
  // ?lots=A01,A02 (หรือ ?lot=A01 แบบเดิม) กลับมาที่ผังพร้อมล็อกที่เลือกไว้
  const initialLots = (params.get('lots') ?? params.get('lot') ?? '').split(',').filter((code) => code && lotIsFree(code))

  const [lots, setLots] = useState<string[]>(initialLots)

  const first = event.days[0]
  const last = event.days[event.days.length - 1]
  // เลือกเพิ่มได้อีกกี่ล็อก (null = ไม่จำกัด) นับล็อกที่ร้านนี้จองไว้แล้วด้วย
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
    // จองทั้งงาน ทุกวันที่งานจัด
    const draft = { eventId: event.id, lots, days: allDays(event) }
    // ต้องเข้าสู่ระบบด้วยบัญชีผู้ขายก่อน แล้วค่อยไปขั้นตอนจองต่อทันที
    requireAuth(
      'seller',
      (account) => {
        // จำกัดจำนวนล็อกต่อร้านตามที่ผู้จัดงานตั้งไว้ (นับล็อกที่จองไว้แล้ว + ล็อกที่เลือกครั้งนี้)
        const held = sellerLots(bookings, event.id, account.shopId ?? '').length
        if (lotLimitReached(event, held + lots.length - 1)) {
          const left = Math.max(0, (event.maxLotsPerSeller ?? 0) - held)
          toast(`${limitMessage(held)} ${left ? `เลือกได้อีก ${left} ล็อก` : 'ครบแล้ว'}`, 'danger')
          return
        }
        setDraft(draft)
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
            <dd className="font-semibold mt-0.5">{rangeLabel(first.date, last.date)}</dd>
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
              จองทั้งงาน <b>{rangeLabel(first.date, last.date)}</b> <span className="text-muted">({event.days.length} วัน)</span>
            </p>
            <MapLegend withSelected />
          </div>
          <div className="mt-5 bg-surface border border-line rounded-2xl p-4 sm:p-6 relative overflow-x-auto">
            <div style={{ minWidth: Math.max(600, event.cols * 38) }}>
              <LotMap event={event} selected={lots} onSelect={selectLot} />
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
