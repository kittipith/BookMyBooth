"""Admin API (PLAN หัวข้อ 9)"""

from collections import defaultdict
from datetime import datetime
from typing import Any

from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from domain import booking, events, messages, users
from domain.schemas import ReasonInput
from shared import clock, cognito, db
from shared.auth import require_group
from shared.errors import bad_request, conflict, not_found
from shared.http import create_app
from shared.notify import notify

logger = Logger()
app = create_app()

ADMIN_GROUP = users.GROUP_OF_ROLE[users.ADMIN]


def _get_user(user_id: str) -> dict[str, Any]:
    item = db.table("users").get_item(Key={"userId": user_id}).get("Item")
    if item is None:
        raise not_found("ไม่พบผู้ใช้")
    return item


def _pending_organizer(user_id: str) -> dict[str, Any]:
    target = _get_user(user_id)
    if target["role"] != users.ORGANIZER:
        raise not_found("ไม่พบผู้สมัครผู้จัดงาน")
    if target["status"] != users.PENDING:
        raise conflict("ผู้สมัครรายนี้ได้รับการตรวจสอบไปแล้ว", "INVALID_STATUS")
    return target


def _change_status(
    target: dict[str, Any],
    *,
    to_status: str,
    condition: str,
    condition_values: dict[str, str],
    admin_id: str,
    now: datetime,
    reason: str | None = None,
) -> dict[str, Any]:
    """เปลี่ยน status + roleStatus พร้อม condition กันสถานะชนกับคำขออื่น"""
    sets = [
        "#status = :to",
        "roleStatus = :roleStatus",
        "updatedAt = :now",
        "statusChangedBy = :admin",
    ]
    values: dict[str, Any] = {
        ":to": to_status,
        ":roleStatus": users.role_status(target["role"], to_status),
        ":now": clock.iso(now),
        ":admin": admin_id,
        **condition_values,
    }
    if reason is None:
        update = "SET " + ", ".join(sets) + " REMOVE statusReason"
    else:
        values[":reason"] = reason
        update = "SET " + ", ".join([*sets, "statusReason = :reason"])
    try:
        result = db.table("users").update_item(
            Key={"userId": target["userId"]},
            UpdateExpression=update,
            ConditionExpression=condition,
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues=values,
            ReturnValues="ALL_NEW",
        )
    except ClientError as error:
        if db.is_condition_failure(error):
            raise conflict("สถานะของบัญชีเปลี่ยนไปแล้ว กรุณาโหลดใหม่", "INVALID_STATUS") from error
        raise
    return result["Attributes"]


@app.get("/admin/organizers")
def list_organizers():
    require_group(app, ADMIN_GROUP)
    status = (app.current_event.get_query_string_value("status") or users.PENDING).upper()
    if status not in users.STATUSES:
        raise bad_request("สถานะไม่ถูกต้อง", "INVALID_STATUS")
    items = db.query_all(
        "users",
        IndexName="byRoleStatus",
        KeyConditionExpression=Key("roleStatus").eq(users.role_status(users.ORGANIZER, status)),
    )
    return {"items": [users.public_profile(item) for item in items]}


@app.post("/admin/organizers/<user_id>/approve")
def approve_organizer(user_id: str):
    admin = require_group(app, ADMIN_GROUP)
    now = clock.now()
    target = _pending_organizer(user_id)
    # ใส่ group ก่อน (เรียกซ้ำได้) ถ้าขั้นต่อไปล้มก็กดอนุมัติซ้ำได้
    cognito.client().admin_add_user_to_group(
        UserPoolId=cognito.user_pool_id(),
        Username=users.cognito_username(target),
        GroupName=users.GROUP_OF_ROLE[users.ORGANIZER],
    )
    updated = _change_status(
        target,
        to_status=users.ACTIVE,
        condition="#status = :from",
        condition_values={":from": users.PENDING},
        admin_id=admin.user_id,
        now=now,
    )
    notify(
        [user_id],
        messages.ORGANIZER_APPROVED,
        messages.organizer_approved(),
        now=now,
        link="/organizer",
    )
    return users.public_profile(updated)


@app.post("/admin/organizers/<user_id>/reject")
def reject_organizer(user_id: str):
    admin = require_group(app, ADMIN_GROUP)
    body = ReasonInput.model_validate(app.current_event.json_body or {})
    now = clock.now()
    target = _pending_organizer(user_id)
    updated = _change_status(
        target,
        to_status=users.REJECTED,
        condition="#status = :from",
        condition_values={":from": users.PENDING},
        admin_id=admin.user_id,
        now=now,
        reason=body.reason,
    )
    notify(
        [user_id],
        messages.ORGANIZER_REJECTED,
        messages.organizer_rejected(body.reason),
        now=now,
    )
    return users.public_profile(updated)


@app.post("/admin/users/<user_id>/suspend")
def suspend_user(user_id: str):
    admin = require_group(app, ADMIN_GROUP)
    body = ReasonInput.model_validate(app.current_event.json_body or {})
    now = clock.now()
    target = _get_user(user_id)
    if target["role"] == users.ADMIN:
        raise conflict("ระงับบัญชีผู้ดูแลระบบไม่ได้", "CANNOT_SUSPEND_ADMIN")
    if target["status"] == users.SUSPENDED:
        raise conflict("บัญชีนี้ถูกระงับอยู่แล้ว", "INVALID_STATUS")

    # เปลี่ยนในตารางก่อน shared/auth.py จะกันทุก request ทันทีแม้ token ยังไม่หมดอายุ
    updated = _change_status(
        target,
        to_status=users.SUSPENDED,
        condition="#status <> :from",
        condition_values={":from": users.SUSPENDED},
        admin_id=admin.user_id,
        now=now,
        reason=body.reason,
    )
    try:
        username = users.cognito_username(target)
        cognito.client().admin_disable_user(UserPoolId=cognito.user_pool_id(), Username=username)
        cognito.client().admin_user_global_sign_out(
            UserPoolId=cognito.user_pool_id(), Username=username
        )
    except ClientError:
        # บัญชีถูกกันจากตารางแล้ว แค่ล็อกอินใหม่ได้ ให้ log ไว้ตามแก้
        logger.exception("Failed to disable Cognito user", extra={"userId": user_id})

    notify(
        [user_id],
        messages.ACCOUNT_SUSPENDED,
        messages.account_suspended(body.reason),
        now=now,
    )
    return users.public_profile(updated)


@app.post("/admin/users/<user_id>/unsuspend")
def unsuspend_user(user_id: str):
    """SUSPENDED → ACTIVE (D5d) ผู้จัดงานที่ถูกระงับตอนยังรออนุมัติถือว่าอนุมัติไปด้วย"""
    admin = require_group(app, ADMIN_GROUP)
    now = clock.now()
    target = _get_user(user_id)
    if target["status"] != users.SUSPENDED:
        raise conflict("บัญชีนี้ไม่ได้ถูกระงับ", "INVALID_STATUS")

    # เปิดใน Cognito ก่อน (เรียกซ้ำได้) แล้วค่อยเปลี่ยนในตาราง ถ้าขั้นหลังล้มกดซ้ำได้
    username = users.cognito_username(target)
    cognito.client().admin_enable_user(UserPoolId=cognito.user_pool_id(), Username=username)
    cognito.client().admin_add_user_to_group(
        UserPoolId=cognito.user_pool_id(),
        Username=username,
        GroupName=users.GROUP_OF_ROLE[target["role"]],
    )
    updated = _change_status(
        target,
        to_status=users.ACTIVE,
        condition="#status = :from",
        condition_values={":from": users.SUSPENDED},
        admin_id=admin.user_id,
        now=now,
    )
    notify([user_id], messages.ACCOUNT_UNSUSPENDED, messages.account_unsuspended(), now=now)
    return users.public_profile(updated)


@app.get("/admin/users")
def list_users():
    """ผู้ใช้ทั้งหมด หรือเฉพาะบทบาท ?role=SELLER|ORGANIZER|ADMIN เรียงตามวันสมัคร"""
    require_group(app, ADMIN_GROUP)
    role = app.current_event.get_query_string_value("role")
    if role is None:
        items = db.scan_all("users")
    else:
        role = role.upper()
        if role not in users.ROLES:
            raise bad_request("บทบาทไม่ถูกต้อง", "INVALID_ROLE")
        items = [
            item
            for status in users.STATUSES
            for item in db.query_all(
                "users",
                IndexName="byRoleStatus",
                KeyConditionExpression=Key("roleStatus").eq(users.role_status(role, status)),
            )
        ]
    items.sort(key=lambda item: item.get("createdAt", ""))
    return {"items": [users.public_profile(item) for item in items]}


# การจองที่ยังถือล็อกอยู่ (ไม่นับที่หมดเวลา/ถูกปฏิเสธ/ยกเลิก)
_COUNTED_BOOKINGS = (booking.PENDING_PAYMENT, booking.PENDING_REVIEW, booking.APPROVED)


@app.get("/admin/events")
def list_events():
    """ทุกงานรวมฉบับร่าง ใหม่สุดก่อน + status, bookingCount, revenue (ยอดที่อนุมัติแล้ว) ต่องาน"""
    require_group(app, ADMIN_GROUP)
    now = clock.now()
    counts: dict[str, int] = defaultdict(int)
    revenue: dict[str, int] = defaultdict(int)
    now_iso = clock.iso(now)
    for item in db.scan_all("bookings"):
        # PENDING_PAYMENT ที่เลยเวลาแล้วแต่ยังไม่ถูกเปลี่ยนเป็น EXPIRED ไม่นับ
        lapsed = item["status"] == booking.PENDING_PAYMENT and item["expiresAt"] <= now_iso
        if item["status"] in _COUNTED_BOOKINGS and not lapsed:
            counts[item["eventId"]] += 1
        if item["status"] == booking.APPROVED:
            revenue[item["eventId"]] += int(item.get("amount", 0))
    items = db.scan_all("events")
    items.sort(key=lambda item: item.get("createdAt", ""), reverse=True)
    return {
        "items": [
            {
                **item,
                "status": events.display_status(item, now),
                "bookingCount": counts[item["eventId"]],
                "revenue": revenue[item["eventId"]],
            }
            for item in items
        ]
    }


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)
