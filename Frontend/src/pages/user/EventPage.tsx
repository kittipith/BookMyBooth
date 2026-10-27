import { useState } from 'react'
import { useSearchParams } from 'react-router'
import Chip from '../../components/common/Chip'
import EventListItem from '../../components/user/EventListItem'
import { EVENT_TYPES } from '../../data/options'
import { LIMITS } from '../../data/settings'
import { useLotsOfEvents, useOpenEvents } from '../../queries/events'
import { freeLotCount, startingPrice } from '../../services/events'
import { baht } from '../../utils/format'

const PRICE_STEP = 10

export default function EventsPage() {
  const [params] = useSearchParams()
  const { open, isPending } = useOpenEvents()
  const lotsByEvent = useLotsOfEvents(open.map((e) => e.id))
  // ช่วงราคาของตัวกรองคำนวณจากราคาเริ่มต้นของงานที่เปิดอยู่
  const prices = open.map(startingPrice)
  const minPrice = prices.length ? Math.floor(Math.min(...prices) / PRICE_STEP) * PRICE_STEP : 0
  const maxPrice = prices.length ? Math.ceil(Math.max(...prices) / PRICE_STEP) * PRICE_STEP : PRICE_STEP

  const [q, setQ] = useState(params.get('q') ?? '')
  const [type, setType] = useState(params.get('type') ?? 'ทั้งหมด')
  const [priceCap, setPriceCap] = useState<number | null>(null)
  const [onlyFree, setOnlyFree] = useState(false)
  const cap = priceCap ?? maxPrice

  const keyword = q.trim().toLowerCase()
  const list = open.filter(
    (e) =>
      (type === 'ทั้งหมด' || e.type === type) &&
      (!keyword || `${e.title} ${e.venue} ${e.organizer}`.toLowerCase().includes(keyword)) &&
      startingPrice(e) <= cap &&
      (!onlyFree || freeLotCount(lotsByEvent[e.id]) > LIMITS.manyFreeLots),
  )

  const reset = () => {
    setQ('')
    setType('ทั้งหมด')
    setPriceCap(null)
    setOnlyFree(false)
  }

  return (
    <section className="max-w-7xl mx-auto px-5 py-10">
      <h1 className="font-display text-4xl font-bold">งานที่เปิดรับจอง</h1>
      <div className="mt-8 grid lg:grid-cols-[250px_1fr] gap-10">
        <aside className="space-y-7 lg:sticky lg:top-24 self-start">
          <label className="block">
            <span className="text-sm font-semibold">ค้นหา</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-2 w-full bg-surface border border-line rounded-lg px-3 py-2.5 outline-none focus:border-cobalt"
              placeholder="ชื่องาน จังหวัด"
            />
          </label>
          <fieldset>
            <legend className="text-sm font-semibold">ประเภทงาน</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {['ทั้งหมด', ...EVENT_TYPES].map((t) => (
                <Chip key={t} pressed={type === t} onClick={() => setType(t)} className="px-3">
                  {t}
                </Chip>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="price-cap" className="text-sm font-semibold">
              ราคาเริ่มต้นไม่เกิน
            </label>
            {/* พิมพ์ราคาเองได้ หรือเลื่อนแถบ เว้นว่าง = ไม่จำกัด */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-muted">฿</span>
              <input
                id="price-cap"
                inputMode="numeric"
                value={priceCap ?? ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '')
                  setPriceCap(digits ? Number(digits) : null)
                }}
                placeholder={String(maxPrice)}
                className="fld py-2! font-display"
              />
              {priceCap !== null && (
                <button type="button" onClick={() => setPriceCap(null)} className="shrink-0 text-sm text-muted hover:text-ink underline underline-offset-4">
                  ล้าง
                </button>
              )}
            </div>
            <input
              type="range"
              min={minPrice}
              max={maxPrice}
              step={PRICE_STEP}
              value={Math.min(Math.max(cap, minPrice), maxPrice)}
              onChange={(e) => setPriceCap(Number(e.target.value))}
              className="mt-3 w-full"
              aria-label="เลื่อนเลือกราคาเริ่มต้นไม่เกิน"
            />
            <span className="mt-1 flex justify-between text-xs text-muted">
              <span>{baht(minPrice)}</span>
              <span>{baht(maxPrice)}</span>
            </span>
          </div>
          <label className="flex items-center gap-2.5 text-[15px]">
            <input type="checkbox" className="w-4 h-4" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />{' '}
            เฉพาะงานที่เหลือมากกว่า {LIMITS.manyFreeLots} ล็อก
          </label>
        </aside>
        <div>
          <p className="text-sm text-muted mb-3">{isPending ? 'กำลังโหลดงาน…' : `พบ ${list.length} งาน`}</p>
          <div className="divide-y divide-line border-y border-line">
            {list.map((e) => (
              <EventListItem key={e.id} event={e} lotStates={lotsByEvent[e.id]} />
            ))}
          </div>
          {!isPending && !list.length && (
            <div className="py-14 text-center">
              <p className="text-muted">ไม่พบงานที่ตรงกับตัวกรอง</p>
              <button type="button" onClick={reset} className="mt-3 text-cobalt font-semibold hover:underline underline-offset-4">
                ล้างตัวกรอง
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
