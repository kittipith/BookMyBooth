import os
from datetime import UTC, datetime, timedelta

import boto3
import pytest
from moto import mock_aws

from tables import TABLES

# ตั้งก่อน import โค้ดใน src เพื่อไม่ให้ boto3 ไปหา credentials จริง
os.environ.update(
    {
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "AWS_SESSION_TOKEN": "testing",
        "AWS_DEFAULT_REGION": "us-east-1",
        "POWERTOOLS_SERVICE_NAME": "bookmybooth-test",
        "POWERTOOLS_LOG_LEVEL": "WARNING",
        "FILES_BUCKET": "bookmybooth-test-files",
        "EXPIRE_FUNCTION_ARN": "arn:aws:lambda:us-east-1:123456789012:function:expire-booking",
        "SCHEDULER_ROLE_ARN": "arn:aws:iam::123456789012:role/LabRole",
        **{env: f"bookmybooth-test-{env.removesuffix('_TABLE').lower()}" for env in TABLES},
    }
)

from domain import users  # noqa: E402
from shared import clock, cognito, db, s3, scheduler  # noqa: E402


def _reset_clients() -> None:
    db.reset_clients()
    for module in (cognito, s3, scheduler):
        module.client.cache_clear()


@pytest.fixture
def aws():
    """DynamoDB และ S3 จำลองที่มีตารางและ bucket ครบตาม tests/tables.py"""
    with mock_aws():
        _reset_clients()
        dynamodb = boto3.client("dynamodb")
        for env, definition in TABLES.items():
            dynamodb.create_table(TableName=os.environ[env], **definition)
        boto3.client("s3").create_bucket(Bucket=os.environ["FILES_BUCKET"])
        yield
    _reset_clients()


class FrozenClock:
    """ตั้งเวลาให้ clock.now() ในโค้ดทุก module (เดินหน้าด้วย advance)"""

    def __init__(self, start: datetime):
        self.current = start

    def now(self) -> datetime:
        return self.current

    def advance(self, **delta: float) -> None:
        self.current += timedelta(**delta)


@pytest.fixture
def frozen_clock(monkeypatch) -> FrozenClock:
    frozen = FrozenClock(datetime.now(UTC))
    monkeypatch.setattr(clock, "now", frozen.now)
    return frozen


@pytest.fixture
def user_pool(aws, monkeypatch) -> str:
    """User Pool จำลองพร้อม group Seller / Organizer / Admin และตั้ง env USER_POOL_ID"""
    client = boto3.client("cognito-idp")
    pool_id = client.create_user_pool(PoolName="bookmybooth-test")["UserPool"]["Id"]
    for group in users.GROUP_OF_ROLE.values():
        client.create_group(UserPoolId=pool_id, GroupName=group)
    monkeypatch.setenv("USER_POOL_ID", pool_id)
    return pool_id
