"""โครงสร้างตาราง DynamoDB ตาม PLAN หัวข้อ 4

ตารางจริงสร้างเองใน AWS Console ไฟล์นี้ใช้สร้างตารางเดียวกันใน moto
ถ้าแก้ key หรือ GSI ต้องแก้ทั้ง PLAN หัวข้อ 4, ที่นี่ และใน Console ให้ตรงกัน
"""

from typing import Any


def _key_schema(pk: str, sk: str | None) -> list[dict[str, str]]:
    schema = [{"AttributeName": pk, "KeyType": "HASH"}]
    if sk:
        schema.append({"AttributeName": sk, "KeyType": "RANGE"})
    return schema


def _table(
    pk: str, sk: str | None = None, gsis: dict[str, tuple[str, str]] | None = None
) -> dict[str, Any]:
    gsis = gsis or {}
    key_names = {pk, sk, *(name for keys in gsis.values() for name in keys)} - {None}
    table: dict[str, Any] = {
        "BillingMode": "PAY_PER_REQUEST",
        "KeySchema": _key_schema(pk, sk),
        "AttributeDefinitions": [
            {"AttributeName": name, "AttributeType": "S"} for name in sorted(key_names)
        ],
    }
    if gsis:
        table["GlobalSecondaryIndexes"] = [
            {
                "IndexName": index_name,
                "KeySchema": _key_schema(*keys),
                "Projection": {"ProjectionType": "ALL"},
            }
            for index_name, keys in gsis.items()
        ]
    return table


# env var ของ Lambda → โครงสร้างตาราง
TABLES: dict[str, dict[str, Any]] = {
    "USERS_TABLE": _table("userId", gsis={"byRoleStatus": ("roleStatus", "createdAt")}),
    "EVENTS_TABLE": _table(
        "eventId",
        gsis={
            "byOrganizer": ("organizerId", "createdAt"),
            "byPublishStatus": ("publishStatus", "startDate"),
        },
    ),
    # SK เป็นรหัสล็อก (A01) หรือ QUOTA#<sellerId>
    "LOTS_TABLE": _table("eventId", "lotId"),
    "BOOKINGS_TABLE": _table(
        "bookingId",
        gsis={
            "bySeller": ("sellerId", "createdAt"),
            "byEventStatus": ("eventId", "statusCreatedAt"),
        },
    ),
    # SK = createdAt#notificationId, ใน Console เปิด TTL ที่ attribute `ttl`
    "NOTIFICATIONS_TABLE": _table("userId", "sk"),
}
