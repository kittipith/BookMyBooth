from datetime import UTC, datetime, timedelta
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

from apigw import FakeLambdaContext, http_event, parse
from domain import users
from shared import clock, db

NOW = datetime(2026, 11, 1, 3, 0, tzinfo=UTC)


def put_user(user_id: str, role: str, status: str = users.ACTIVE, **profile: str) -> dict:
    item = users.new_user(
        user_id=user_id,
        username=user_id,
        email=f"{user_id}@example.com",
        role=role,
        status=status,
        profile=profile,
        now=NOW,
    )
    db.table("users").put_item(Item=item)
    return item


def get_user(user_id: str) -> dict | None:
    return db.table("users").get_item(Key={"userId": user_id}).get("Item")


def claims(user_id: str, *groups: str) -> dict[str, Any]:
    """claims แบบที่ HTTP API ส่งมา (groups เป็น string ไม่ใช่ list)"""
    result: dict[str, Any] = {"sub": user_id}
    if groups:
        result["cognito:groups"] = "[" + " ".join(groups) + "]"
    return result


def call(handler, method: str, path: str, body: Any = None, *, as_user=None, query=None):
    """เรียก lambda_handler ด้วย event ของ HTTP API แล้วคืน (status, body)"""
    event = http_event(method, path, body, claims=as_user, query=query)
    return parse(handler(event, FakeLambdaContext()))


def create_cognito_user(pool_id: str, username: str) -> None:
    boto3.client("cognito-idp").admin_create_user(UserPoolId=pool_id, Username=username)


def cognito_groups(pool_id: str, username: str) -> set[str]:
    response = boto3.client("cognito-idp").admin_list_groups_for_user(
        UserPoolId=pool_id, Username=username
    )
    return {group["GroupName"] for group in response["Groups"]}


def event_body(**overrides: Any) -> dict[str, Any]:
    """body ของ POST /events ที่ถูกต้อง เปิดรับจองอยู่ตอนนี้ และจัดงานในอนาคต"""
    now = datetime.now(UTC)
    body = {
        "title": "ตลาดนัดทดสอบ",
        "type": "ตลาดนัด",
        "venue": "ลานหน้าตึก",
        "hours": "16:00–22:00",
        "startDate": (now + timedelta(days=10)).date().isoformat(),
        "endDate": (now + timedelta(days=11)).date().isoformat(),
        "bookingOpensAt": (now - timedelta(days=1)).isoformat(),
        "bookingClosesAt": (now + timedelta(days=9)).isoformat(),
        "payment": {"bank": "กสิกรไทย", "accountName": "ผู้จัด", "accountNo": "123-4-56789-0"},
        "zones": [
            {"id": "A", "name": "อาหาร", "size": "3x3", "price": 500},
            {"id": "B", "name": "ทั่วไป", "size": "2x2", "price": 300},
        ],
        "cols": 3,
        "rows": 2,
        "layout": ["A", "A", "walk", "B", "B", "B"],
    }
    return {**body, **overrides}


def put_open_event(
    event_id: str = "e1",
    *,
    organizer_id: str = "o1",
    max_lots: int | None = 2,
    slip_minutes: int = 60,
    lot_ids: dict[str, str] | None = None,
) -> dict:
    """งานที่เปิดรับจองอยู่ พร้อมล็อก (ค่าเริ่มต้น A01, A02 โซน A 500 บาท และ B01 โซน B 300 บาท)"""
    now = datetime.now(UTC)
    event = {
        "eventId": event_id,
        "title": "ตลาดนัดทดสอบ",
        "organizerId": organizer_id,
        "publishStatus": "OPEN",
        "startDate": (now + timedelta(days=10)).date().isoformat(),
        "endDate": (now + timedelta(days=11)).date().isoformat(),
        "bookingOpensAt": clock.iso(now - timedelta(days=1)),
        "bookingClosesAt": clock.iso(now + timedelta(days=9)),
        "maxLotsPerSeller": max_lots,
        "slipDeadlineMinutes": slip_minutes,
        "zones": [
            {"id": "A", "name": "อาหาร", "size": "3x3", "price": 500},
            {"id": "B", "name": "ทั่วไป", "size": "2x2", "price": 300},
        ],
        "createdAt": clock.iso(now),
    }
    db.table("events").put_item(Item=event)
    for lot_id, zone_id in (lot_ids or {"A01": "A", "A02": "A", "B01": "B"}).items():
        db.table("lots").put_item(
            Item={"eventId": event_id, "lotId": lot_id, "zoneId": zone_id, "status": "AVAILABLE"}
        )
    return event


def get_lot(event_id: str, lot_id: str) -> dict | None:
    return db.table("lots").get_item(Key={"eventId": event_id, "lotId": lot_id}).get("Item")


def notifications_of(user_id: str) -> list[dict]:
    return db.query_all("notifications", KeyConditionExpression=Key("userId").eq(user_id))
