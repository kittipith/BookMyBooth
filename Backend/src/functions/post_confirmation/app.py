"""Cognito PostConfirmation trigger (PLAN หัวข้อ 5.1)

สร้างบัญชีในตาราง Users หลังผู้ใช้ยืนยันอีเมล โปรไฟล์ (ชื่อ เบอร์ ชื่อร้าน/องค์กร ประเภทสินค้า)
มาจาก clientMetadata ที่หน้าเว็บส่งกับ confirmSignUp ไม่ได้เก็บเป็น attribute ใน Cognito
"""

from datetime import datetime
from typing import Any

from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from pydantic import ValidationError

from domain import messages, users
from domain.schemas import SignupProfile
from shared import clock, cognito, db
from shared.notify import notify

logger = Logger()

# ค่า custom:role ที่สมัครเองได้ (Admin สร้างด้วย scripts/seed.py เท่านั้น)
_SIGNUP_ROLES = {"seller": users.SELLER, "organizer": users.ORGANIZER}


def _profile(role: str, metadata: dict[str, Any] | None) -> dict[str, str]:
    try:
        profile = SignupProfile.model_validate(metadata or {})
    except ValidationError:
        # ข้อมูลไม่ถูกต้องไม่ควรทำให้ยืนยันอีเมลไม่ผ่าน ผู้ใช้แก้ทีหลังได้ด้วย PUT /me
        logger.warning("Invalid signup profile in clientMetadata", extra={"metadata": metadata})
        return {}
    name_field = "shopName" if role == users.SELLER else "orgName"
    return {
        "displayName": profile.name,
        "phone": profile.phone,
        name_field: profile.org_name,
        "category": profile.category,
    }


def handle_sign_up(event: dict[str, Any], now: datetime) -> None:
    attributes = event["request"]["userAttributes"]
    requested_role = str(attributes.get("custom:role", "")).lower()
    role = _SIGNUP_ROLES.get(requested_role)
    if role is None:
        logger.warning("Unknown custom:role, defaulting to seller", extra={"role": requested_role})
        role = users.SELLER

    item = users.new_user(
        user_id=attributes["sub"],
        username=event["userName"],
        email=attributes.get("email", ""),
        role=role,
        status=users.initial_status(role),
        profile=_profile(role, event["request"].get("clientMetadata")),
        now=now,
    )
    try:
        db.table("users").put_item(Item=item, ConditionExpression="attribute_not_exists(userId)")
        created = True
    except ClientError as error:
        if not db.is_condition_failure(error):
            raise
        # Cognito เรียก trigger ซ้ำได้ ถ้ามีบัญชีแล้วให้ทำต่อแบบไม่สร้างซ้ำ
        created = False

    if role == users.SELLER:
        # เรียกซ้ำได้ไม่มีผลเสีย จึงทำทุกครั้งแม้บัญชีมีอยู่แล้ว
        cognito.client().admin_add_user_to_group(
            UserPoolId=event["userPoolId"],
            Username=event["userName"],
            GroupName=users.GROUP_OF_ROLE[users.SELLER],
        )
    elif created:
        admins = db.query_all(
            "users",
            IndexName="byRoleStatus",
            KeyConditionExpression=Key("roleStatus").eq(
                users.role_status(users.ADMIN, users.ACTIVE)
            ),
        )
        notify(
            [admin["userId"] for admin in admins],
            messages.ORGANIZER_PENDING,
            messages.organizer_pending(item.get("orgName") or item["email"]),
            now=now,
            link="/admin",
        )


@logger.inject_lambda_context
def lambda_handler(event: dict[str, Any], context: LambdaContext) -> dict[str, Any]:
    # PostConfirmation_ConfirmForgotPassword ก็เรียก trigger นี้ด้วย ต้องข้าม
    if event.get("triggerSource") == "PostConfirmation_ConfirmSignUp":
        handle_sign_up(event, clock.now())
    # Cognito ต้องได้ event กลับเสมอ
    return event
