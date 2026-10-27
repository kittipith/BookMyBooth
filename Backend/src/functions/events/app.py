"""Events / Lots API (PLAN หัวข้อ 6)

route สาธารณะ (ไม่มี authorizer): GET /health, GET /events, GET /events/{id}, GET /events/{id}/lots
นอกนั้นต้องเป็น Organizer และเป็นเจ้าของงาน
"""

from collections import Counter
from typing import Any

from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from domain import booking, events, lots, users
from domain.schemas import EventInput, SyncLotsInput
from shared import booking_ops, clock, db
from shared.auth import CurrentUser, require_group
from shared.errors import bad_request, conflict, forbidden, not_found
from shared.http import create_app
from shared.ids import new_id

logger = Logger()
app = create_app()

ORGANIZER_GROUP = users.GROUP_OF_ROLE[users.ORGANIZER]


def _get_event(event_id: str) -> dict[str, Any]:
    event = db.table("events").get_item(Key={"eventId": event_id}).get("Item")
    if event is None:
        raise not_found("ไม่พบงานนี้")
    return event


def _public_event(event_id: str) -> dict[str, Any]:
    """งานฉบับร่างไม่เปิดให้คนทั่วไปเห็น"""
    event = _get_event(event_id)
    if event["publishStatus"] == events.DRAFT:
        raise not_found("ไม่พบงานนี้")
    return event


def _owned_event(event_id: str, user: CurrentUser) -> dict[str, Any]:
    event = _get_event(event_id)
    if event["organizerId"] != user.user_id:
        raise forbidden("คุณไม่ได้เป็นผู้จัดงานนี้")
    return event


def _lots_of(event_id: str) -> list[dict[str, Any]]:
    items = db.query_all("lots", KeyConditionExpression=Key("eventId").eq(event_id))
    return [item for item in items if lots.is_lot(item)]


def _zones(event: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {zone["id"]: zone for zone in event.get("zones", [])}


def _organizer_name(user: CurrentUser) -> str:
    record = user.record
    return record.get("orgName") or record.get("displayName") or record.get("email", "")


# ---------- สาธารณะ ----------


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/events")
def list_events():
    status = (app.current_event.get_query_string_value("status") or events.OPEN).upper()
    if status not in (events.OPEN, events.CLOSED):
        raise bad_request("ดูได้เฉพาะงานที่เปิด (OPEN) หรือปิดแล้ว (CLOSED)", "INVALID_STATUS")
    now = clock.now()
    items = db.query_all(
        "events",
        IndexName="byPublishStatus",
        KeyConditionExpression=Key("publishStatus").eq(status),
    )
    return {"items": [events.list_view(item, now) for item in items]}


@app.get("/events/<event_id>")
def get_event(event_id: str):
    return events.detail_view(_public_event(event_id), clock.now())


@app.get("/events/<event_id>/lots")
def list_lots(event_id: str):
    event = _public_event(event_id)
    items = sorted(_lots_of(event_id), key=lambda lot: lot["lotId"])
    # fallback ข้อ 7.6: ล็อกที่ถือไว้เกินเวลาแนบสลิปให้กลับเป็นว่างก่อนส่งออก
    booking_ops.expire_stale_lots(items, clock.now())
    zones = _zones(event)
    return {"items": [lots.lot_view(lot, zones) for lot in items]}


# ---------- ผู้จัดงาน ----------


@app.get("/organizer/events")
def list_my_events():
    user = require_group(app, ORGANIZER_GROUP)
    now = clock.now()
    items = db.query_all(
        "events",
        IndexName="byOrganizer",
        KeyConditionExpression=Key("organizerId").eq(user.user_id),
        ScanIndexForward=False,
    )
    # คืนข้อมูลเต็ม (รวมผังกริด) เพราะงานฉบับร่างเปิดดูผ่าน GET /events/{id} ไม่ได้
    return {"items": [events.detail_view(item, now) for item in items]}


@app.post("/events")
def create_event():
    user = require_group(app, ORGANIZER_GROUP)
    body = EventInput.model_validate(app.current_event.json_body or {})
    timestamp = clock.iso(clock.now())
    item = {
        **body.to_item(),
        "eventId": new_id(),
        "organizerId": user.user_id,
        "organizerName": _organizer_name(user),
        "publishStatus": events.DRAFT,
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }
    db.table("events").put_item(Item=item, ConditionExpression="attribute_not_exists(eventId)")
    return events.detail_view(item, clock.now()), 201


@app.put("/events/<event_id>")
def update_event(event_id: str):
    """แก้ข้อมูลงานบางส่วน ส่ง publishStatus: "OPEN" มาด้วยเพื่อเผยแพร่งานฉบับร่าง"""
    user = require_group(app, ORGANIZER_GROUP)
    event = _owned_event(event_id, user)
    if event["publishStatus"] == events.CLOSED:
        raise conflict("งานนี้ปิดแล้ว แก้ไขไม่ได้", "EVENT_CLOSED")

    changes = dict(app.current_event.json_body or {})
    publish = changes.pop("publishStatus", None)
    if publish not in (None, events.OPEN):
        raise bad_request("publishStatus เปลี่ยนเป็น OPEN ได้อย่างเดียว ใช้ /close เพื่อปิดงาน")

    body = EventInput.model_validate({**events.editable_fields(event), **changes})
    item = {**event, **body.to_item()}

    removed_zones = events.zone_ids(event) - events.zone_ids(item)
    if removed_zones:
        used = sorted({lot["zoneId"] for lot in _lots_of(event_id)} & removed_zones)
        if used:
            raise conflict("ยังมีล็อกในโซนที่จะลบ", "ZONE_IN_USE", {"zoneIds": used})

    if publish == events.OPEN and event["publishStatus"] == events.DRAFT:
        if not _lots_of(event_id):
            raise conflict("ต้องมีล็อกอย่างน้อย 1 ล็อกก่อนเผยแพร่งาน", "NO_LOTS")
        item["publishStatus"] = events.OPEN
        item["publishedAt"] = clock.iso(clock.now())

    item["updatedAt"] = clock.iso(clock.now())
    try:
        db.table("events").put_item(
            Item=item,
            ConditionExpression="publishStatus = :seen",
            ExpressionAttributeValues={":seen": event["publishStatus"]},
        )
    except ClientError as error:
        if db.is_condition_failure(error):
            raise conflict("สถานะงานเปลี่ยนไปแล้ว กรุณาโหลดใหม่", "INVALID_STATUS") from error
        raise
    return events.detail_view(item, clock.now())


@app.post("/events/<event_id>/close")
def close_event(event_id: str):
    user = require_group(app, ORGANIZER_GROUP)
    _owned_event(event_id, user)
    try:
        result = db.table("events").update_item(
            Key={"eventId": event_id},
            UpdateExpression="SET publishStatus = :closed, updatedAt = :now",
            ConditionExpression="publishStatus = :open",
            ExpressionAttributeValues={
                ":closed": events.CLOSED,
                ":open": events.OPEN,
                ":now": clock.iso(clock.now()),
            },
            ReturnValues="ALL_NEW",
        )
    except ClientError as error:
        if db.is_condition_failure(error):
            raise conflict("ปิดได้เฉพาะงานที่เปิดอยู่", "INVALID_STATUS") from error
        raise
    return events.detail_view(result["Attributes"], clock.now())


@app.put("/events/<event_id>/lots")
def sync_lots(event_id: str):
    """รับรายการล็อกทั้งหมดของงานจากผังกริด แล้วสร้าง/แก้/ลบให้ตรงกัน"""
    user = require_group(app, ORGANIZER_GROUP)
    event = _owned_event(event_id, user)
    if event["publishStatus"] == events.CLOSED:
        raise conflict("งานนี้ปิดแล้ว แก้ไขล็อกไม่ได้", "EVENT_CLOSED")

    body = SyncLotsInput.model_validate(app.current_event.json_body or {})
    desired = [lot.model_dump(by_alias=True) for lot in body.lots]
    unknown = sorted({lot["zoneId"] for lot in desired} - events.zone_ids(event))
    if unknown:
        raise bad_request("มีล็อกที่อยู่ในโซนที่ไม่มีในงานนี้", "UNKNOWN_ZONE", {"zoneIds": unknown})

    existing = {lot["lotId"]: lot for lot in _lots_of(event_id)}
    plan = lots.plan_sync(event_id, existing, desired, clock.iso(clock.now()))
    if plan.blocked:
        raise conflict("ล็อกที่มีผู้จองอยู่แก้ไขหรือลบไม่ได้", "LOT_IN_USE", {"lotIds": plan.blocked})
    if plan.has_changes:
        _write_sync(event_id, plan)

    zones = _zones(event)
    items = sorted(_lots_of(event_id), key=lambda lot: lot["lotId"])
    return {"items": [lots.lot_view(lot, zones) for lot in items]}


def _write_sync(event_id: str, plan: lots.SyncPlan) -> None:
    table = db.table_name("lots")
    # ล็อกเดิมต้องยังว่างอยู่ตอนเขียน กันชนกับผู้ขายที่จองเข้ามาพอดี
    still_free = {
        "ConditionExpression": "#status IN (:available, :disabled)",
        "ExpressionAttributeNames": {"#status": "status"},
        "ExpressionAttributeValues": {
            ":available": {"S": lots.AVAILABLE},
            ":disabled": {"S": lots.DISABLED},
        },
    }
    items: list[dict[str, Any]] = []
    for item in plan.puts:
        if item["lotId"] in plan.new_ids:
            condition = {"ConditionExpression": "attribute_not_exists(lotId)"}
        else:
            condition = still_free
        items.append({"Put": {"TableName": table, "Item": db.serialize(item), **condition}})
    for lot_id in plan.deletes:
        key = db.serialize({"eventId": event_id, "lotId": lot_id})
        items.append({"Delete": {"TableName": table, "Key": key, **still_free}})
    db.transact_write(items)


@app.get("/events/<event_id>/summary")
def event_summary(event_id: str):
    user = require_group(app, ORGANIZER_GROUP)
    event = _owned_event(event_id, user)
    lot_counts = Counter(lot["status"] for lot in _lots_of(event_id))
    bookings = db.query_all(
        "bookings",
        IndexName="byEventStatus",
        KeyConditionExpression=Key("eventId").eq(event_id),
    )
    booking_counts = Counter(booking["status"] for booking in bookings)
    revenue = sum(int(b.get("amount", 0)) for b in bookings if b["status"] == booking.APPROVED)
    return {
        "eventId": event_id,
        "status": events.display_status(event, clock.now()),
        "lots": {
            "total": sum(lot_counts.values()),
            **{status: lot_counts.get(status, 0) for status in lots.STATUSES},
        },
        "bookings": dict(booking_counts),
        "revenue": revenue,
    }


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)
