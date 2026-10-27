"""งานในตาราง Events (PLAN หัวข้อ 4.2)"""

from datetime import datetime, timedelta, timezone
from typing import Any

from shared import clock

# สถานะที่ผู้จัดงานตั้ง (เก็บใน publishStatus)
DRAFT = "DRAFT"
OPEN = "OPEN"
CLOSED = "CLOSED"
PUBLISH_STATUSES = (DRAFT, OPEN, CLOSED)

# สถานะที่คำนวณเพิ่มตอนส่งออก (field `status`)
SCHEDULED = "SCHEDULED"  # เปิดแล้วแต่ยังไม่ถึงเวลาเปิดรับจอง
ENDED = "ENDED"  # เลยวันสุดท้ายของงานแล้ว

EVENT_TYPES = ("ตลาดนัด", "งานแฟร์", "งานมหาวิทยาลัย")

# วันที่ของงานเป็นเวลาไทย (ไม่มี daylight saving)
BANGKOK = timezone(timedelta(hours=7))

# ฟิลด์ที่ผู้จัดงานแก้ได้ผ่าน POST/PUT /events (ต้องตรงกับ EventInput)
EDITABLE_FIELDS = (
    "title",
    "round",
    "type",
    "description",
    "venue",
    "hours",
    "startDate",
    "endDate",
    "bookingOpensAt",
    "bookingClosesAt",
    "payment",
    "maxLotsPerSeller",
    "slipDeadlineMinutes",
    "zones",
    "cols",
    "rows",
    "layout",
    "disabledCells",
    "lotSizes",
)

# ข้อมูลผังและบัญชีรับเงิน ไม่ต้องส่งในหน้ารายการงาน
_DETAIL_ONLY_FIELDS = frozenset({"payment", "layout", "disabledCells", "lotSizes"})


def display_status(event: dict[str, Any], now: datetime) -> str:
    publish_status = event["publishStatus"]
    if publish_status == DRAFT:
        return DRAFT
    if now.astimezone(BANGKOK).date().isoformat() > event["endDate"]:
        return ENDED
    if publish_status == CLOSED:
        return CLOSED
    timestamp = clock.iso(now)
    if timestamp < event["bookingOpensAt"]:
        return SCHEDULED
    if timestamp >= event["bookingClosesAt"]:
        return CLOSED
    return OPEN


def is_booking_open(event: dict[str, Any], now: datetime) -> bool:
    return display_status(event, now) == OPEN


def is_event_day(event: dict[str, Any], now: datetime) -> bool:
    """วันนี้ (เวลาไทย) อยู่ระหว่างวันแรกถึงวันสุดท้ายของงาน ใช้กับเช็กอิน (D5b)"""
    today = now.astimezone(BANGKOK).date().isoformat()
    return event["startDate"] <= today <= event["endDate"]


def editable_fields(event: dict[str, Any]) -> dict[str, Any]:
    return {key: event[key] for key in EDITABLE_FIELDS if key in event}


def detail_view(event: dict[str, Any], now: datetime) -> dict[str, Any]:
    return {**event, "status": display_status(event, now)}


def list_view(event: dict[str, Any], now: datetime) -> dict[str, Any]:
    view = {key: value for key, value in event.items() if key not in _DETAIL_ONLY_FIELDS}
    view["status"] = display_status(event, now)
    return view


def zone_ids(event: dict[str, Any]) -> set[str]:
    return {zone["id"] for zone in event.get("zones", [])}
