"""สถิติร้านสำหรับหน้า VendorsPage ของผู้จัดงาน (D5e) คำนวณแบบเดียวกับ shopStats/vendorStats ใน frontend"""

from datetime import datetime
from typing import Any

from domain import booking, events

# ตรงกับ LIMITS.lowShowRate ใน Frontend/src/data/settings.ts
LOW_SHOW_RATE = 60
# ต้องมีงานที่จบแล้วอย่างน้อยเท่านี้ถึงจะติดธง
MIN_PAST_FOR_FLAG = 2


def seller_stats(
    approved: list[dict[str, Any]], event_by_id: dict[str, dict[str, Any]], now: datetime
) -> dict[str, Any]:
    """approved: การจองที่อนุมัติแล้วของร้านเดียว · นับครั้งตามชุด (groupId) ไม่ใช่ตามล็อก (D7)"""
    groups: dict[str, list[dict[str, Any]]] = {}
    for item in approved:
        groups.setdefault(item.get("groupId") or item["bookingId"], []).append(item)
    past = [
        members
        for members in groups.values()
        if members[0]["eventId"] in event_by_id
        and events.display_status(event_by_id[members[0]["eventId"]], now) == events.ENDED
    ]
    showed = sum(1 for members in past if any(item.get("checkedIn") for item in members))
    show_rate = round(showed / len(past) * 100) if past else None
    return {
        "approved": len(groups),
        "total": sum(int(item.get("amount", 0)) for item in approved),
        "pastCount": len(past),
        "showRate": show_rate,
        "flagged": show_rate is not None
        and len(past) >= MIN_PAST_FOR_FLAG
        and show_rate < LOW_SHOW_RATE,
    }


def group_approved_by_seller(bookings: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in bookings:
        if item["status"] == booking.APPROVED:
            grouped.setdefault(item["sellerId"], []).append(item)
    return grouped
