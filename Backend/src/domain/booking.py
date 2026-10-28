"""สถานะการจองและ TransactItems ของทุกการเปลี่ยนสถานะ (PLAN หัวข้อ 7)

ทุกฟังก์ชันคืน list ของ TransactItems สำหรับ dynamodb client.transact_write_items
ไม่เรียก AWS เอง จึงทดสอบได้โดยไม่ต้องต่อ AWS

Lot ที่ถูกจองเก็บ bookingId และ holdExpiresAt (สำเนา expiresAt ของการจอง) ไว้ด้วย
ให้หาล็อกที่หมดเวลาได้จากตาราง Lots ตรง ๆ (fallback ข้อ 7.6)
"""

from dataclasses import dataclass
from typing import Any

from boto3.dynamodb.types import TypeSerializer

from domain import lots

PENDING_PAYMENT = "PENDING_PAYMENT"
PENDING_REVIEW = "PENDING_REVIEW"
APPROVED = "APPROVED"
REJECTED = "REJECTED"
CANCELLED = "CANCELLED"
EXPIRED = "EXPIRED"
STATUSES = (PENDING_PAYMENT, PENDING_REVIEW, APPROVED, REJECTED, CANCELLED, EXPIRED)

# ผู้ขายยกเลิกเองได้ก่อนผู้จัดงานตัดสิน
SELLER_CANCELLABLE = (PENDING_PAYMENT, PENDING_REVIEW)
# ผู้จัดงานยกเลิกได้หลังอนุมัติแล้ว (ก่อนอนุมัติให้ใช้ปฏิเสธ)
ORGANIZER_CANCELLABLE = (APPROVED,)
# จบแล้ว ไม่นับเป็นสมาชิกของชุดที่ยังดำเนินการอยู่
FINAL = (REJECTED, CANCELLED, EXPIRED)

_serialize = TypeSerializer().serialize

# ฟิลด์ภายในที่ไม่ส่งออกไปหน้าเว็บ
_INTERNAL_FIELDS = frozenset({"statusCreatedAt"})


@dataclass(frozen=True)
class Tables:
    lots: str
    bookings: str


def _values(**values: Any) -> dict[str, Any]:
    return {f":{key}": _serialize(value) for key, value in values.items()}


def _key(**key: Any) -> dict[str, Any]:
    return {name: _serialize(value) for name, value in key.items()}


def status_created_at(status: str, created_at: str) -> str:
    """SK ของ GSI byEventStatus เช่น PENDING_REVIEW#2026-11-01T..."""
    return f"{status}#{created_at}"


def quota_key(seller_id: str) -> str:
    return f"{lots.QUOTA_PREFIX}{seller_id}"


def new_booking(
    *,
    booking_id: str,
    group_id: str,
    event: dict[str, Any],
    lot_id: str,
    seller_id: str,
    shop: dict[str, Any],
    amount: int,
    created_at: str,
    expires_at: str,
) -> dict[str, Any]:
    """shop: shopName, productDescription และข้อมูลเสริม category/staff/power/note (D5c)"""
    return {
        **shop,
        "bookingId": booking_id,
        "groupId": group_id,
        "eventId": event["eventId"],
        "eventTitle": event["title"],
        "organizerId": event["organizerId"],
        "lotId": lot_id,
        "sellerId": seller_id,
        "status": PENDING_PAYMENT,
        "statusCreatedAt": status_created_at(PENDING_PAYMENT, created_at),
        "amount": amount,
        "expiresAt": expires_at,
        "moves": [],
        "createdAt": created_at,
        "updatedAt": created_at,
    }


def create_items(
    tables: Tables, bookings: list[dict[str, Any]], max_lots: int | None
) -> list[dict[str, Any]]:
    """จองหลายล็อกแบบ all-or-nothing (ข้อ 7.1)

    ลำดับ: Update Lot × N, Put Booking × N, Update Quota
    index ใน CancellationReasons จึงบอกได้ว่าล็อกไหนไม่ว่าง (0..N-1) หรือโควตาเต็ม (2N)
    """
    first = bookings[0]
    now = first["createdAt"]
    items: list[dict[str, Any]] = []
    for booking in bookings:
        items.append(
            {
                "Update": {
                    "TableName": tables.lots,
                    "Key": _key(eventId=booking["eventId"], lotId=booking["lotId"]),
                    "UpdateExpression": "SET #status = :held, bookingId = :id, "
                    "holdExpiresAt = :expires, updatedAt = :now",
                    "ConditionExpression": "#status = :available",
                    "ExpressionAttributeNames": {"#status": "status"},
                    "ExpressionAttributeValues": _values(
                        held=lots.HELD,
                        available=lots.AVAILABLE,
                        id=booking["bookingId"],
                        expires=booking["expiresAt"],
                        now=now,
                    ),
                }
            }
        )
    for booking in bookings:
        items.append(
            {
                "Put": {
                    "TableName": tables.bookings,
                    "Item": {key: _serialize(value) for key, value in booking.items()},
                    "ConditionExpression": "attribute_not_exists(bookingId)",
                }
            }
        )

    quota: dict[str, Any] = {
        "TableName": tables.lots,
        "Key": _key(eventId=first["eventId"], lotId=quota_key(first["sellerId"])),
        "UpdateExpression": "ADD #count :n SET updatedAt = :now",
        "ExpressionAttributeNames": {"#count": "count"},
        "ExpressionAttributeValues": _values(n=len(bookings), now=now),
    }
    if max_lots is not None:
        # ยังไม่มี count = ยังไม่เคยจอง (ตรวจ N ≤ max ใน handler แล้ว)
        quota["ConditionExpression"] = "attribute_not_exists(#count) OR #count <= :limit"
        quota["ExpressionAttributeValues"].update(_values(limit=max_lots - len(bookings)))
    items.append({"Update": quota})
    return items


def slip_items(
    tables: Tables, bookings: list[dict[str, Any]], *, key: str, now: str
) -> list[dict[str, Any]]:
    """แนบสลิปเดียวให้ทุกการจองในชุด PENDING_PAYMENT → PENDING_REVIEW (ข้อ 7.2)

    ต้องยังไม่หมดเวลา และล้าง holdExpiresAt ที่ล็อก (ไม่ต้องหมดเวลาอีกแล้ว)
    """
    items: list[dict[str, Any]] = []
    for booking in bookings:
        items.append(
            {
                "Update": {
                    "TableName": tables.bookings,
                    "Key": _key(bookingId=booking["bookingId"]),
                    "UpdateExpression": "SET #status = :review, statusCreatedAt = :sca, "
                    "slipKey = :key, slipUploadedAt = :now, updatedAt = :now",
                    "ConditionExpression": "#status = :payment AND expiresAt > :now",
                    "ExpressionAttributeNames": {"#status": "status"},
                    "ExpressionAttributeValues": _values(
                        review=PENDING_REVIEW,
                        payment=PENDING_PAYMENT,
                        sca=status_created_at(PENDING_REVIEW, booking["createdAt"]),
                        key=key,
                        now=now,
                    ),
                }
            }
        )
        items.append(
            {
                "Update": {
                    "TableName": tables.lots,
                    "Key": _key(eventId=booking["eventId"], lotId=booking["lotId"]),
                    "UpdateExpression": "SET updatedAt = :now REMOVE holdExpiresAt",
                    "ConditionExpression": "bookingId = :id",
                    "ExpressionAttributeValues": _values(id=booking["bookingId"], now=now),
                }
            }
        )
    return items


def approve_items(
    tables: Tables,
    bookings: list[dict[str, Any]],
    *,
    actor: str,
    now: str,
    moves: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """อนุมัติทั้งชุด PENDING_REVIEW → APPROVED ใน transaction เดียว (ข้อ 7.3, D7)

    moves: {ล็อกเดิม: ล็อกใหม่} ย้ายบางล็อกพร้อมอนุมัติ ล็อกที่ไม่ย้าย HELD → BOOKED
    ล็อกที่ย้าย: ล็อกเดิมกลับเป็นว่าง ล็อกใหม่ AVAILABLE → BOOKED
    amount คงเดิม (ไม่คิดส่วนต่างราคา) โควตาไม่เปลี่ยนเพราะจำนวนล็อกเท่าเดิม
    """
    moves = moves or {}
    items: list[dict[str, Any]] = []
    for booking in bookings:
        items += _approve_one(
            tables, booking, actor=actor, now=now, new_lot_id=moves.get(booking["lotId"])
        )
    return items


def _approve_one(
    tables: Tables, booking: dict[str, Any], *, actor: str, now: str, new_lot_id: str | None
) -> list[dict[str, Any]]:
    move = new_lot_id is not None and new_lot_id != booking["lotId"]
    sets = [
        "#status = :approved",
        "statusCreatedAt = :sca",
        "decidedBy = :actor",
        "decidedAt = :now",
        "updatedAt = :now",
    ]
    values: dict[str, Any] = {
        "approved": APPROVED,
        "review": PENDING_REVIEW,
        "sca": status_created_at(APPROVED, booking["createdAt"]),
        "actor": actor,
        "now": now,
    }
    if move:
        sets += ["lotId = :newLot", "moves = list_append(if_not_exists(moves, :empty), :move)"]
        values.update(
            newLot=new_lot_id,
            empty=[],
            move=[{"from": booking["lotId"], "to": new_lot_id, "at": now, "by": actor}],
        )
    items: list[dict[str, Any]] = [
        {
            "Update": {
                "TableName": tables.bookings,
                "Key": _key(bookingId=booking["bookingId"]),
                "UpdateExpression": "SET " + ", ".join(sets),
                "ConditionExpression": "#status = :review",
                "ExpressionAttributeNames": {"#status": "status"},
                "ExpressionAttributeValues": _values(**values),
            }
        }
    ]
    old_lot = _key(eventId=booking["eventId"], lotId=booking["lotId"])
    if not move:
        items.append(
            _lot_update(
                tables,
                old_lot,
                "SET #status = :to, updatedAt = :now",
                "bookingId = :id",
                to=lots.BOOKED,
                id=booking["bookingId"],
                now=now,
            )
        )
        return items
    items.append(
        _lot_update(
            tables,
            old_lot,
            "SET #status = :to, updatedAt = :now REMOVE bookingId, holdExpiresAt",
            "bookingId = :id",
            to=lots.AVAILABLE,
            id=booking["bookingId"],
            now=now,
        )
    )
    items.append(
        _lot_update(
            tables,
            _key(eventId=booking["eventId"], lotId=new_lot_id),
            "SET #status = :to, bookingId = :id, updatedAt = :now",
            "#status = :available",
            to=lots.BOOKED,
            id=booking["bookingId"],
            available=lots.AVAILABLE,
            now=now,
        )
    )
    return items


def _lot_update(
    tables: Tables, key: dict[str, Any], update: str, condition: str, **values: Any
) -> dict[str, Any]:
    names = {"#status": "status"} if "#status" in update + condition else {}
    return {
        "Update": {
            "TableName": tables.lots,
            "Key": key,
            "UpdateExpression": update,
            "ConditionExpression": condition,
            **({"ExpressionAttributeNames": names} if names else {}),
            "ExpressionAttributeValues": _values(**values),
        }
    }


def release_items(
    tables: Tables,
    bookings: list[dict[str, Any]],
    *,
    to_status: str,
    from_statuses: tuple[str, ...],
    now: str,
    expired_only: bool = False,
    reason: str | None = None,
    actor: str | None = None,
) -> list[dict[str, Any]]:
    """ยกเลิก / ปฏิเสธ / หมดเวลา ทั้งชุด: เปลี่ยนสถานะ Booking, ปล่อยล็อกเป็น AVAILABLE,
    โควตา −N (ข้อ 7.4) · ทุก booking ต้องเป็นของผู้ขายคนเดียวกันในงานเดียวกัน
    (transaction แตะ item ซ้ำไม่ได้ จึงรวมโควตาเป็น update เดียว)
    """
    sets = ["#status = :to", "statusCreatedAt = :sca", "updatedAt = :now"]
    values: dict[str, Any] = {
        "to": to_status,
        "now": now,
        **{f"from{index}": status for index, status in enumerate(from_statuses)},
    }
    if reason is not None:
        sets.append("reason = :reason")
        values["reason"] = reason
    if actor is not None:
        sets += ["decidedBy = :actor", "decidedAt = :now"]
        values["actor"] = actor
    placeholders = ", ".join(f":from{index}" for index in range(len(from_statuses)))
    condition = f"#status IN ({placeholders})"
    if expired_only:
        condition += " AND expiresAt <= :now"

    items: list[dict[str, Any]] = []
    for booking in bookings:
        items.append(
            {
                "Update": {
                    "TableName": tables.bookings,
                    "Key": _key(bookingId=booking["bookingId"]),
                    "UpdateExpression": "SET " + ", ".join(sets),
                    "ConditionExpression": condition,
                    "ExpressionAttributeNames": {"#status": "status"},
                    "ExpressionAttributeValues": _values(
                        **values, sca=status_created_at(to_status, booking["createdAt"])
                    ),
                }
            }
        )
        items.append(
            {
                "Update": {
                    "TableName": tables.lots,
                    "Key": _key(eventId=booking["eventId"], lotId=booking["lotId"]),
                    "UpdateExpression": "SET #status = :available, updatedAt = :now "
                    "REMOVE bookingId, holdExpiresAt",
                    "ConditionExpression": "bookingId = :id",
                    "ExpressionAttributeNames": {"#status": "status"},
                    "ExpressionAttributeValues": _values(
                        available=lots.AVAILABLE, id=booking["bookingId"], now=now
                    ),
                }
            }
        )
    first = bookings[0]
    items.append(
        {
            "Update": {
                "TableName": tables.lots,
                "Key": _key(eventId=first["eventId"], lotId=quota_key(first["sellerId"])),
                "UpdateExpression": "ADD #count :minus SET updatedAt = :now",
                "ExpressionAttributeNames": {"#count": "count"},
                "ExpressionAttributeValues": _values(minus=-len(bookings), now=now),
            }
        }
    )
    return items


def check_in_items(
    tables: Tables, bookings: list[dict[str, Any]], *, actor: str, now: str
) -> list[dict[str, Any]]:
    """เช็กอินทุกล็อกในชุดที่ยังไม่เช็กอิน (D5b, D7) ต้อง APPROVED อยู่"""
    return [
        {
            "Update": {
                "TableName": tables.bookings,
                "Key": _key(bookingId=booking["bookingId"]),
                "UpdateExpression": "SET checkedIn = :yes, checkedInAt = :now, "
                "checkedInBy = :by, updatedAt = :now",
                "ConditionExpression": "#status = :approved AND attribute_not_exists(checkedInAt)",
                "ExpressionAttributeNames": {"#status": "status"},
                "ExpressionAttributeValues": _values(
                    yes=True, now=now, by=actor, approved=APPROVED
                ),
            }
        }
        for booking in bookings
    ]


def view(booking: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in booking.items() if key not in _INTERNAL_FIELDS}


def lot_list(bookings: list[dict[str, Any]]) -> str:
    """รหัสล็อกสำหรับข้อความแจ้งเตือน เช่น "A01, A02" """
    return ", ".join(sorted(booking["lotId"] for booking in bookings))
