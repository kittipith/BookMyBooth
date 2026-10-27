import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { isApiError } from '../../api/client'
import type { EventInputDto, LotInputDto, UserDto } from '../../api/dto'
import { EventStatusBadge } from '../../components/common/StatusBadge'
import BulkLotForm from '../../components/organizer/editor/BulkLotForm'
import EditorSummary from '../../components/organizer/editor/EditorSummary'
import EditorToolbar, { ERASE } from '../../components/organizer/editor/EditorToolbar'
import GridSizeControl from '../../components/organizer/editor/GridSizeControl'
import MapCanvas from '../../components/organizer/editor/MapCanvas'
import ZoneSettingsTable from '../../components/organizer/editor/ZoneSettingsTable'
import ConfirmDialog from '../../components/popup/ConfirmDialog'
import { BANKS, EVENT_TYPES } from '../../data/options'
import { EVENT_DEFAULTS, GRID_LIMITS, LIMITS } from '../../data/settings'
import { DEFAULT_ZONES, NEW_ZONE, ZONE_LETTERS } from '../../data/zones'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useEventLots } from '../../queries/events'
import { useCloseEvent, useMyEvents, useSaveEvent, type SaveEventError } from '../../queries/organizer'
import type { CellType, EventType, PaymentAccount, PublicEvent, Zone } from '../../types'
import { addDays, bangkokDate, bangkokEndOfDay, bangkokStartOfDay, diffDays, fullTitle, rangeLabel, TODAY } from '../../utils/format'
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

/** เวลาแนบสลิปเริ่มต้น 24 ชม. backend รับ 2 นาที – 7 วัน (สั้นๆ ใช้ทดสอบหมดเวลา) */
const SLIP_MINUTES = { default: 24 * 60, min: 2, max: 7 * 24 * 60 }

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
  /** วันที่ตามเวลาไทย ส่งเป็นต้นวัน / ท้ายวัน */
  bookingOpens: string
  bookingCloses: string
  payment: PaymentAccount
  maxLotsPerSeller: number | null
  slipDeadlineMinutes: number
  description: string
  cols: number
  rows: number
  layout: CellType[]
  disabledCells: number[]
  lotSizes: Record<string, string>
  /** ช่องนี้มาจากช่องไหนของผังที่บันทึกไว้ (-1 = ช่องใหม่) ใช้ตรวจว่าล็อกที่มีการจองเลื่อนตำแหน่งหรือไม่ */
  origins: number[]
  zones: Zone[]
}

function fromEvent(e: PublicEvent): EditorForm {
  return {
    title: fullTitle(e),
    type: e.type,
    venue: e.venue,
    start: e.startDate,
    end: e.endDate,
    hours: e.hours,
    bookingOpens: bangkokDate(e.bookingOpensAt),
    bookingCloses: bangkokDate(e.bookingClosesAt),
    payment: e.payment ? { ...e.payment } : { bank: BANKS[0], accountName: '', accountNo: '' },
    maxLotsPerSeller: e.maxLotsPerSeller,
    slipDeadlineMinutes: e.slipDeadlineMinutes,
    description: e.description,
    cols: e.cols,
    rows: e.rows,
    layout: [...e.layout],
    disabledCells: [...e.disabledCells],
    lotSizes: { ...e.lotSizes },
    origins: e.layout.map((_, i) => i),
    zones: e.zones.map((z) => ({ ...z })),
  }
}

/** งานใหม่ บัญชีรับโอนเติมจากโปรไฟล์ผู้จัดงาน (F32) */
function blankForm(me: UserDto): EditorForm {
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
    payment: me.payment ? { ...me.payment } : { bank: BANKS[0], accountName: me.orgName ?? '', accountNo: me.phone ?? '' },
    maxLotsPerSeller: EVENT_DEFAULTS.maxLotsPerSeller,
    slipDeadlineMinutes: SLIP_MINUTES.default,
    description: '',
    cols: STANDARD_COLS,
    rows: STANDARD_ROWS,
    layout: emptyLayout(),
    disabledCells: [],
    lotSizes: {},
    origins: emptyLayout().map(() => -1),
    zones: DEFAULT_ZONES.map((z) => ({ ...z, amenities: [...z.amenities] })),
  }
}

/** ข้อมูลงานสำหรับ POST /events และ PUT /events/{id} (F10) */
function toEventInput(
  form: EditorForm,
  title: string,
  round: string | undefined,
  offCells: number[],
  lotSizes: Record<string, string>,
): EventInputDto {
  return {
    title,
    round: round ?? null,
    type: form.type,
    description: form.description.trim(),
    venue: form.venue.trim(),
    hours: form.hours.trim(),
    startDate: form.start,
    endDate: form.end,
    // เปิดตั้งแต่ต้นวันแรก ถึงท้ายวันสุดท้ายของช่วงรับจอง (เวลาไทย)
    bookingOpensAt: bangkokStartOfDay(form.bookingOpens),
    bookingClosesAt: bangkokEndOfDay(form.bookingCloses),
    payment: { bank: form.payment.bank, accountName: form.payment.accountName.trim(), accountNo: form.payment.accountNo.trim() },
    maxLotsPerSeller: form.maxLotsPerSeller,
    slipDeadlineMinutes: form.slipDeadlineMinutes,
    zones: form.zones,
    cols: form.cols,
    rows: form.rows,
    layout: form.layout,
    disabledCells: offCells,
    lotSizes,
  }
}

/** ล็อกทุกล็อกตามผัง สำหรับ PUT /events/{id}/lots (F12) */
function lotsOfForm(form: EditorForm, offCells: number[], lotSizes: Record<string, string>): LotInputDto[] {
  const codes = lotCodes(form.layout)
  return form.layout.flatMap((cell, i) => {
    const code = codes[i]
    return code && isZoneCell(cell) ? [{ lotId: code, zoneId: cell, size: lotSizes[String(i)] ?? null, disabled: offCells.includes(i) }] : []
  })
}

/** ข้อความจาก error ของ backend ตอนบันทึก */
function saveErrorMessage(error: unknown): string {
  if (isApiError(error, 'LOT_IN_USE')) {
    const ids = (error.details as { lotIds?: string[] } | undefined)?.lotIds ?? []
    return `ล็อก ${ids.join(', ')} มีผู้จองอยู่ แก้ไขหรือลบไม่ได้ ย้อนการแก้ล็อกนี้แล้วบันทึกใหม่`
  }
  if (isApiError(error, 'VALIDATION_ERROR')) {
    const first = (error.details as { field: string; message: string }[] | undefined)?.[0]
    return first ? `ข้อมูลไม่ถูกต้อง: ${first.field || 'งาน'} ${first.message}` : error.message
  }
  return error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'
}

export default function MapEditorPage() {
  const { eventId } = useParams()
  const { me } = useAuth()
  const { data: myEvents, isPending } = useMyEvents()
  const event = eventId ? myEvents?.find((e) => e.id === eventId) : undefined

  if (!me) return null
  if (eventId && isPending) return <p className="py-16 text-center text-muted">กำลังโหลดงาน…</p>
  if (eventId && !event) {
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
  return <MapEditor key={eventId ?? 'new'} existing={event} me={me} />
}

function MapEditor({ existing, me }: { existing?: PublicEvent; me: UserDto }) {
  const navigate = useNavigate()
  const toast = useToast()
  const save = useSaveEvent()
  const close = useCloseEvent()
  const [confirmClose, setConfirmClose] = useState(false)
  // สถานะล็อกจริงของงานที่เผยแพร่แล้ว (ฉบับร่างยังไม่มีใครจอง)
  const { data: lotStates } = useEventLots(existing && existing.publishStatus !== 'draft' ? existing.id : undefined)
  const [form, setForm] = useState<EditorForm>(() => (existing ? fromEvent(existing) : blankForm(me)))
  const [tool, setTool] = useState<string>(form.zones[0]?.id ?? ERASE)
  // เตือนเรื่องพื้นที่ไม่พอครั้งเดียวต่อการลากหนึ่งเส้น
  const warned = useRef(false)

  const status = existing?.status ?? 'draft'
  const publishStatus = existing?.publishStatus ?? 'draft'
  // งานที่ปิดแล้ว backend ไม่ให้แก้ (EVENT_CLOSED)
  const readOnly = publishStatus === 'closed'
  const busy = save.isPending || close.isPending
  // ล็อกที่มีผู้จองหรือรอสลิปอยู่ ห้ามลบหรือเลื่อนรหัส
  const bookedCodes = Object.entries(lotStates ?? {})
    .filter(([, state]) => state === 'pending' || state === 'booked')
    .map(([code]) => code)
  const hasBookings = bookedCodes.length > 0

  const set = <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setPayment = (patch: Partial<PaymentAccount>) => setForm((f) => ({ ...f, payment: { ...f.payment, ...patch } }))

  // จองทั้งงาน ราคาต่อล็อก = ราคาโซน ไม่มีราคารายวัน (F11)
  const span = diffDays(form.start, form.end)
  const dayCount = span < 0 || span >= MAX_DAYS ? 0 : span + 1

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
    if (readOnly) return
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

  /** บันทึกงาน (publish = เผยแพร่ฉบับร่างด้วย) */
  const submit = (publish: boolean) => {
    if (readOnly || busy) return
    const title = form.title.trim()
    if (!title) return toast('ใส่ชื่องานก่อนบันทึก', 'danger')
    if (!dayCount) return toast(`วันสุดท้ายต้องไม่ก่อนวันเริ่ม และจัดได้ไม่เกิน ${MAX_DAYS} วัน`, 'danger')
    if (windowError) return toast(windowError, 'danger')
    // backend ต้องมีสถานที่และบัญชีรับโอนตั้งแต่ฉบับร่าง
    if (!form.venue.trim()) return toast('ใส่สถานที่ก่อนบันทึก', 'danger')
    if (!form.payment.accountName.trim() || !form.payment.accountNo.trim()) return toast('ใส่บัญชีรับโอนก่อนบันทึก', 'danger')
    if (existing) {
      const moved = movedBookedLots(existing.layout, form.layout, form.origins, bookedCodes)
      if (moved.length) {
        return toast(
          `ล็อก ${moved.join(', ')} มีการจองอยู่ แต่การแก้ผังนี้ทำให้ล็อกถูกลบหรือรหัสเลื่อนไปช่องอื่น ย้อนการแก้ หรือวาดล็อกใหม่ไว้หลังล็อกเดิม`,
          'danger',
        )
      }
    }
    if (publish || publishStatus === 'open') {
      if (!totalLots) return toast('วาดล็อกบนผังอย่างน้อยหนึ่งช่องก่อนเปิดรับจอง', 'danger')
      if (form.zones.some((z) => counts[z.id] && z.price <= 0)) return toast('ตั้งราคาทุกโซนที่มีล็อกก่อนเปิดรับจอง', 'danger')
    }

    const keepTitle = existing && title === fullTitle(existing)
    const lotSizes = Object.fromEntries(customSizes.map((c) => [String(c.index), c.size]))
    save.mutate(
      {
        eventId: existing?.id,
        previousZones: existing?.zones ?? [],
        input: toEventInput(form, keepTitle ? existing.title : title, keepTitle ? existing.round : undefined, offCells, lotSizes),
        lots: lotsOfForm(form, offCells, lotSizes),
        publish,
      },
      {
        onSuccess: (saved) => {
          toast(publish ? 'เผยแพร่งานแล้ว ผู้ขายจองได้ตามช่วงเปิดรับจอง' : publishStatus === 'open' ? 'บันทึกการแก้ไขแล้ว' : 'บันทึกร่างแล้ว')
          // ผังที่บันทึกแล้วกลายเป็นตำแหน่งตั้งต้นของการแก้ครั้งต่อไป
          setForm((f) => ({ ...f, origins: f.layout.map((_, i) => i) }))
          if (!existing) navigate(`/organizer/editor/${saved.id}`, { replace: true })
        },
        onError: (error) => {
          toast(saveErrorMessage(error), 'danger')
          // สร้างงานไปแล้วแต่ขั้นต่อไปล้ม ไปแก้ต่อจากงานนั้น ไม่สร้างซ้ำ
          const savedId = (error as SaveEventError).savedEventId
          if (!existing && savedId) navigate(`/organizer/editor/${savedId}`, { replace: true })
        },
      },
    )
  }

  const closeBooking = () => {
    setConfirmClose(false)
    if (existing) close.mutate(existing.id, { onSuccess: () => toast('ปิดรับจองแล้ว') })
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
          readOnly={readOnly}
          maxLength={200}
          className="font-display text-[clamp(1.7rem,3.5vw,2.6rem)] font-bold bg-transparent outline-none border-b-2 border-transparent focus:border-cobalt min-w-0 flex-1 basis-64 placeholder:text-muted/50"
          aria-label="ชื่องาน"
        />
        <div className="flex gap-3 items-center">
          <EventStatusBadge status={status} />
          {publishStatus === 'draft' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => submit(false)}
                className="border-[1.5px] border-cobalt text-cobalt rounded-xl px-4 py-2.5 font-semibold hover:bg-cobalt/5 disabled:opacity-50"
              >
                บันทึกร่าง
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => submit(true)}
                className="bg-cobalt text-oncobalt rounded-xl px-4 py-2.5 font-semibold press disabled:opacity-50"
              >
                เผยแพร่งาน
              </button>
            </>
          )}
          {publishStatus === 'open' && (
            <>
              {status !== 'ended' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmClose(true)}
                  className="border-[1.5px] border-cobalt text-cobalt rounded-xl px-4 py-2.5 font-semibold hover:bg-cobalt/5 disabled:opacity-50"
                >
                  ปิดรับจอง
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => submit(false)}
                className="bg-cobalt text-oncobalt rounded-xl px-4 py-2.5 font-semibold press disabled:opacity-50"
              >
                บันทึกการแก้ไข
              </button>
            </>
          )}
          {busy && <span className="text-sm text-muted">กำลังบันทึก…</span>}
        </div>
      </div>
      {readOnly && <p className="mt-4 rounded-xl bg-mist px-4 py-3 text-sm">งานนี้ปิดรับจองแล้ว ดูผังได้อย่างเดียว แก้ไขหรือเปิดใหม่ไม่ได้</p>}
      <ConfirmDialog
        open={confirmClose}
        title="ปิดรับจอง"
        message="ผู้ขายจะจองงานนี้เพิ่มไม่ได้ การจองที่มีอยู่ยังตรวจและอนุมัติต่อได้ ปิดแล้วเปิดใหม่หรือแก้ไขงานไม่ได้"
        confirmLabel="ปิดรับจอง"
        onConfirm={closeBooking}
        onClose={() => setConfirmClose(false)}
      />

      <fieldset disabled={readOnly} className="mt-8 grid xl:grid-cols-[1fr_300px] gap-8 items-start min-w-0">
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
                <input
                  value={form.venue}
                  maxLength={300}
                  onChange={(e) => set('venue', e.target.value)}
                  className="fld mt-2"
                  placeholder="เช่น ลานกิจกรรม อาคารเรียนรวม"
                />
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
              {!hasBookings && !dayCount && (
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
                <input value={form.hours} maxLength={100} onChange={(e) => set('hours', e.target.value)} className="fld mt-2" />
              </label>
              <label>
                <span className="text-sm font-semibold">จำนวนล็อกสูงสุดต่อผู้ขาย</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.maxLotsPerSeller ?? ''}
                  onChange={(e) => {
                    // เว้นว่าง = ไม่จำกัด
                    const n = Number(e.target.value.replace(/\D/g, ''))
                    set('maxLotsPerSeller', n >= 1 ? Math.min(n, 50) : null)
                  }}
                  placeholder="ไม่จำกัด"
                  className="fld mt-2"
                  aria-label="จำนวนล็อกสูงสุดต่อผู้ขาย"
                />
                <span className="block mt-1 text-xs text-muted">
                  {form.maxLotsPerSeller === null
                    ? 'เว้นว่างไว้ ผู้ขายหนึ่งร้านจองได้ไม่จำกัด'
                    : `ผู้ขายหนึ่งร้านจองได้ไม่เกิน ${form.maxLotsPerSeller} ล็อก ลบเลขออกถ้าไม่ต้องการจำกัด`}
                </span>
              </label>
              <label>
                <span className="text-sm font-semibold">เวลาแนบสลิปหลังจอง (นาที)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.slipDeadlineMinutes || ''}
                  onChange={(e) => set('slipDeadlineMinutes', Number(e.target.value.replace(/\D/g, '')) || 0)}
                  onBlur={() => set('slipDeadlineMinutes', Math.min(SLIP_MINUTES.max, Math.max(SLIP_MINUTES.min, form.slipDeadlineMinutes)))}
                  className="fld mt-2"
                  aria-label="เวลาแนบสลิปหลังจอง (นาที)"
                />
                <span className="block mt-1 text-xs text-muted">
                  ไม่แนบสลิปภายในเวลานี้ การจองหมดเวลาและล็อกกลับมาว่าง (1440 = 24 ชม. ได้ {SLIP_MINUTES.min}–{SLIP_MINUTES.max} นาที)
                </span>
              </label>
              <label className="sm:col-span-2">
                <span className="text-sm font-semibold">รายละเอียดและกติกาสำหรับผู้ขาย</span>
                <textarea rows={3} maxLength={5000} value={form.description} onChange={(e) => set('description', e.target.value)} className="fld mt-2" />
              </label>
            </div>
          </section>

          <section className="bg-surface border border-line rounded-2xl p-6">
            <h2 className="font-display text-xl font-semibold">บัญชีรับโอน</h2>
            <p className="text-sm text-muted mt-1">ผู้ขายจะเห็นบัญชีนี้ตอนโอนเงินและแนบสลิป{!existing && ' ค่าตั้งต้นมาจากข้อมูลผู้จัดงาน'}</p>
            <div className="mt-5 grid sm:grid-cols-3 gap-5">
              <label>
                <span className="text-sm font-semibold">ธนาคาร</span>
                <SelectBox value={form.payment.bank} onChange={(bank) => setPayment({ bank })} options={BANKS} className="mt-2" aria-label="ธนาคาร" />
              </label>
              <label>
                <span className="text-sm font-semibold">ชื่อบัญชี</span>
                <input value={form.payment.accountName} maxLength={100} onChange={(e) => setPayment({ accountName: e.target.value })} className="fld mt-2" />
              </label>
              <label>
                <span className="text-sm font-semibold">{form.payment.bank === 'พร้อมเพย์' ? 'เบอร์หรือเลขบัตรพร้อมเพย์' : 'เลขบัญชี'}</span>
                <input value={form.payment.accountNo} maxLength={30} onChange={(e) => setPayment({ accountNo: e.target.value })} className="fld mt-2" />
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
            {hasBookings && (
              <p className="mt-3 text-sm text-muted">ล็อกที่มีการจองแล้ว ({bookedCodes.sort().join(', ')}) ห้ามลบหรือทำให้รหัสเลื่อน วาดล็อกใหม่ไว้หลังล็อกเดิม</p>
            )}
            <BulkLotForm zones={form.zones} emptyCells={freeCells} onAdd={addLots} />
            <ZoneSettingsTable
              zones={form.zones}
              dayCount={dayCount}
              counts={counts}
              offCounts={offCounts}
              onChange={(id, patch) => tryUpdate((f) => ({ ...f, zones: f.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) }))}
              onAdd={addZone}
              onRemove={removeZone}
            />
          </section>
        </div>

        <EditorSummary zones={form.zones} counts={bookable} dayCount={dayCount} />
      </fieldset>
    </section>
  )
}
