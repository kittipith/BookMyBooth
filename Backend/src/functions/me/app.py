from typing import Any

from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from boto3.dynamodb.conditions import Key

from domain import users
from domain.schemas import MarkReadInput, UpdateMeInput
from shared import clock, db
from shared.auth import current_user
from shared.errors import bad_request
from shared.http import create_app

logger = Logger()
app = create_app()

NOTIFICATION_PAGE = 50

# ฟิลด์ที่ส่งออกไปหน้าเว็บ (ไม่ส่ง userId, sk, ttl)
_NOTIFICATION_FIELDS = ("type", "message", "read", "createdAt", "link", "bookingId", "eventId")


@app.get("/me")
def get_me():
    # ผู้จัดงานที่รออนุมัติหรือถูกปฏิเสธต้องเห็นสถานะของตัวเองได้
    user = current_user(app, allow_inactive=True)
    return users.public_profile(user.record)


@app.put("/me")
def update_me():
    user = current_user(app, allow_inactive=True)
    body = UpdateMeInput.model_validate(app.current_event.json_body or {})
    # ส่ง null มาถือว่าไม่แก้ฟิลด์นั้น
    changes = body.model_dump(by_alias=True, exclude_unset=True, exclude_none=True)
    if not changes:
        return users.public_profile(user.record)

    not_allowed = sorted(set(changes) - users.EDITABLE_FIELDS[user.role])
    if not_allowed:
        raise bad_request("บัญชีประเภทนี้แก้ไขข้อมูลนี้ไม่ได้", "FIELD_NOT_ALLOWED", {"fields": not_allowed})

    changes["updatedAt"] = clock.iso(clock.now())
    names = {f"#{key}": key for key in changes}
    values = {f":{key}": value for key, value in changes.items()}
    result = db.table("users").update_item(
        Key={"userId": user.user_id},
        UpdateExpression="SET " + ", ".join(f"#{key} = :{key}" for key in changes),
        ConditionExpression="attribute_exists(userId)",
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues="ALL_NEW",
    )
    return users.public_profile(result["Attributes"])


# ---------- แจ้งเตือน (PLAN หัวข้อ 8) ----------


def _all_notifications(user_id: str) -> list[dict[str, Any]]:
    return db.query_all(
        "notifications",
        KeyConditionExpression=Key("userId").eq(user_id),
        ScanIndexForward=False,
    )


def _notification_view(item: dict[str, Any]) -> dict[str, Any]:
    view = {key: item[key] for key in _NOTIFICATION_FIELDS if key in item}
    return {"id": item["notificationId"], **view}


@app.get("/notifications")
def list_notifications():
    """ใหม่สุดก่อน 50 รายการ + จำนวนที่ยังไม่อ่านทั้งหมด หน้าเว็บ poll ทุก 30–60 วินาที"""
    user = current_user(app, allow_inactive=True)
    items = _all_notifications(user.user_id)
    return {
        "items": [_notification_view(item) for item in items[:NOTIFICATION_PAGE]],
        "unreadCount": sum(1 for item in items if not item.get("read")),
    }


@app.post("/notifications/read")
def mark_read():
    user = current_user(app, allow_inactive=True)
    body = MarkReadInput.model_validate(app.current_event.json_body or {})
    wanted = set(body.ids)
    targets = [
        item
        for item in _all_notifications(user.user_id)
        if not item.get("read") and (body.all or item["notificationId"] in wanted)
    ]
    table = db.table("notifications")
    for item in targets:
        table.update_item(
            Key={"userId": user.user_id, "sk": item["sk"]},
            UpdateExpression="SET #read = :yes",
            ExpressionAttributeNames={"#read": "read"},
            ExpressionAttributeValues={":yes": True},
        )
    remaining = sum(1 for item in _all_notifications(user.user_id) if not item.get("read"))
    return {"updated": len(targets), "unreadCount": remaining}


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    return app.resolve(event, context)
