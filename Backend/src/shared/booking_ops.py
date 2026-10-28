"""งานการจองที่ต้องเรียก DynamoDB และใช้ร่วมกันหลาย function (events, bookings, expire_booking)"""

from datetime import datetime
from typing import Any

from boto3.dynamodb.conditions import Key
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


def group_members(seller_id: str, group_id: str) -> list[dict[str, Any]]:
    """ทุก Booking ในชุดเดียวกัน (จองพร้อมกัน) หาจาก GSI bySeller"""
    items = db.query_all(
        "bookings",
        IndexName="bySeller",
        KeyConditionExpression=Key("sellerId").eq(seller_id),
    )
    return [member for member in items if member.get("groupId") == group_id]


def _release_expired(members: list[dict[str, Any]], now: datetime) -> bool:
    return run(
        booking.release_items(
            tables(),
            members,
            to_status=booking.EXPIRED,
            from_statuses=(booking.PENDING_PAYMENT,),
            now=clock.iso(now),
            expired_only=True,
        )
    )


def expire(item: dict[str, Any], now: datetime) -> bool:
    """PENDING_PAYMENT ที่เลย expiresAt → EXPIRED ปล่อยล็อกและคืนโควตา แจ้งเตือนผู้ขาย

    หมดเวลาพร้อมกันทั้งชุด (ล็อกในชุดมี expiresAt เดียวกัน) แจ้งเตือนครั้งเดียว (D7)
    คืน True ถ้า item เป็น EXPIRED แล้ว (รวมกรณีที่ถูกหมดเวลาไปพร้อมล็อกอื่นในชุดก่อนหน้า)
    คืน False ถ้ายังไม่หมดเวลา หรือผู้ขายแนบสลิป/ยกเลิกไปก่อนแล้ว
    """
    if not is_expired(item, now):
        return False
    siblings = [
        member
        for member in group_members(item["sellerId"], item["groupId"])
        if member["bookingId"] != item["bookingId"] and is_expired(member, now)
    ]
    group = [item, *siblings]
    if not _release_expired(group, now):
        # บางล็อกในชุดเปลี่ยนไปแล้ว ลองเฉพาะ item ถ้ายังไม่ได้ ให้ดูสถานะล่าสุด
        if len(group) == 1 or not _release_expired([item], now):
            current = get(item["bookingId"])
            if current:
                item["status"] = current["status"]
            return item["status"] == booking.EXPIRED
        group = [item]

    for member in group:
        member["status"] = booking.EXPIRED
    notify(
        [item["sellerId"]],
        messages.BOOKING_EXPIRED,
        messages.booking_expired(booking.lot_list(group), item.get("eventTitle", "")),
        now=now,
        bookingId=item["bookingId"],
        eventId=item["eventId"],
    )
    return True


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
