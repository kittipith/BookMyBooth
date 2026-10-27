"""ตรวจสิทธิ์ชั้นที่ 2 ใน Lambda (PLAN หัวข้อ 5.2)

API Gateway ตรวจ JWT แล้วส่ง claims มาใน requestContext ถ้าไม่มี claims (route ไม่ได้ผูก
authorizer) จะคืน 401 เสมอ ทำให้ route ที่ลืมผูก authorizer ใช้ไม่ได้แทนที่จะเปิดให้ทุกคน
"""

import re
from dataclasses import dataclass
from typing import Any

from aws_lambda_powertools.event_handler import APIGatewayHttpResolver

from domain import users
from shared import db
from shared.errors import forbidden, unauthorized


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    groups: frozenset[str]
    record: dict[str, Any]

    @property
    def role(self) -> str:
        return self.record["role"]

    @property
    def status(self) -> str:
        return self.record["status"]


def parse_groups(raw: Any) -> frozenset[str]:
    """HTTP API ส่ง cognito:groups มาเป็น string เช่น "[Seller Admin]" ไม่ใช่ list"""
    if not raw:
        return frozenset()
    items = raw if isinstance(raw, list) else re.split(r"[\s,]+", str(raw).strip().strip("[]"))
    return frozenset(item.strip() for item in items if item.strip())


def _claims(app: APIGatewayHttpResolver) -> dict[str, Any]:
    context = app.current_event.raw_event.get("requestContext") or {}
    claims = ((context.get("authorizer") or {}).get("jwt") or {}).get("claims")
    if not claims or not claims.get("sub"):
        raise unauthorized()
    return claims


def _load(claims: dict[str, Any], *, allow_inactive: bool) -> CurrentUser:
    record = db.table("users").get_item(Key={"userId": claims["sub"]}).get("Item")
    if record is None:
        raise forbidden("ไม่พบข้อมูลบัญชี", "ACCOUNT_NOT_FOUND")
    # token ยังใช้ได้ไม่เกิน 1 ชม. หลังถูกระงับ จึงต้องเช็กจากตารางทุกครั้ง
    if record["status"] == users.SUSPENDED:
        raise forbidden("บัญชีของคุณถูกระงับ", "ACCOUNT_SUSPENDED")
    if record["status"] != users.ACTIVE and not allow_inactive:
        raise forbidden("บัญชีของคุณยังใช้งานส่วนนี้ไม่ได้", "ACCOUNT_NOT_ACTIVE")
    return CurrentUser(claims["sub"], parse_groups(claims.get("cognito:groups")), record)


def current_user(app: APIGatewayHttpResolver, *, allow_inactive: bool = False) -> CurrentUser:
    """ผู้ใช้ที่ล็อกอินอยู่ allow_inactive=True ให้บัญชี PENDING/REJECTED ผ่านได้ (เช่น ดูโปรไฟล์ตัวเอง)"""
    return _load(_claims(app), allow_inactive=allow_inactive)


def require_group(app: APIGatewayHttpResolver, *groups: str) -> CurrentUser:
    """ต้องอยู่ใน group ใด group หนึ่ง และบัญชีต้อง ACTIVE"""
    claims = _claims(app)
    if not parse_groups(claims.get("cognito:groups")) & set(groups):
        raise forbidden()
    return _load(claims, allow_inactive=False)
