"""Bookings API (PLAN หัวข้อ 7)

ผู้ขาย: จอง, ดูการจองของฉัน, แนบ/ดูสลิป, ยกเลิกก่อนอนุมัติ
ผู้จัดงาน: ดูการจองของงาน, อนุมัติ (ย้ายล็อกได้), ปฏิเสธ, ยกเลิกหลังอนุมัติ, ดูสลิป

อนุมัติ ปฏิเสธ ยกเลิก และเช็กอินทำทั้งชุด (groupId) เสมอ (D7)
"""

from datetime import datetime, timedelta
from typing import Any

from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from domain import booking, events, lots, messages, users, vendors
from domain.schemas import (
    SLIP_MAX_BYTES,
    SLIP_TYPES,
    ApproveInput,
    CreateBookingInput,
    ReasonInput,
    SlipInput,
    SlipUrlInput,
)
from shared import booking_ops, clock, db, s3, scheduler
from shared.auth import CurrentUser, current_user, require_group
from shared.errors import bad_request, conflict, forbidden, not_found
from shared.http import create_app
from shared.ids import new_id
from shared.notify import notify

logger = Logger()
app = create_app()

SELLER_GROUP = users.GROUP_OF_ROLE[users.SELLER]
ORGANIZER_GROUP = users.GROUP_OF_ROLE[users.ORGANIZER]


def _get_event(event_id: str) -> dict[str, Any]:
    event = db.table("events").get_item(Key={"eventId": event_id}).get("Item")
    if event is None or event["publishStatus"] == events.DRAFT:
        raise not_found("ไม่พบงานนี้")
    return event


def _own_booking(booking_id: str, user: CurrentUser) -> dict[str, Any]:
    item = booking_ops.get(booking_id)
    if item is None:
        raise not_found("ไม่พบการจองนี้")
    if item["sellerId"] != user.user_id:
        raise forbidden("การจองนี้ไม่ใช่ของคุณ")
    return item


_group_bookings = booking_ops.group_members


def _slip_prefix(item: dict[str, Any]) -> str:
    # สลิปเดียวต่อชุด จึงใช้ groupId ใน path
    return f"slips/{item['eventId']}/{item['groupId']}/"


def _ensure_not_expired(item: dict[str, Any], now: datetime) -> None:
    if booking_ops.is_expired(item, now):
        booking_ops.expire(item, now)
        raise conflict("หมดเวลาแนบสลิปแล้ว กรุณาจองใหม่", "BOOKING_EXPIRED")
    if item["status"] != booking.PENDING_PAYMENT:
        raise conflict("การจองนี้แนบสลิปไม่ได้แล้ว", "INVALID_STATUS")


# ---------- จอง ----------


def _unavailable_lots(error: ClientError, lot_ids: list[str], event_id: str) -> tuple[str, Any]:
    """หาว่า transaction ล้มเพราะล็อกไม่ว่าง (ล็อกไหน) หรือเพราะโควตาเต็ม"""
    reasons = error.response.get("CancellationReasons") or []
    failed = [
        index
        for index, reason in enumerate(reasons)
        if reason.get("Code") == "ConditionalCheckFailed"
    ]
    if failed:
        taken = [lot_ids[index] for index in failed if index < len(lot_ids)]
        return ("LOT_NOT_AVAILABLE", taken) if taken else ("QUOTA_EXCEEDED", None)
    # ไม่มีเหตุผลแยกราย item ให้อ่านสถานะล็อกใหม่
    current = {
        lot["lotId"]: lot
        for lot in db.query_all("lots", KeyConditionExpression=Key("eventId").eq(event_id))
    }
    taken = [lot_id for lot_id in lot_ids if current[lot_id]["status"] != lots.AVAILABLE]
    return ("LOT_NOT_AVAILABLE", taken) if taken else ("QUOTA_EXCEEDED", None)


@app.post("/bookings")
def create_booking():
    user = require_group(app, SELLER_GROUP)
    body = CreateBookingInput.model_validate(app.current_event.json_body or {})
    now = clock.now()
    event = _get_event(body.event_id)
    if not events.is_booking_open(event, now):
        raise conflict("งานนี้ไม่ได้เปิดรับจองตอนนี้", "BOOKING_CLOSED")

    max_lots = event.get("maxLotsPerSeller")
    if max_lots is not None and len(body.lot_ids) > max_lots:
        raise conflict(f"จองได้ไม่เกิน {max_lots} ล็อกต่อร้าน", "QUOTA_EXCEEDED")

    found = db.query_all("lots", KeyConditionExpression=Key("eventId").eq(event["eventId"]))
    by_id = {lot["lotId"]: lot for lot in found if lots.is_lot(lot)}
    unknown = sorted(set(body.lot_ids) - set(by_id))
    if unknown:
        raise bad_request("ไม่พบล็อกนี้ในงาน", "UNKNOWN_LOT", {"lotIds": unknown})

    requested = [by_id[lot_id] for lot_id in body.lot_ids]
    booking_ops.expire_stale_lots(requested, now)
    taken = [lot["lotId"] for lot in requested if lot["status"] != lots.AVAILABLE]
    if taken:
        raise conflict("ล็อกนี้มีผู้จองแล้ว", "LOT_NOT_AVAILABLE", {"lotIds": taken})

    zones = {zone["id"]: zone for zone in event["zones"]}
    created_at = clock.iso(now)
    expires = now + timedelta(minutes=int(event["slipDeadlineMinutes"]))
    group_id = new_id()
    bookings = [
        booking.new_booking(
            booking_id=new_id(),
            group_id=group_id,
            event=event,
            lot_id=lot["lotId"],
            seller_id=user.user_id,
            shop=body.shop_info(),
            amount=int(zones[lot["zoneId"]]["price"]),
            created_at=created_at,
            expires_at=clock.iso(expires),
        )
        for lot in requested
    ]
    items = booking.create_items(
        booking_ops.tables(), bookings, None if max_lots is None else int(max_lots)
    )
    try:
        db.transact_write(items)
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "TransactionCanceledException":
            raise
        code, taken = _unavailable_lots(error, body.lot_ids, event["eventId"])
        if code == "QUOTA_EXCEEDED":
            raise conflict(f"จองได้ไม่เกิน {max_lots} ล็อกต่อร้าน (รวมที่จองไว้แล้ว)", code) from error
        raise conflict("ล็อกนี้มีผู้จองแล้ว", code, {"lotIds": taken}) from error

    scheduler.create_expiry(group_id, [b["bookingId"] for b in bookings], expires)
    notify(
        [event["organizerId"]],
        messages.BOOKING_NEW,
        messages.booking_new(body.shop_name, booking.lot_list(bookings), event["title"]),
        now=now,
        eventId=event["eventId"],
    )
    return {"groupId": group_id, "bookings": [booking.view(b) for b in bookings]}, 201


@app.get("/bookings/me")
def my_bookings():
    user = current_user(app)
    now = clock.now()
    items = db.query_all(
        "bookings",
        IndexName="bySeller",
        KeyConditionExpression=Key("sellerId").eq(user.user_id),
        ScanIndexForward=False,
    )
    for item in items:
        booking_ops.expire(item, now)  # fallback: ที่เลยเวลาแล้วให้เห็นเป็น EXPIRED
    return {"items": [booking.view(item) for item in items]}


# ---------- สลิป ----------


@app.post("/bookings/<booking_id>/slip-url")
def slip_upload_url(booking_id: str):
    user = require_group(app, SELLER_GROUP)
    body = SlipUrlInput.model_validate(app.current_event.json_body or {})
    item = _own_booking(booking_id, user)
    _ensure_not_expired(item, clock.now())
    key = f"{_slip_prefix(item)}{new_id()}.{SLIP_TYPES[body.content_type]}"
    upload = s3.presigned_post(key, body.content_type, SLIP_MAX_BYTES)
    return {"url": upload["url"], "fields": upload["fields"], "key": key}


@app.post("/bookings/<booking_id>/slip")
def attach_slip(booking_id: str):
    """แนบสลิปที่อัปโหลดแล้วให้ทุกการจองในชุดที่ยังรอสลิป"""
    user = require_group(app, SELLER_GROUP)
    body = SlipInput.model_validate(app.current_event.json_body or {})
    now = clock.now()
    item = _own_booking(booking_id, user)
    _ensure_not_expired(item, now)
    if not body.key.startswith(_slip_prefix(item)) or ".." in body.key:
        raise bad_request("ไฟล์สลิปไม่ใช่ของการจองนี้", "INVALID_SLIP_KEY")
    size = s3.object_size(body.key)
    if size is None:
        raise bad_request("ยังไม่พบไฟล์สลิป กรุณาอัปโหลดก่อน", "SLIP_NOT_UPLOADED")
    if size > SLIP_MAX_BYTES:
        raise bad_request("ไฟล์สลิปใหญ่เกิน 5 MB", "SLIP_TOO_LARGE")

    group = [
        b
        for b in _group_bookings(user.user_id, item["groupId"])
        if b["status"] == booking.PENDING_PAYMENT
    ]
    if not booking_ops.run(
        booking.slip_items(booking_ops.tables(), group, key=body.key, now=clock.iso(now))
    ):
        raise conflict("หมดเวลาแนบสลิปหรือสถานะเปลี่ยนไปแล้ว", "INVALID_STATUS")

    scheduler.delete_expiry(item["groupId"])
    notify(
        [item["organizerId"]],
        messages.BOOKING_SLIP_UPLOADED,
        messages.booking_slip_uploaded(
            item["shopName"], booking.lot_list(group), item.get("eventTitle", "")
        ),
        now=now,
        eventId=item["eventId"],
    )
    updated = [booking_ops.get(b["bookingId"]) for b in group]
    return {"groupId": item["groupId"], "bookings": [booking.view(b) for b in updated]}


@app.get("/bookings/<booking_id>/slip")
def get_slip(booking_id: str):
    """เจ้าของการจอง หรือผู้จัดงานของงานนั้น ดูสลิปได้ (ลิงก์อายุ 5 นาที)"""
    user = current_user(app)
    item = booking_ops.get(booking_id)
    if item is None:
        raise not_found("ไม่พบการจองนี้")
    if user.user_id not in (item["sellerId"], item["organizerId"]):
        raise forbidden("ไม่มีสิทธิ์ดูสลิปนี้")
    if not item.get("slipKey"):
        raise not_found("การจองนี้ยังไม่มีสลิป", "SLIP_NOT_FOUND")
    return {"url": s3.presigned_get(item["slipKey"])}


# ---------- ตัดสินทั้งชุด (ข้อ 7.3, 7.4, D7) ----------
# route รับ bookingId ใดก็ได้ในชุด แล้วทำกับทุกล็อกในชุดที่ยังดำเนินการอยู่ใน transaction เดียว


def _active_group(item: dict[str, Any], now: datetime) -> list[dict[str, Any]]:
    """การจองในชุดเดียวกับ item ที่ยังไม่จบ (ที่เลยเวลาแนบสลิปให้หมดเวลาก่อน)"""
    members = []
    for member in _group_bookings(item["sellerId"], item["groupId"]):
        booking_ops.expire(member, now)  # fallback: ที่เลยเวลาแล้วกลายเป็น EXPIRED
        if member["status"] not in booking.FINAL:
            members.append(member)
    if not any(member["bookingId"] == item["bookingId"] for member in members):
        raise conflict("สถานะการจองเปลี่ยนไปแล้ว กรุณาโหลดใหม่", "INVALID_STATUS")
    members.sort(key=lambda member: member["lotId"])
    return members


def _require_status(members: list[dict[str, Any]], *statuses: str, message: str) -> None:
    if any(member["status"] not in statuses for member in members):
        raise conflict(message, "INVALID_STATUS")


def _group_result(item: dict[str, Any], members: list[dict[str, Any]]) -> dict[str, Any]:
    updated = [booking_ops.get(member["bookingId"]) for member in members]
    return {"groupId": item["groupId"], "bookings": [booking.view(b) for b in updated]}


def _organizer_group(booking_id: str):
    user = require_group(app, ORGANIZER_GROUP)
    item = booking_ops.get(booking_id)
    if item is None:
        raise not_found("ไม่พบการจองนี้")
    if item["organizerId"] != user.user_id:
        raise forbidden("การจองนี้ไม่ได้อยู่ในงานของคุณ")
    now = clock.now()
    return user, item, _active_group(item, now), now


def _notify_seller(item: dict[str, Any], type_: str, message: str, now: datetime) -> None:
    notify(
        [item["sellerId"]],
        type_,
        message,
        now=now,
        bookingId=item["bookingId"],
        eventId=item["eventId"],
    )


def _release(members, *, to_status, from_statuses, now, reason=None, actor=None) -> None:
    released = booking_ops.run(
        booking.release_items(
            booking_ops.tables(),
            members,
            to_status=to_status,
            from_statuses=from_statuses,
            now=clock.iso(now),
            reason=reason,
            actor=actor,
        )
    )
    if not released:
        raise conflict("สถานะการจองเปลี่ยนไปแล้ว กรุณาโหลดใหม่", "INVALID_STATUS")


@app.get("/events/<event_id>/bookings")
def event_bookings(event_id: str):
    user = require_group(app, ORGANIZER_GROUP)
    event = db.table("events").get_item(Key={"eventId": event_id}).get("Item")
    if event is None:
        raise not_found("ไม่พบงานนี้")
    if event["organizerId"] != user.user_id:
        raise forbidden("คุณไม่ได้เป็นผู้จัดงานนี้")

    status = (app.current_event.get_query_string_value("status") or "").upper()
    condition = Key("eventId").eq(event_id)
    if status:
        if status not in booking.STATUSES:
            raise bad_request("สถานะไม่ถูกต้อง", "INVALID_STATUS")
        condition &= Key("statusCreatedAt").begins_with(f"{status}#")
    items = db.query_all("bookings", IndexName="byEventStatus", KeyConditionExpression=condition)

    now = clock.now()
    for item in items:
        booking_ops.expire(item, now)  # fallback: ที่เลยเวลาแล้วให้เห็นเป็น EXPIRED
    if status:
        items = [item for item in items if item["status"] == status]
    items.sort(key=lambda item: item["createdAt"], reverse=True)
    return {"items": [booking.view(item) for item in items]}


def _check_move_targets(
    members: list[dict[str, Any]], moves: dict[str, str], now: datetime
) -> dict[str, str]:
    """คืน moves ที่ย้ายจริง ตรวจว่าล็อกเดิมอยู่ในชุด และล็อกปลายทางมีในงาน ไม่ซ้ำ และว่าง"""
    own = {member["lotId"] for member in members}
    moves = {old: new for old, new in moves.items() if old != new}
    outside = sorted(set(moves) - own)
    if outside:
        raise bad_request("ล็อกนี้ไม่อยู่ในการจองชุดนี้", "UNKNOWN_LOT", {"lotIds": outside})
    targets = list(moves.values())
    if len(set(targets)) != len(targets):
        raise bad_request("ย้ายหลายล็อกไปล็อกเดียวกันไม่ได้", "DUPLICATE_LOT")
    if not targets:
        return moves
    found = {
        lot["lotId"]: lot
        for lot in db.query_all(
            "lots", KeyConditionExpression=Key("eventId").eq(members[0]["eventId"])
        )
        if lots.is_lot(lot)
    }
    unknown = sorted(set(targets) - set(found))
    if unknown:
        raise bad_request("ไม่พบล็อกนี้ในงาน", "UNKNOWN_LOT", {"lotIds": unknown})
    target_lots = [found[lot_id] for lot_id in targets]
    booking_ops.expire_stale_lots(target_lots, now)
    taken = [lot["lotId"] for lot in target_lots if lot["status"] != lots.AVAILABLE]
    if taken:
        raise conflict("ล็อกปลายทางไม่ว่าง", "LOT_NOT_AVAILABLE", {"lotIds": taken})
    return moves


@app.post("/bookings/<booking_id>/approve")
def approve_booking(booking_id: str):
    """อนุมัติทั้งชุด ส่ง {moves: {ล็อกเดิม: ล็อกใหม่}} เพื่อย้ายบางล็อกพร้อมอนุมัติ"""
    user, item, members, now = _organizer_group(booking_id)
    body = ApproveInput.model_validate(app.current_event.json_body or {})
    _require_status(members, booking.PENDING_REVIEW, message="อนุมัติได้เฉพาะการจองที่แนบสลิปแล้ว")
    moves = _check_move_targets(members, body.moves, now)

    items = booking.approve_items(
        booking_ops.tables(), members, actor=user.user_id, now=clock.iso(now), moves=moves
    )
    if not booking_ops.run(items):
        if moves:
            raise conflict(
                "สถานะการจองหรือล็อกปลายทางเปลี่ยนไปแล้ว กรุณาโหลดใหม่",
                "LOT_NOT_AVAILABLE",
                {"lotIds": list(moves.values())},
            )
        raise conflict("สถานะการจองเปลี่ยนไปแล้ว กรุณาโหลดใหม่", "INVALID_STATUS")

    event_title = item.get("eventTitle", "")
    if moves:
        _notify_seller(
            item, messages.BOOKING_MOVED, messages.booking_moved(moves, event_title), now
        )
    else:
        _notify_seller(
            item,
            messages.BOOKING_APPROVED,
            messages.booking_approved(booking.lot_list(members), event_title),
            now,
        )
    return _group_result(item, members)


@app.post("/bookings/<booking_id>/reject")
def reject_booking(booking_id: str):
    user, item, members, now = _organizer_group(booking_id)
    body = ReasonInput.model_validate(app.current_event.json_body or {})
    _require_status(members, booking.PENDING_REVIEW, message="ปฏิเสธได้เฉพาะการจองที่รอตรวจสอบ")
    _release(
        members,
        to_status=booking.REJECTED,
        from_statuses=(booking.PENDING_REVIEW,),
        now=now,
        reason=body.reason,
        actor=user.user_id,
    )
    _notify_seller(
        item,
        messages.BOOKING_REJECTED,
        messages.booking_rejected(
            booking.lot_list(members), item.get("eventTitle", ""), body.reason
        ),
        now,
    )
    return _group_result(item, members)


@app.post("/bookings/<booking_id>/check-in")
def check_in(booking_id: str):
    """ผู้จัดงานสแกน QR (= bookingId ใดก็ได้ในชุด) หน้างาน เช็กอินทั้งชุด (D5b, D7) เรียกซ้ำได้ผลเดิม"""
    user, item, members, now = _organizer_group(booking_id)
    _require_status(members, booking.APPROVED, message="เช็กอินได้เฉพาะการจองที่อนุมัติแล้ว")
    pending = [member for member in members if not member.get("checkedIn")]
    if not pending:
        return _group_result(item, members)
    event = db.table("events").get_item(Key={"eventId": item["eventId"]}).get("Item")
    if event is None or not events.is_event_day(event, now):
        raise conflict("เช็กอินได้เฉพาะวันที่จัดงาน", "NOT_EVENT_DAY")
    items = booking.check_in_items(
        booking_ops.tables(), pending, actor=user.user_id, now=clock.iso(now)
    )
    if not booking_ops.run(items):
        current = [booking_ops.get(member["bookingId"]) for member in members]
        # มีคนเช็กอินพร้อมกันถือว่าสำเร็จ
        if not all(b and b.get("checkedIn") for b in current):
            raise conflict("สถานะการจองเปลี่ยนไปแล้ว กรุณาโหลดใหม่", "INVALID_STATUS")
    return _group_result(item, members)


@app.get("/organizer/vendors")
def organizer_vendors():
    """สถิติร้านที่เคยได้รับอนุมัติในงานของผู้จัดคนนี้ (D5e)"""
    user = require_group(app, ORGANIZER_GROUP)
    now = clock.now()
    my_events = db.query_all(
        "events",
        IndexName="byOrganizer",
        KeyConditionExpression=Key("organizerId").eq(user.user_id),
    )
    event_by_id = {event["eventId"]: event for event in my_events}
    approved: list[dict[str, Any]] = []
    for event_id in event_by_id:
        approved += db.query_all(
            "bookings",
            IndexName="byEventStatus",
            KeyConditionExpression=Key("eventId").eq(event_id)
            & Key("statusCreatedAt").begins_with(f"{booking.APPROVED}#"),
        )

    items = []
    for seller_id, seller_bookings in vendors.group_approved_by_seller(approved).items():
        record = db.table("users").get_item(Key={"userId": seller_id}).get("Item") or {}
        shop = users.public_profile(record) if record else {"userId": seller_id}
        items.append({"shop": shop, **vendors.seller_stats(seller_bookings, event_by_id, now)})
    items.sort(key=lambda item: (-item["approved"], item["shop"].get("shopName", "")))
    return {"items": items}


# ---------- ยกเลิก ----------


@app.post("/bookings/<booking_id>/cancel")
def cancel_booking(booking_id: str):
    """ยกเลิกทั้งชุด: ผู้ขายก่อนอนุมัติ หรือผู้จัดงานหลังอนุมัติ (ต้องมี {reason})"""
    user = current_user(app)
    item = booking_ops.get(booking_id)
    if item is None:
        raise not_found("ไม่พบการจองนี้")
    if item["sellerId"] == user.user_id and SELLER_GROUP in user.groups:
        return _cancel_by_seller(item)
    if item["organizerId"] == user.user_id and ORGANIZER_GROUP in user.groups:
        return _cancel_by_organizer(user, item)
    raise forbidden("ไม่มีสิทธิ์ยกเลิกการจองนี้")


def _cancel_by_seller(item: dict[str, Any]):
    now = clock.now()
    members = _active_group(item, now)
    _require_status(members, *booking.SELLER_CANCELLABLE, message="ยกเลิกได้เฉพาะการจองที่ยังไม่ได้รับอนุมัติ")
    _release(
        members, to_status=booking.CANCELLED, from_statuses=booking.SELLER_CANCELLABLE, now=now
    )
    notify(
        [item["organizerId"]],
        messages.BOOKING_CANCELLED,
        messages.booking_cancelled_by_seller(
            item["shopName"], booking.lot_list(members), item.get("eventTitle", "")
        ),
        now=now,
        bookingId=item["bookingId"],
        eventId=item["eventId"],
    )
    return _group_result(item, members)


def _cancel_by_organizer(user: CurrentUser, item: dict[str, Any]):
    body = ReasonInput.model_validate(app.current_event.json_body or {})
    now = clock.now()
    members = _active_group(item, now)
    _require_status(
        members,
        *booking.ORGANIZER_CANCELLABLE,
        message="ยกเลิกได้เฉพาะการจองที่อนุมัติแล้ว การจองที่รอตรวจให้ใช้ปฏิเสธ",
    )
    _release(
        members,
        to_status=booking.CANCELLED,
        from_statuses=booking.ORGANIZER_CANCELLABLE,
        now=now,
        reason=body.reason,
        actor=user.user_id,
    )
    _notify_seller(
        item,
        messages.BOOKING_CANCELLED,
        messages.booking_cancelled_by_organizer(
            booking.lot_list(members), item.get("eventTitle", ""), body.reason
        ),
        now,
    )
    return _group_result(item, members)


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)
