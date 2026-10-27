"""งานการจองที่ต้องเรียก DynamoDB และใช้ร่วมกันหลาย function (events, bookings, expire_booking)"""

from datetime import datetime
from typing import Any

from botocore.exceptions import ClientError

from domain import booking, lots, messages
from shared import clock, db
from shared.notify import notify


def tables() -> booking.Tables:
    return booking.Tables(lots=db.table_name("lots"), bookings=db.table_name("bookings"))


def get(booking_id: str) -> dict[str, Any] | None:
    return db.table("bookings").get_item(Key={"bookingId": booking_id}).get("Item")


def run(items: list[dict[str, Any]]) -> bool:
    """True ถ้าสำเร็จ False ถ้า condition ไม่ผ่าน (สถานะเปลี่ยนไปแล้ว)"""
    try:
        db.transact_write(items)
        return True
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "TransactionCanceledException":
            return False
        raise


def is_expired(item: dict[str, Any], now: datetime) -> bool:
    return item["status"] == booking.PENDING_PAYMENT and item["expiresAt"] <= clock.iso(now)


def expire(item: dict[str, Any], now: datetime) -> bool:
    """PENDING_PAYMENT ที่เลย expiresAt → EXPIRED ปล่อยล็อกและคืนโควตา แจ้งเตือนผู้ขาย

    คืน False ถ้ายังไม่หมดเวลา หรือผู้ขายแนบสลิป/ยกเลิกไปก่อนแล้ว
    """
    if not is_expired(item, now):
        return False
    released = run(
        booking.release_items(
            tables(),
            item,
            to_status=booking.EXPIRED,
            from_statuses=(booking.PENDING_PAYMENT,),
            now=clock.iso(now),
            expired_only=True,
        )
    )
    if released:
        item["status"] = booking.EXPIRED
        notify(
            [item["sellerId"]],
            messages.BOOKING_EXPIRED,
            messages.booking_expired(item["lotId"], item.get("eventTitle", "")),
            now=now,
            bookingId=item["bookingId"],
            eventId=item["eventId"],
        )
    return released


def expire_stale_lots(lot_items: list[dict[str, Any]], now: datetime) -> None:
    """fallback ข้อ 7.6: ล็อก HELD ที่เลย holdExpiresAt ให้หมดเวลาการจองก่อนใช้งาน

    แก้ lot_items ในที่ ให้ผู้เรียกเห็นสถานะใหม่ทันที
    """
    timestamp = clock.iso(now)
    for lot in lot_items:
        if lot.get("status") != lots.HELD or lot.get("holdExpiresAt", "~") > timestamp:
            continue
        held_by = get(lot["bookingId"]) if lot.get("bookingId") else None
        if held_by and expire(held_by, now):
            lot["status"] = lots.AVAILABLE
            lot.pop("bookingId", None)
            lot.pop("holdExpiresAt", None)
