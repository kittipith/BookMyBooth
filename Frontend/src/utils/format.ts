import type { MarketEvent } from '../types'

const TH_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const TH_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const pad = (n: number) => String(n).padStart(2, '0')

export function parseISO(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISO(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** วันที่และเวลาท้องถิ่น รูปแบบ YYYY-MM-DDTHH:mm */
export function toISODateTime(date: Date) {
  return `${toISO(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function nowISO() {
  return toISODateTime(new Date())
}

/** วันนี้ตามเครื่องของผู้ใช้ */
export const TODAY = toISO(new Date())

export function addDays(iso: string, n: number) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** วันที่ (YYYY-MM-DD) ตามเวลาไทยของเวลา ISO ใดๆ */
export function bangkokDate(iso: string) {
  return new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 10)
}

/** ต้นวัน / ท้ายวันตามเวลาไทย เป็น ISO ที่มี timezone (bookingOpensAt / bookingClosesAt) */
export const bangkokStartOfDay = (date: string) => `${date}T00:00:00+07:00`
export const bangkokEndOfDay = (date: string) => `${date}T23:59:59+07:00`

export function diffDays(from: string, to: string) {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000)
}

export function isWeekend(iso: string) {
  const day = parseISO(iso).getDay()
  return day === 0 || day === 6
}

export function dayLabel(iso: string) {
  const d = parseISO(iso)
  return `${TH_DAYS[d.getDay()]} ${d.getDate()} ${TH_MONTHS[d.getMonth()]}`
}

export function shortDate(iso: string) {
  const d = parseISO(iso)
  return { day: d.getDate(), month: TH_MONTHS[d.getMonth()], label: `${d.getDate()} ${TH_MONTHS[d.getMonth()]}` }
}

export function monthName(iso: string) {
  return TH_MONTHS_FULL[parseISO(iso).getMonth()]
}

/** เช่น 24–26 ต.ค. 2569 หรือ 31 ต.ค.–2 พ.ย. 2569 */
export function rangeLabel(first: string, last: string) {
  const a = parseISO(first)
  const b = parseISO(last)
  const year = b.getFullYear() + 543
  if (first === last) return `${a.getDate()} ${TH_MONTHS[a.getMonth()]} ${year}`
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${TH_MONTHS[b.getMonth()]} ${year}`
  return `${a.getDate()} ${TH_MONTHS[a.getMonth()]}–${b.getDate()} ${TH_MONTHS[b.getMonth()]} ${year}`
}

/**
 * เช่น วันนี้ 09:12, เมื่อวาน 18:40, 17 ต.ค. 14:20
 * เวลาจาก backend เป็น UTC (ลงท้าย Z หรือ ±hh:mm) แปลงเป็นเวลาเครื่องก่อน ส่วนที่ไม่มี timezone ถือเป็นเวลาเครื่องอยู่แล้ว
 */
export function dateTimeLabel(iso: string) {
  const local = /(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? toISODateTime(new Date(iso)) : iso
  const date = local.slice(0, 10)
  const time = local.slice(11, 16)
  const ago = diffDays(date, TODAY)
  if (ago === 0) return `วันนี้ ${time}`
  if (ago === 1) return `เมื่อวาน ${time}`
  return `${shortDate(date).label} ${time}`
}

export function baht(n: number) {
  return `฿${n.toLocaleString('en-US')}`
}

/** ชื่องานพร้อมรอบ ใช้ในหน้าผู้จัดงานที่มีหลายรอบชื่อเดียวกัน */
export function fullTitle(event: Pick<MarketEvent, 'title' | 'round'>) {
  return event.round ? `${event.title} ${event.round}` : event.title
}

export function firstName(fullName: string) {
  return fullName.split(' ')[0]
}

export function initial(name: string) {
  return name.charAt(0)
}
