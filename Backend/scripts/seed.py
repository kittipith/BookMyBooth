"""สร้างบัญชีเดโม admin / organizer / seller และงานตัวอย่าง 1 งาน (PLAN หัวข้อ 5.4)

รันหลังสร้าง resource ใน Console แล้ว (สัปดาห์ 11) ด้วย credentials ของ Learner Lab
รหัสผ่านอ่านจาก env SEED_PASSWORD (Admin ใช้ ADMIN_SEED_PASSWORD ถ้าตั้งไว้) ไม่เขียนลงไฟล์
รันซ้ำได้ (บัญชีที่มีแล้วจะถูกอัปเดต
ส่วนงานและล็อกตัวอย่างที่มีแล้วจะไม่ถูกเขียนทับ)

    SEED_PASSWORD='...' python scripts/seed.py --user-pool-id us-east-1_xxxx --stage dev
"""

import argparse
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from domain import events, lots, users  # noqa: E402
from domain.schemas import EventInput  # noqa: E402
from shared import clock  # noqa: E402

DEMO_EVENT_ID = "demo-event"


@dataclass(frozen=True)
class DemoAccount:
    email: str
    role: str
    profile: dict[str, str]


DEMO_ACCOUNTS = (
    DemoAccount("admin@bookmybooth.test", users.ADMIN, {"displayName": "ผู้ดูแลระบบ"}),
    DemoAccount(
        "organizer@bookmybooth.test",
        users.ORGANIZER,
        {"displayName": "ทีมจัดงานตลาดนัด", "phone": "0812345678", "orgName": "ตลาดนัดสุดสัปดาห์"},
    ),
    DemoAccount(
        "seller@bookmybooth.test",
        users.SELLER,
        {
            "displayName": "ร้านขนมบ้านสวน",
            "phone": "0898765432",
            "shopName": "ขนมบ้านสวน",
            "category": "อาหารและเครื่องดื่ม",
        },
    ),
)


def _ensure_cognito_user(cognito, pool_id: str, account: DemoAccount) -> tuple[str, str]:
    """คืน (username, sub) สร้างใหม่ถ้ายังไม่มี"""
    try:
        response = cognito.admin_create_user(
            UserPoolId=pool_id,
            Username=account.email,
            UserAttributes=[
                {"Name": "email", "Value": account.email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "custom:role", "Value": account.role.lower()},
            ],
            MessageAction="SUPPRESS",
        )
        user = response["User"]
        attributes = user["Attributes"]
    except cognito.exceptions.UsernameExistsException:
        user = cognito.admin_get_user(UserPoolId=pool_id, Username=account.email)
        attributes = user["UserAttributes"]
    sub = next(attr["Value"] for attr in attributes if attr["Name"] == "sub")
    return user["Username"], sub


def seed_accounts(
    *, cognito, users_table, pool_id: str, password: str, admin_password: str | None = None
) -> list[dict]:
    """admin_password: รหัสของ Admin แยกจากบัญชีเดโมอื่น (ไม่ใส่ = ใช้ password เดียวกัน)"""
    now = clock.now()
    seeded = []
    for account in DEMO_ACCOUNTS:
        username, sub = _ensure_cognito_user(cognito, pool_id, account)
        own_password = (
            admin_password if account.role == users.ADMIN and admin_password else password
        )
        cognito.admin_set_user_password(
            UserPoolId=pool_id, Username=username, Password=own_password, Permanent=True
        )
        cognito.admin_add_user_to_group(
            UserPoolId=pool_id, Username=username, GroupName=users.GROUP_OF_ROLE[account.role]
        )
        # ผู้จัดงานเดโมอนุมัติแล้ว จึงเป็น ACTIVE ทุกบัญชี
        item = users.new_user(
            user_id=sub,
            username=username,
            email=account.email,
            role=account.role,
            status=users.ACTIVE,
            profile=account.profile,
            now=now,
        )
        users_table.put_item(Item=item)
        seeded.append(item)
    return seeded


def _demo_layout() -> list[str]:
    """ผัง 8 × 4: เวทีด้านบน โซน A 6 ล็อก โซน B 6 ล็อก ทางเข้าด้านล่าง"""
    return [
        *["walk", "stage", "stage", "stage", "stage", "stage", "stage", "walk"],
        *["walk", "A", "A", "A", "A", "A", "A", "walk"],
        *["walk", "B", "B", "B", "B", "B", "B", "walk"],
        *["walk", "walk", "walk", "gate", "gate", "walk", "walk", "walk"],
    ]


def _put_if_absent(table, item: dict, key: str) -> bool:
    try:
        table.put_item(Item=item, ConditionExpression=f"attribute_not_exists({key})")
        return True
    except ClientError as error:
        if error.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        return False


def seed_event(*, events_table, lots_table, organizer: dict, now: datetime) -> dict:
    """งานตัวอย่างที่เปิดรับจองแล้ว จัดอีก 14 วัน"""
    start = (now + timedelta(days=14)).astimezone(events.BANGKOK).date()
    body = EventInput.model_validate(
        {
            "title": "ตลาดนัดสุดสัปดาห์ (เดโม)",
            "type": "ตลาดนัด",
            "description": "งานตัวอย่างจาก scripts/seed.py",
            "venue": "ลานกิจกรรมหน้าอาคาร",
            "hours": "16:00–22:00",
            "startDate": start.isoformat(),
            "endDate": (start + timedelta(days=1)).isoformat(),
            "bookingOpensAt": clock.iso(now),
            "bookingClosesAt": clock.iso(now + timedelta(days=12)),
            "payment": {"bank": "กสิกรไทย", "accountName": "ทีมจัดงาน", "accountNo": "000-0-00000-0"},
            "maxLotsPerSeller": 2,
            "zones": [
                {"id": "A", "name": "อาหาร", "size": "3x3 ม.", "price": 500, "amenities": ["ไฟ"]},
                {"id": "B", "name": "ทั่วไป", "size": "2x2 ม.", "price": 300},
            ],
            "cols": 8,
            "rows": 4,
            "layout": _demo_layout(),
        }
    )
    timestamp = clock.iso(now)
    item = {
        **body.to_item(),
        "eventId": DEMO_EVENT_ID,
        "organizerId": organizer["userId"],
        "organizerName": organizer.get("orgName", ""),
        "publishStatus": events.OPEN,
        "publishedAt": timestamp,
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }
    _put_if_absent(events_table, item, "eventId")
    for lot in lots.lots_from_layout(item["layout"]):
        lot_item = {
            "eventId": DEMO_EVENT_ID,
            "lotId": lot["lotId"],
            "zoneId": lot["zoneId"],
            "status": lots.AVAILABLE,
            "createdAt": timestamp,
            "updatedAt": timestamp,
        }
        _put_if_absent(lots_table, lot_item, "lotId")
    return item


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--user-pool-id", required=True)
    parser.add_argument(
        "--stage", default="dev", help="ใช้หาชื่อตาราง bookmybooth-<stage>-<users|events|lots>"
    )
    parser.add_argument("--region", default="us-east-1")
    args = parser.parse_args()

    password = os.environ.get("SEED_PASSWORD")
    if not password:
        sys.exit("ตั้ง env SEED_PASSWORD ก่อน (อย่างน้อย 8 ตัว มีตัวพิมพ์เล็กและตัวเลข)")

    dynamodb = boto3.resource("dynamodb", region_name=args.region)

    def table(name: str):
        return dynamodb.Table(f"bookmybooth-{args.stage}-{name}")

    seeded = seed_accounts(
        cognito=boto3.client("cognito-idp", region_name=args.region),
        users_table=table("users"),
        pool_id=args.user_pool_id,
        password=password,
        # หน้าเว็บที่ host แสดง SEED_PASSWORD ให้ทุกคนเห็น (VITE_DEMO_PASSWORD) Admin จึงควรมีรหัสแยก
        admin_password=os.environ.get("ADMIN_SEED_PASSWORD"),
    )
    for item in seeded:
        print(f"{item['role']:<10} {item['email']}")

    organizer = next(item for item in seeded if item["role"] == users.ORGANIZER)
    event = seed_event(
        events_table=table("events"), lots_table=table("lots"), organizer=organizer, now=clock.now()
    )
    print(f"{'EVENT':<10} {event['eventId']} {event['title']}")


if __name__ == "__main__":
    main()
