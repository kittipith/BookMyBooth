import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { EventStatusBadge } from '../../components/common/StatusBadge'
import BulkLotForm from '../../components/organizer/editor/BulkLotForm'
import DayPricingTable, { type EditorDay } from '../../components/organizer/editor/DayPricingTable'
import EditorSummary from '../../components/organizer/editor/EditorSummary'
import EditorToolbar, { ERASE } from '../../components/organizer/editor/EditorToolbar'
import GridSizeControl from '../../components/organizer/editor/GridSizeControl'
import MapCanvas from '../../components/organizer/editor/MapCanvas'
import ZoneSettingsTable from '../../components/organizer/editor/ZoneSettingsTable'
import { BANKS, EVENT_TYPES } from '../../data/options'
import { EVENT_DEFAULTS, GRID_LIMITS, LIMITS, WEEKEND_SURCHARGE } from '../../data/settings'
import { DEFAULT_ZONES, NEW_ZONE, ZONE_LETTERS } from '../../data/zones'
import { useAppStore, useEvent, useOrganizerData } from '../../hooks/useAppStore'
import { useToast } from '../../hooks/useToast'
import type { CellType, EventRecord, EventType, MarketEvent, Organizer, PaymentAccount, PublishStatus, Zone } from '../../types'
import { addDays, dayLabel, diffDays, fullTitle, isWeekend, rangeLabel, TODAY } from '../../utils/format'
import {
  cellSizes,
  cellsRemovedBy,
  emptyLayout,
  footprintConflicts,
  footprints,
  isZoneCell,
  lotCodes,
  movedBookedLots,
  remapIndex,
  resizeGrid,
  resizeLayout,
  STANDARD_COLS,
  STANDARD_ROWS,
  standardLayout,
  type GridEdges,
} from '../../utils/layout'
import SelectBox from '../../components/common/SelectBox'

const MAX_DAYS = LIMITS.maxEventDays

/** รหัสงานใหม่จากเวลาที่สร้าง */
const newEventId = () => `e${Date.now().toString(36)}`

type LayoutPart = Pick<EditorForm, 'layout' | 'cols' | 'zones' | 'lotSizes'>

/** ล็อกที่พื้นที่ไม่พอ (ทับล็อกอื่น สิ่งที่วาดไว้ หรือล้นผัง) */
const conflictsOf = (f: LayoutPart) => footprintConflicts(f.layout, f.cols, cellSizes(f.layout, f.zones, f.lotSizes))

/** ล็อกที่พื้นที่ไม่พอเพราะการแก้นี้ (ล็อกที่ไม่พออยู่ก่อนแล้วไม่นับ) map แปลงตำแหน่งเดิมเป็นตำแหน่งใหม่ เช่น ตอนปรับขนาดผัง */
function newConflicts(before: LayoutPart, after: LayoutPart, map: (i: number) => number = (i) => i) {
  const old = new Set(conflictsOf(before).map(map))
  return conflictsOf(after).filter((i) => !old.has(i))
}

function spaceMessage(after: LayoutPart, bad: number[]) {
  const codes = lotCodes(after.layout)
  return `ล็อก ${bad.map((i) => codes[i]).join(', ')} พื้นที่ไม่พอ จะทับล็อกอื่น สิ่งที่วาดไว้ หรือล้นผัง ย้ายหรือลบสิ่งที่ขวางก่อน หรือขยายผัง`
}

/** วางหรือลบของในช่อง i ขนาดเฉพาะของล็อกเดิมในช่องนั้นถูกล้างไปด้วย */
function withCell<F extends LayoutPart>(f: F, i: number, value: CellType): F {
  const layout = [...f.layout]
  layout[i] = value
  const lotSizes = { ...f.lotSizes }
  delete lotSizes[String(i)]
  return { ...f, layout, lotSizes }
}

interface EditorForm {
  title: string
  type: EventType
  venue: string
  start: string
  end: string
  hours: string
  bookingOpens: string
  bookingCloses: string
  payment: PaymentAccount
  maxLotsPerSeller: number | null
  description: string
  autoApprove: boolean
  cols: number
  rows: number
  layout: CellType[]
  disabledCells: number[]
  lotSizes: Record<string, string>
  /** ช่องนี้มาจากช่องไหนของผังที่บันทึกไว้ (-1 = ช่องใหม่) ใช้ตรวจว่าล็อกที่มีการจองเลื่อนตำแหน่งหรือไม่ */
  origins: number[]
  zones: Zone[]
  surcharges: Record<string, number>
}

function fromEvent(e: MarketEvent): EditorForm {
  return {
    title: fullTitle(e),
    type: e.type,
    venue: e.venue,
    start: e.days[0].date,
    end: e.days.at(-1)!.date,
    hours: e.hours,
    bookingOpens: e.bookingOpens,
    bookingCloses: e.bookingCloses,
    payment: { ...e.payment },
    maxLotsPerSeller: e.maxLotsPerSeller,
    description: e.description,
    autoApprove: e.autoApprove,
    cols: e.cols,
    rows: e.rows,
    layout: [...e.layout],
    disabledCells: [...e.disabledCells],
    lotSizes: { ...e.lotSizes },
    origins: e.layout.map((_, i) => i),
    zones: e.zones.map((z) => ({ ...z })),
    surcharges: Object.fromEntries(e.days.map((d) => [d.date, d.surcharge])),
  }
}

function blankForm(organizer: Organizer): EditorForm {
  const start = addDays(TODAY, 30)
  const opens = addDays(start, -EVENT_DEFAULTS.opensDaysBefore)
  return {
    title: '',
    type: 'ตลาดนัด',
    venue: '',
    start,
    end: addDays(start, 2),
    hours: '16:00–23:00 น.',
    bookingOpens: opens < TODAY ? TODAY : opens,
    bookingCloses: addDays(start, -EVENT_DEFAULTS.closesDaysBefore),
    payment: organizer.payment ? { ...organizer.payment } : { bank: BANKS[0], accountName: organizer.name, accountNo: organizer.phone ?? '' },
    maxLotsPerSeller: EVENT_DEFAULTS.maxLotsPerSeller,
    description: '',
    autoApprove: false,
    cols: STANDARD_COLS,
    rows: STANDARD_ROWS,
    layout: emptyLayout(),
    disabledCells: [],
    lotSizes: {},
    origins: emptyLayout().map(() => -1),
    zones: DEFAULT_ZONES.map((z) => ({ ...z, amenities: [...z.amenities] })),
    surcharges: {},
  }
}

export default function MapEditorPage() {
  const { eventId } = useParams()
  const event = useEvent(eventId)
  const { organizer } = useOrganizerData()

  if (eventId && (!event || event.organizerId !== organizer.id)) {
    return (
      <section className="py-16 text-center">
        <h1 className="font-display text-3xl font-bold">ไม่พบงานนี้</h1>
        <Link to="/organizer/events" className="mt-4 inline-block text-cobalt font-semibold hover:underline underline-offset-4">
          กลับไปงานของฉัน
        </Link>
      </section>
    )
  }
  // key ทำให้ฟอร์มเริ่มใหม่เมื่อสลับไปแก้งานอื่นหรือสร้างงานใหม่
  return <MapEditor key={eventId ?? 'new'} existing={event} organizer={organizer} />
}

function MapEditor({ existing, organizer }: { existing?: MarketEvent; organizer: Organizer }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { bookings, saveEvent } = useAppStore()
  const [form, setForm] = useState<EditorForm>(() => (existing ? fromEvent(existing) : blankForm(organizer)))
  const [tool, setTool] = useState<string>(form.zones[0]?.id ?? ERASE)
  // เตือนเรื่องพื้นที่ไม่พอครั้งเดียวต่อการลากหนึ่งเส้น
  const warned = useRef(false)

  const status = existing?.status ?? 'draft'
  const publishStatus: PublishStatus = existing?.publishStatus ?? 'draft'
  const hasBookings = !!existing && bookings.some((b) => b.eventId === existing.id && b.status !== 'cancelled' && b.status !== 'rejected')

  const set = <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setPayment = (patch: Partial<PaymentAccount>) => setForm((f) => ({ ...f, payment: { ...f.payment, ...patch } }))

  const span = diffDays(form.start, form.end)
  const days: EditorDay[] =
    span < 0 || span >= MAX_DAYS
      ? []
      : Array.from({ length: span + 1 }, (_, i) => {
          const date = addDays(form.start, i)
          return { date, label: dayLabel(date), surcharge: form.surcharges[date] ?? (isWeekend(date) ? WEEKEND_SURCHARGE : 0) }
        })

  const offCells = form.disabledCells.filter((i) => isZoneCell(form.layout[i]))
  const counts: Record<string, number> = {}
  const offCounts: Record<string, number> = {}
  form.layout.forEach((c, i) => {
    if (!isZoneCell(c)) return
    counts[c] = (counts[c] ?? 0) + 1
    if (offCells.includes(i)) offCounts[c] = (offCounts[c] ?? 0) + 1
  })
  const bookable = Object.fromEntries(Object.entries(counts).map(([z, n]) => [z, n - (offCounts[z] ?? 0)]))
  const totalLots = Object.values(counts).reduce((a, b) => a + b, 0)

  const windowError =
    form.bookingOpens > form.bookingCloses
      ? 'วันเปิดรับจองต้องไม่หลังวันปิดรับจอง'
      : form.bookingCloses > form.start
        ? 'ต้องปิดรับจองก่อนหรือในวันแรกของงาน'
        : ''

  const paint = (i: number) => {
    setForm((f) => {
      const value = tool === ERASE ? '' : tool
      if (f.layout[i] === value) return f
      const next = withCell(f, i, value)
      return newConflicts(f, next).length ? f : next
    })
  }

  /** ตรวจก่อนวาด ล็อกที่ใหญ่กว่า 2×2 ม. ต้องมีช่องว่างด้านขวา/ล่างพอ ไม่งั้นไม่วาดและเตือน */
  const paintChecked = (i: number) => {
    const value = tool === ERASE ? '' : tool
    const next = withCell(form, i, value)
    const bad = form.layout[i] === value ? [] : newConflicts(form, next)
    if (bad.length) {
      if (!warned.current) toast(spaceMessage(next, bad), 'danger')
      warned.current = true
      return
    }
    paint(i)
  }

  /** แก้ฟอร์มเฉพาะเมื่อไม่ทำให้ล็อกไหนพื้นที่ไม่พอ */
  const tryUpdate = (change: (f: EditorForm) => EditorForm) => {
    const next = change(form)
    const bad = newConflicts(form, next)
    if (bad.length) {
      toast(spaceMessage(next, bad), 'danger')
      return false
    }
    setForm(change)
    return true
  }

  /** ขยายหรือย่อผังจากขอบ ตำแหน่งล็อก ล็อกที่ปิด และขนาดเฉพาะล็อกย้ายตามไปด้วย */
  const resize = (edges: GridEdges) => {
    const lost = cellsRemovedBy(form.layout, form.cols, form.rows, edges)
    if (lost.some(isZoneCell)) {
      toast('ขอบด้านนี้มีล็อกอยู่ ลบหรือย้ายล็อกออกก่อนจึงย่อผังได้', 'danger')
      return false
    }
    const next = resizeLayout(form.layout, form.cols, form.rows, edges)
    const move = (i: number) => remapIndex(i, form.cols, next.cols, next.rows, edges)
    const resized: EditorForm = {
      ...form,
      ...next,
      origins: resizeGrid(form.origins, form.cols, form.rows, edges, -1).grid,
      disabledCells: form.disabledCells.map(move).filter((i) => i >= 0),
      lotSizes: Object.fromEntries(
        Object.entries(form.lotSizes)
          .map(([k, v]) => [String(move(Number(k))), v])
          .filter(([k]) => k !== '-1'),
      ),
    }
    // ล็อกใหญ่ที่ชิดขอบจะล้นผังถ้าย่อ
    const bad = newConflicts(form, resized, move)
    if (bad.length) {
      toast(spaceMessage(resized, bad), 'danger')
      return false
    }
    setForm(resized)
    return true
  }

  // ล็อกที่ตั้งขนาดเฉพาะไว้ (ไม่นับช่องที่ไม่ใช่ล็อกแล้ว หรือขนาดเท่ากับโซน)
  const codes = lotCodes(form.layout)
  const { covered } = footprints(form.layout, form.cols, cellSizes(form.layout, form.zones, form.lotSizes))
  const freeCells = form.layout.filter((c, i) => !c && !covered.has(i)).length
  const conflicts = conflictsOf(form)
  const zoneOfCell = (i: number) => form.zones.find((z) => z.id === form.layout[i])
  const customSizes = Object.entries(form.lotSizes)
    .map(([k, size]) => ({ index: Number(k), size }))
    .filter(({ index, size }) => isZoneCell(form.layout[index]) && size !== zoneOfCell(index)?.size)

  const applyPreset = () => {
    const layout = standardLayout()
    setForm((f) => {
      const zones = [...f.zones]
      DEFAULT_ZONES.forEach((dz) => !zones.some((z) => z.id === dz.id) && zones.push({ ...dz }))
      zones.sort((a, b) => a.id.localeCompare(b.id))
      // ผังมาตรฐานวาดทับตำแหน่งเดิม ถ้าผังเดิมขนาดเท่ากันก็ถือว่าเป็นช่องเดิม
      const same = existing && existing.cols === STANDARD_COLS && existing.rows === STANDARD_ROWS
      const origins = layout.map((_, i) => (same ? i : -1))
      return { ...f, cols: STANDARD_COLS, rows: STANDARD_ROWS, layout, zones, origins, disabledCells: [], lotSizes: {} }
    })
    toast(`ใช้ผังมาตรฐาน ${layout.filter(isZoneCell).length} ล็อก`)
  }

  /**
   * วางล็อกหลายช่องพร้อมกัน ลงในช่องว่างที่อยู่ถัดจากล็อกสุดท้ายของโซนนั้น (เรียงจากบนลงล่าง ซ้ายไปขวา)
   * รหัสล็อกเดิมจึงไม่เลื่อน ล็อกใหม่ได้รหัสต่อท้าย เช่น A13, A14
   */
  const addLots = (zoneId: string, count: number) => {
    // วางทีละล็อกในช่องว่างที่พื้นที่พอสำหรับขนาดของโซน (ล็อกใหญ่กินช่องข้างๆ)
    let next = form
    const placed: number[] = []
    for (let i = Math.max(0, form.layout.lastIndexOf(zoneId)); i < next.layout.length && placed.length < count; i++) {
      if (next.layout[i]) continue
      const candidate = withCell(next, i, zoneId)
      if (newConflicts(next, candidate).length) continue
      next = candidate
      placed.push(i)
    }
    if (!placed.length) {
      toast(`ไม่มีพื้นที่ว่างพอถัดจากล็อกสุดท้ายของโซน ${zoneId} ขยายผังด้านล่างหรือด้านขวาก่อน`, 'danger')
      return
    }
    setForm(next)
    const msg = `เพิ่มล็อกโซน ${zoneId} ${placed.length} ล็อก`
    toast(placed.length < count ? `${msg} (ช่องว่างไม่พออีก ${count - placed.length} ล็อก ขยายขนาดผังแล้วเพิ่มต่อได้)` : msg, placed.length < count ? 'danger' : 'info')
  }

  const addZone = () => {
    const id = ZONE_LETTERS.find((l) => !form.zones.some((z) => z.id === l))
    if (!id) return
    set('zones', [...form.zones, { id, ...NEW_ZONE, amenities: [...NEW_ZONE.amenities] }])
    setTool(id)
  }

  const removeZone = (id: string) => {
    const zones = form.zones.filter((z) => z.id !== id)
    set('zones', zones)
    if (tool === id) setTool(zones[0].id)
  }

  const save = (nextStatus: PublishStatus) => {
    const title = form.title.trim()
    if (!title) return toast('ใส่ชื่องานก่อนบันทึก', 'danger')
    if (!days.length) return toast(`วันสุดท้ายต้องไม่ก่อนวันเริ่ม และจัดได้ไม่เกิน ${MAX_DAYS} วัน`, 'danger')
    if (windowError) return toast(windowError, 'danger')
    if (existing) {
      const bookedCodes = [
        ...new Set(bookings.filter((b) => b.eventId === existing.id && (b.status === 'pending' || b.status === 'approved')).map((b) => b.lot)),
      ]
      const moved = movedBookedLots(existing.layout, form.layout, form.origins, bookedCodes)
      if (moved.length) {
        return toast(
          `ล็อก ${moved.join(', ')} มีการจองอยู่ แต่การแก้ผังนี้ทำให้ล็อกถูกลบหรือรหัสเลื่อนไปช่องอื่น ย้อนการแก้ หรือวาดล็อกใหม่ไว้หลังล็อกเดิม`,
          'danger',
        )
      }
    }
    if (nextStatus === 'open') {
      if (!totalLots) return toast('วาดล็อกบนผังอย่างน้อยหนึ่งช่องก่อนเปิดรับจอง', 'danger')
      if (!form.venue.trim()) return toast('ใส่สถานที่ก่อนเปิดรับจอง', 'danger')
      if (!form.payment.accountName.trim() || !form.payment.accountNo.trim()) return toast('ใส่บัญชีรับโอนก่อนเปิดรับจอง', 'danger')
      if (form.zones.some((z) => counts[z.id] && z.price <= 0)) return toast('ตั้งราคาทุกโซนที่มีล็อกก่อนเปิดรับจอง', 'danger')
    }

    const keepTitle = existing && title === fullTitle(existing)
    const event: EventRecord = {
      id: existing?.id ?? newEventId(),
      type: form.type,
      status: nextStatus,
      title: keepTitle ? existing.title : title,
      round: keepTitle ? existing.round : undefined,
      organizerId: organizer.id,
      venue: form.venue.trim(),
      hours: form.hours.trim(),
      description: form.description.trim(),
      bookingOpens: form.bookingOpens,
      bookingCloses: form.bookingCloses,
      payment: { bank: form.payment.bank, accountName: form.payment.accountName.trim(), accountNo: form.payment.accountNo.trim() },
      maxLotsPerSeller: form.maxLotsPerSeller,
      autoApprove: form.autoApprove,
      days: days.map((d) => ({ date: d.date, surcharge: d.surcharge })),
      zones: form.zones,
      cols: form.cols,
      rows: form.rows,
      layout: form.layout,
      disabledCells: offCells,
      lotSizes: Object.fromEntries(customSizes.map((c) => [String(c.index), c.size])),
    }
    saveEvent(event)
    const messages: Record<PublishStatus, string> = {
      draft: 'บันทึกร่างแล้ว',
      open: publishStatus === 'open' ? 'บันทึกการแก้ไขแล้ว' : 'เผยแพร่งานแล้ว ผู้ขายจองได้ตามช่วงเปิดรับจอง',
      closed: publishStatus === 'closed' ? 'บันทึกการแก้ไขแล้ว' : 'ปิดรับจองแล้ว',
    }
    toast(messages[nextStatus])
    if (!existing) navigate(`/organizer/editor/${event.id}`, { replace: true })
  }

  return (
    <section>
      <Link to="/organizer/events" className="text-sm text-muted hover:text-ink">
        กลับไปงานของฉัน
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-4 justify-between">
        <input
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="ตั้งชื่องาน"
          className="font-display text-[clamp(1.7rem,3.5vw,2.6rem)] font-bold bg-transparent outline-none border-b-2 border-transparent focus:border-cobalt min-w-0 flex-1 basis-64 placeholder:text-muted/50"
          aria-label="ชื่องาน"
        />
        <div className="flex gap-3 items-center">
          <EventStatusBadge status={status} />
          {status === 'draft' && (
            <>
              <button
                type="button"
                onClick={() => save('draft')}
                className="border-[1.5px] border-cobalt text-cobalt rounded-xl px-4 py-2.5 font-semibold hover:bg-cobalt/5"
              >
                บันทึกร่าง
              </button>
              <button type="button" onClick={() => save('open')} className="bg-cobalt text-oncobalt rounded-xl px-4 py-2.5 font-semibold press">
                เผยแพร่งาน
              </button>
            </>
          )}
          {status !== 'draft' && status !== 'ended' && (
            <button
              type="button"
              onClick={() => save(publishStatus === 'open' ? 'closed' : 'open')}
              className="border-[1.5px] border-cobalt text-cobalt rounded-xl px-4 py-2.5 font-semibold hover:bg-cobalt/5"
            >
              {publishStatus === 'open' ? 'ปิดงาน' : 'เปิดงานอีกครั้ง'}
            </button>
          )}
          {status !== 'draft' && (
            <button
              type="button"
              onClick={() => save(publishStatus)}
              className="bg-cobalt text-oncobalt rounded-xl px-4 py-2.5 font-semibold press"
            >
              บันทึกการแก้ไข
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 grid xl:grid-cols-[1fr_300px] gap-8 items-start">
        <div className="space-y-8 min-w-0">
          <section className="bg-surface border border-line rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">ข้อมูลงาน</h2>
            <div className="mt-5 grid sm:grid-cols-2 gap-5">
              <label>
                <span className="text-sm font-semibold">ประเภทงาน</span>
                <SelectBox value={form.type} onChange={(v) => set('type', v as EventType)} options={EVENT_TYPES} className="mt-2" aria-label="ประเภทงาน" />
              </label>
              <label>
                <span className="text-sm font-semibold">สถานที่</span>
                <input value={form.venue} onChange={(e) => set('venue', e.target.value)} className="fld mt-2" placeholder="เช่น ลานกิจกรรม อาคารเรียนรวม" />
              </label>
              <label>
                <span className="text-sm font-semibold">วันเริ่มงาน</span>
                <input
                  type="date"
                  value={form.start}
                  disabled={hasBookings}
                  onChange={(e) => e.target.value && set('start', e.target.value)}
                  className="fld mt-2 disabled:opacity-60"
                />
              </label>
              <label>
                <span className="text-sm font-semibold">วันสุดท้าย</span>
                <input
                  type="date"
                  value={form.end}
                  min={form.start}
                  disabled={hasBookings}
                  onChange={(e) => e.target.value && set('end', e.target.value)}
                  className="fld mt-2 disabled:opacity-60"
                />
              </label>
              {hasBookings && <p className="sm:col-span-2 -mt-2 text-sm text-muted">งานนี้มีการจองแล้ว จึงเปลี่ยนวันงานไม่ได้</p>}
              {!hasBookings && !days.length && (
                <p className="sm:col-span-2 -mt-2 text-sm text-danger">วันสุดท้ายต้องไม่ก่อนวันเริ่ม และจัดได้ไม่เกิน {MAX_DAYS} วัน</p>
              )}
              <label>
                <span className="text-sm font-semibold">เปิดรับจอง</span>
                <input
                  type="date"
                  value={form.bookingOpens}
                  max={form.bookingCloses}
                  onChange={(e) => e.target.value && set('bookingOpens', e.target.value)}
                  className="fld mt-2"
                />
              </label>
              <label>
                <span className="text-sm font-semibold">ปิดรับจอง</span>
                <input
                  type="date"
                  value={form.bookingCloses}
                  min={form.bookingOpens}
                  max={form.start}
                  onChange={(e) => e.target.value && set('bookingCloses', e.target.value)}
                  className="fld mt-2"
                />
              </label>
              <p className={`sm:col-span-2 -mt-2 text-sm ${windowError ? 'text-danger' : 'text-muted'}`}>
                {windowError || `ผู้ขายจองได้ช่วง ${rangeLabel(form.bookingOpens, form.bookingCloses)}`}
              </p>
              <label>
                <span className="text-sm font-semibold">เวลาขาย</span>
                <input value={form.hours} onChange={(e) => set('hours', e.target.value)} className="fld mt-2" />
              </label>
              <label>
                <span className="text-sm font-semibold">จำนวนล็อกสูงสุดต่อผู้ขาย</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.maxLotsPerSeller ?? ''}
                  onChange={(e) => {
                    // เว้นว่าง = ไม่จำกัด ผู้ขายจองทีละล็อกได้เรื่อยๆ
                    const n = Number(e.target.value.replace(/\D/g, ''))
                    set('maxLotsPerSeller', n >= 1 ? n : null)
                  }}
                  placeholder="ไม่จำกัด"
                  className="fld mt-2"
                  aria-label="จำนวนล็อกสูงสุดต่อผู้ขาย"
                />
                <span className="block mt-1 text-xs text-muted">
                  {form.maxLotsPerSeller === null ? 'เว้นว่างไว้ ผู้ขายหนึ่งร้านจองได้ไม่จำกัด (จองทีละล็อก)' : `ผู้ขายหนึ่งร้านจองได้ไม่เกิน ${form.maxLotsPerSeller} ล็อก (จองทีละล็อก) ลบเลขออกถ้าไม่ต้องการจำกัด`}
                </span>
              </label>
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold">รายละเอียดและกติกาสำหรับผู้ขาย</span>
                <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} className="fld mt-2" />
              </label>
              <label className="sm:col-span-2 flex items-center gap-3">
                <input type="checkbox" checked={form.autoApprove} onChange={(e) => set('autoApprove', e.target.checked)} className="w-4 h-4" />{' '}
                อนุมัติอัตโนมัติเมื่อสลิปถูกต้องและยอดตรง
              </label>
            </div>
          </section>

          <section className="bg-surface border border-line rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">บัญชีรับโอน</h2>
            <p className="text-sm text-muted mt-1">ผู้ขายจะเห็นบัญชีนี้ตอนโอนเงินและแนบสลิป</p>
            <div className="mt-5 grid sm:grid-cols-3 gap-5">
              <label>
                <span className="text-sm font-semibold">ธนาคาร</span>
                <SelectBox value={form.payment.bank} onChange={(bank) => setPayment({ bank })} options={BANKS} className="mt-2" aria-label="ธนาคาร" />
              </label>
              <label>
                <span className="text-sm font-semibold">ชื่อบัญชี</span>
                <input value={form.payment.accountName} onChange={(e) => setPayment({ accountName: e.target.value })} className="fld mt-2" />
              </label>
              <label>
                <span className="text-sm font-semibold">{form.payment.bank === 'พร้อมเพย์' ? 'เบอร์หรือเลขบัตรพร้อมเพย์' : 'เลขบัญชี'}</span>
                <input value={form.payment.accountNo} onChange={(e) => setPayment({ accountNo: e.target.value })} className="fld mt-2" />
              </label>
            </div>
          </section>

          <section className="bg-surface border border-line rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">ผังและโซน</h2>
            <p className="text-sm text-muted mt-1">
              เลือกเครื่องมือ แล้วแตะหรือลากบนตารางเพื่อวาด หนึ่งช่องเท่ากับ {GRID_LIMITS.cellMeters}×{GRID_LIMITS.cellMeters} ม. ล็อกที่ใหญ่กว่านี้กินช่องทางขวาและด้านล่างของตัวเอง รหัสล็อกเรียงให้อัตโนมัติ ผู้ขายจะเห็นผังตามที่วาดนี้
            </p>
            <GridSizeControl cols={form.cols} rows={form.rows} onResize={resize}>
              <button type="button" onClick={applyPreset} className="bg-sun text-onsun rounded-lg px-4 py-2 text-sm font-semibold shadow-sm hover:brightness-95">
                ใช้ผังมาตรฐาน
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, layout: emptyLayout(f.cols, f.rows), disabledCells: [], lotSizes: {} }))}
                className="border-2 border-danger text-danger rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-danger hover:text-white"
              >
                ล้างผัง
              </button>
            </GridSizeControl>
            <EditorToolbar zones={form.zones} tool={tool} onChange={setTool} />
            <div className="mt-5 relative overflow-x-auto">
              <MapCanvas
                layout={form.layout}
                cols={form.cols}
                lotSizes={form.lotSizes}
                sizedCells={customSizes.map((c) => c.index)}
                zones={form.zones}
                disabledCells={offCells}
                onPaint={paintChecked}
                onStroke={() => (warned.current = false)}
              />
            </div>
            {conflicts.length > 0 && (
              <p className="mt-3 text-sm text-danger" role="alert">
                ล็อก {conflicts.map((i) => codes[i]).join(', ')} พื้นที่ไม่พอสำหรับขนาดที่ตั้งไว้ (กรอบแดง แสดงย่อในช่องเดียว) ลบหรือย้ายสิ่งที่อยู่ทางขวา/ด้านล่างของล็อก หรือลดขนาดล็อก
              </p>
            )}
            <BulkLotForm zones={form.zones} emptyCells={freeCells} onAdd={addLots} />
            <ZoneSettingsTable
              zones={form.zones}
              days={days}
              counts={counts}
              offCounts={offCounts}
              onChange={(id, patch) => tryUpdate((f) => ({ ...f, zones: f.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) }))}
              onAdd={addZone}
              onRemove={removeZone}
            />
          </section>

          <DayPricingTable
            days={days}
            zones={form.zones}
            onChange={(date, surcharge) => set('surcharges', { ...form.surcharges, [date]: surcharge })}
          />
        </div>

        <EditorSummary zones={form.zones} counts={bookable} days={days} />
      </div>
    </section>
  )
}
