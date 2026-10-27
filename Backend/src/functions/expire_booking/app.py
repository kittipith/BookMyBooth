"""ถูกเรียกโดย EventBridge Scheduler เมื่อถึงเวลาหมดอายุของชุดการจอง (PLAN ข้อ 7.5)

input แบบปกติ: {"bookingIds": [...]} จาก schedule expire-<groupId>
ไม่มี bookingIds = โหมดกวาด (ใช้กับ schedule rate(5 minutes) ถ้าสัปดาห์ 11 พบว่า Lambda
สร้าง schedule เองไม่ได้) หา PENDING_PAYMENT ที่เลยเวลาทั้งหมด
"""

from typing import Any

from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from boto3.dynamodb.conditions import Attr

from domain import booking
from shared import booking_ops, clock, db

logger = Logger()


def _due_bookings(event: dict[str, Any], now_iso: str) -> list[dict[str, Any]]:
    if event.get("bookingIds"):
        found = (booking_ops.get(booking_id) for booking_id in event["bookingIds"])
        return [item for item in found if item is not None]
    return db.scan_all(
        "bookings",
        FilterExpression=Attr("status").eq(booking.PENDING_PAYMENT)
        & Attr("expiresAt").lte(now_iso),
    )


@logger.inject_lambda_context
def lambda_handler(event: dict[str, Any], context: LambdaContext) -> dict[str, Any]:
    now = clock.now()
    expired = [
        item["bookingId"]
        for item in _due_bookings(event, clock.iso(now))
        # สำเร็จเฉพาะที่ยัง PENDING_PAYMENT และเลยเวลาจริง ที่เหลือจบเงียบ ๆ
        if booking_ops.expire(item, now)
    ]
    logger.info("Expired bookings", extra={"bookingIds": expired})
    return {"expired": expired}
