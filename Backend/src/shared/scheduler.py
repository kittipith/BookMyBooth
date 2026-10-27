"""schedule หมดเวลาจอง ชุดละ 1 ตัว (PLAN ข้อ 7.1) ชื่อ expire-<groupId> จึงไม่ต้องเก็บชื่อไว้"""

import json
import os
from datetime import UTC, datetime
from functools import cache

import boto3
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError

logger = Logger()


@cache
def client():
    return boto3.client("scheduler")


def schedule_name(group_id: str) -> str:
    return f"expire-{group_id}"


def create_expiry(group_id: str, booking_ids: list[str], at: datetime) -> bool:
    """ถ้าสร้างไม่ได้แค่ log ไว้ ไม่ทำให้การจองล้ม เพราะมี fallback ข้อ 7.6"""
    try:
        client().create_schedule(
            Name=schedule_name(group_id),
            ScheduleExpression=f"at({at.astimezone(UTC).strftime('%Y-%m-%dT%H:%M:%S')})",
            ScheduleExpressionTimezone="UTC",
            FlexibleTimeWindow={"Mode": "OFF"},
            ActionAfterCompletion="DELETE",
            Target={
                "Arn": os.environ["EXPIRE_FUNCTION_ARN"],
                "RoleArn": os.environ["SCHEDULER_ROLE_ARN"],
                "Input": json.dumps({"bookingIds": booking_ids}),
            },
        )
        return True
    except (ClientError, KeyError):
        logger.exception("Failed to create expiry schedule", extra={"groupId": group_id})
        return False


def delete_expiry(group_id: str) -> None:
    """ลบไม่ได้ก็ไม่เป็นไร expire_booking มี condition กันอยู่"""
    try:
        client().delete_schedule(Name=schedule_name(group_id))
    except ClientError:
        logger.info("Expiry schedule not deleted", extra={"groupId": group_id})
