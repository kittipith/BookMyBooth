/** ข้อความแจ้งเตือนในเว็บ แยกตามเหตุการณ์ */

export const NOTICE = {
  bookingNew: (shop: string, lot: string, event: string) => `${shop} ส่งคำขอจองล็อก ${lot} ใน${event} พร้อมแนบสลิปแล้ว`,
  bookingCancelledBySeller: (shop: string, lot: string, event: string) => `${shop} ยกเลิกคำขอจองล็อก ${lot} ใน${event}`,
  bookingApproved: (lot: string, event: string) => `การจองล็อก ${lot} ใน${event} ได้รับอนุมัติแล้ว ดู QR เช็กอินได้เลย`,
  bookingMoved: (from: string, to: string, event: string) => `ผู้จัดงานย้ายการจองของคุณจากล็อก ${from} ไปล็อก ${to} ใน${event} และอนุมัติแล้ว`,
  bookingRejected: (lot: string, event: string, reason: string) => `คำขอจองล็อก ${lot} ใน${event} ไม่ได้รับอนุมัติ: ${reason}`,
  bookingCancelled: (lot: string, event: string, reason: string) => `ผู้จัดงานยกเลิกการจองล็อก ${lot} ใน${event}: ${reason}`,
  organizerPending: (org: string) => `${org} สมัครเป็นผู้จัดงาน รอคุณตรวจสอบ`,
  organizerApproved: () => 'บัญชีผู้จัดงานของคุณได้รับอนุมัติแล้ว เริ่มสร้างงานได้เลย',
  organizerRejected: (reason: string) => `บัญชีผู้จัดงานของคุณไม่ได้รับอนุมัติ: ${reason}`,
  accountSuspended: (reason: string) => `บัญชีของคุณถูกระงับ: ${reason}`,
}
