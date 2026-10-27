/**
 * ร่างการจองระหว่างเลือกล็อกบนผัง → กรอกข้อมูลร้าน (ยังไม่ได้ส่งไป backend)
 * เก็บใน sessionStorage รีเฟรชหน้าแล้วยังอยู่ ปิดแท็บแล้วหาย
 */
const KEY = 'bookmybooth-booking-draft'

export interface BookingDraft {
  eventId: string
  lots: string[]
}

export function readDraft(): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as BookingDraft) : null
  } catch {
    return null
  }
}

export function writeDraft(draft: BookingDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    // เก็บไม่ได้ ผู้ใช้เลือกล็อกใหม่ได้
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ไม่เป็นไร
  }
}
