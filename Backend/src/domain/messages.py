"""ข้อความแจ้งเตือนภาษาไทย ใช้ถ้อยคำชุดเดียวกับ Frontend/src/data/notifications.ts"""

BOOKING_NEW = "booking_new"
BOOKING_SLIP_UPLOADED = "booking_slip_uploaded"
BOOKING_CANCELLED = "booking_cancelled"
BOOKING_APPROVED = "booking_approved"
BOOKING_MOVED = "booking_moved"
BOOKING_REJECTED = "booking_rejected"
BOOKING_EXPIRED = "booking_expired"
ORGANIZER_PENDING = "organizer_pending"
ORGANIZER_APPROVED = "organizer_approved"
ORGANIZER_REJECTED = "organizer_rejected"
ACCOUNT_SUSPENDED = "account_suspended"
ACCOUNT_UNSUSPENDED = "account_unsuspended"


def booking_new(shop: str, lot: str, event: str) -> str:
    # D3: จองก่อนแล้วค่อยแนบสลิป ข้อความจึงต่างจาก frontend ที่ว่า "พร้อมแนบสลิปแล้ว"
    return f"{shop} ส่งคำขอจองล็อก {lot} ใน{event} รอผู้ขายแนบสลิป"


def booking_slip_uploaded(shop: str, lot: str, event: str) -> str:
    return f"{shop} แนบสลิปการจองล็อก {lot} ใน{event} แล้ว รอคุณตรวจสอบ"


def booking_cancelled_by_seller(shop: str, lot: str, event: str) -> str:
    return f"{shop} ยกเลิกคำขอจองล็อก {lot} ใน{event}"


def booking_approved(lot: str, event: str) -> str:
    # ตัด "ดู QR เช็กอินได้เลย" ของ frontend ออก เพราะเช็กอิน QR ยังนอก scope (D5)
    return f"การจองล็อก {lot} ใน{event} ได้รับอนุมัติแล้ว"


def booking_moved(from_lot: str, to_lot: str, event: str) -> str:
    return f"ผู้จัดงานย้ายการจองของคุณจากล็อก {from_lot} ไปล็อก {to_lot} ใน{event} และอนุมัติแล้ว"


def booking_rejected(lot: str, event: str, reason: str) -> str:
    return f"คำขอจองล็อก {lot} ใน{event} ไม่ได้รับอนุมัติ: {reason}"


def booking_cancelled_by_organizer(lot: str, event: str, reason: str) -> str:
    return f"ผู้จัดงานยกเลิกการจองล็อก {lot} ใน{event}: {reason}"


def booking_expired(lot: str, event: str) -> str:
    return f"การจองล็อก {lot} ใน{event} หมดเวลาแนบสลิปแล้ว ล็อกถูกปล่อยให้ผู้อื่นจองได้"


def organizer_pending(org: str) -> str:
    return f"{org} สมัครเป็นผู้จัดงาน รอคุณตรวจสอบ"


def organizer_approved() -> str:
    return "บัญชีผู้จัดงานของคุณได้รับอนุมัติแล้ว เริ่มสร้างงานได้เลย"


def organizer_rejected(reason: str) -> str:
    return f"บัญชีผู้จัดงานของคุณไม่ได้รับอนุมัติ: {reason}"


def account_suspended(reason: str) -> str:
    return f"บัญชีของคุณถูกระงับ: {reason}"


def account_unsuspended() -> str:
    return "บัญชีของคุณใช้งานได้อีกครั้งแล้ว"
