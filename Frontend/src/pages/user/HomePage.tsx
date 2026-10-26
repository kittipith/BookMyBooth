import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import Chip from '../../components/common/Chip'
import SelectBox from '../../components/common/SelectBox'
import OrganizerSignupButton from '../../components/popup/OrganizerSignupButton'
import EventListItem from '../../components/user/EventListItem'
import LotMap from '../../components/user/LotMap'
import MapLegend from '../../components/user/MapLegend'
import { HOW_IT_WORKS } from '../../data/content'
import { EVENT_TYPES } from '../../data/options'
import { LIMITS } from '../../data/settings'
import { useAppStore } from '../../hooks/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { openEvents as selectOpenEvents } from '../../services/selectors'
import { rangeLabel } from '../../utils/format'
import { freeCountAll } from '../../utils/pricing'

export default function HomePage() {
  const navigate = useNavigate()
  const { account } = useAuth()
  const { events } = useAppStore()
  const openEvents = selectOpenEvents(events)
  const [q, setQ] = useState('')
  const [type, setType] = useState('ทั้งหมด')
  const [listType, setListType] = useState('ทั้งหมด')

  const featured = openEvents[0]
  const freeTotal = openEvents.reduce((sum, e) => sum + freeCountAll(e), 0)
  const list = openEvents.filter((e) => listType === 'ทั้งหมด' || e.type === listType).slice(0, LIMITS.homeEvents)

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (type !== 'ทั้งหมด') params.set('type', type)
    navigate(`/events?${params}`)
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-5 pt-12 pb-16 lg:pt-20 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
        <div>
          <h1 className="font-display font-bold leading-[1.02] tracking-tight text-[clamp(2.6rem,6.5vw,5.2rem)]">
            เห็นผังจริง
            <br />
            เลือกล็อกเอง
            <br />
            จองจบในที่เดียว
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted leading-relaxed">
            รวมตลาดนัด งานแฟร์ และงานมหาวิทยาลัยที่เปิดให้เช่าพื้นที่ขายของ ดูล็อกที่ว่างของแต่ละ Event เทียบราคาแต่ละโซน
            แล้วสามารถจองล็อกได้ทันที
          </p>

          <form onSubmit={onSearch} className="mt-9 bg-surface border border-line rounded-2xl p-2 grid sm:grid-cols-[1.4fr_1fr_auto] gap-2 stamp">
            <label className="px-3 py-2">
              <span className="block text-xs text-muted">ชื่องานหรือสถานที่</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full bg-transparent outline-none text-[15px] placeholder:text-muted/70"
                placeholder="เช่น สวนรถไฟ, เชียงใหม่"
              />
            </label>
            <label className="px-3 py-2 sm:border-l border-line">
              <span className="block text-xs text-muted">ประเภทงาน</span>
              <SelectBox value={type} onChange={setType} options={['ทั้งหมด', ...EVENT_TYPES]} bare aria-label="ประเภทงาน" />
            </label>
            <button className="bg-cobalt text-oncobalt rounded-xl px-6 py-3 font-semibold hover:opacity-90">ค้นหางาน</button>
          </form>
          <p className="mt-4 text-sm text-muted">
            ตอนนี้มี <b className="text-ink">{openEvents.length}</b> งานเปิดรับจอง และ <b className="text-ink">{freeTotal}</b>{' '}
            ล็อกที่ยังว่าง
          </p>
        </div>

        {featured && (
          <div className="bg-surface border border-line rounded-[20px] p-5 sm:p-6 relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted">ผังของงาน</p>
                <h2 className="font-display text-xl font-semibold leading-tight">{featured.title}</h2>
              </div>
              <span className="shrink-0 bg-sun text-onsun text-sm font-semibold rounded-md px-2.5 py-1">
                {rangeLabel(featured.days[0].date, featured.days[featured.days.length - 1].date)} ว่าง {freeCountAll(featured)} ล็อก
              </span>
            </div>
            <div className="mt-5">
              <LotMap
                event={featured}
                mini
                onSelect={(code) => navigate(`/events/${featured.id}?lots=${code}`)}
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
              <MapLegend />
              <Link
                to={`/events/${featured.id}`}
                className="text-sm font-semibold text-cobalt hover:underline underline-offset-4"
              >
                แตะล็อกที่ว่าง หรือเปิดผังเต็ม
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line">
        <div className="max-w-7xl mx-auto px-5 py-14">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
            <h2 className="font-display text-3xl font-bold">เปิดรับจองตอนนี้</h2>
            <div className="flex gap-2 flex-wrap">
              {['ทั้งหมด', ...EVENT_TYPES].map((t) => (
                <Chip key={t} pressed={listType === t} onClick={() => setListType(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {list.map((e) => (
              <EventListItem key={e.id} event={e} />
            ))}
            {!list.length && <p className="py-10 text-center text-muted">ยังไม่มีงานประเภทนี้เปิดรับจอง</p>}
          </div>
          <Link to="/events" className="mt-6 inline-block text-cobalt font-semibold hover:underline underline-offset-4">
            ดูงานทั้งหมด
          </Link>
        </div>
      </div>

      <div className="bg-cobalt text-oncobalt">
        <div className="max-w-7xl mx-auto px-5 py-16 grid lg:grid-cols-[1fr_2fr] gap-10">
          <h2 className="font-display text-3xl font-bold leading-tight">
            จองล็อก
            <br />
            ในสามขั้นตอน
          </h2>
          <ol className="grid sm:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((s, i) => (
              <li key={s.title}>
                <span className="font-display text-5xl font-bold">{i + 1}</span>
                <h3 className="mt-3 font-semibold text-lg">{s.title}</h3>
                <p className="mt-1.5 opacity-80 leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-14 flex flex-wrap items-center justify-between gap-6">
        <div>
          <h2 className="font-display text-2xl font-bold">มีพื้นที่ให้เช่าอยู่หรือเปล่า</h2>
          <p className="mt-1 text-muted">สร้างงาน วาดผังโซน ตั้งราคา และอนุมัติการจองจากที่เดียว</p>
        </div>
        {!account && (
          <OrganizerSignupButton className="border-[1.5px] border-cobalt text-cobalt rounded-xl px-5 py-3 font-semibold hover:bg-cobalt/5" />
        )}
      </div>
    </>
  )
}
