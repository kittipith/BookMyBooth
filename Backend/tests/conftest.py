import os

import boto3
import pytest
from moto import mock_aws

# ตั้งก่อน import โค้ดใน src เพื่อไม่ให้ boto3 ไปหา credentials จริง
os.environ.update(
    {
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "AWS_SESSION_TOKEN": "testing",
        "AWS_DEFAULT_REGION": "us-east-1",
        "POWERTOOLS_SERVICE_NAME": "bookmybooth-test",
        "POWERTOOLS_LOG_LEVEL": "WARNING",
        "USERS_TABLE": "UsersTable",
        "EVENTS_TABLE": "EventsTable",
        "LOTS_TABLE": "LotsTable",
        "BOOKINGS_TABLE": "BookingsTable",
        "NOTIFICATIONS_TABLE": "NotificationsTable",
        "FILES_BUCKET": "files-bucket",
    }
)

from shared import db  # noqa: E402
from template_util import resources_of_type  # noqa: E402

_CREATE_TABLE_KEYS = ("AttributeDefinitions", "KeySchema", "GlobalSecondaryIndexes", "BillingMode")


def _create_tables_from_template() -> None:
    """สร้างตารางใน moto จาก template.yaml โดยตรง key และ GSI ใน test จึงตรงกับของจริงเสมอ"""
    dynamodb = boto3.client("dynamodb")
    for logical_id, resource in resources_of_type("AWS::DynamoDB::Table").items():
        props = resource["Properties"]
        dynamodb.create_table(
            TableName=logical_id,
            **{key: props[key] for key in _CREATE_TABLE_KEYS if key in props},
        )


@pytest.fixture
def aws():
    """DynamoDB และ S3 จำลองที่มีตารางและ bucket ครบตาม template"""
    with mock_aws():
        db.reset_clients()
        _create_tables_from_template()
        boto3.client("s3").create_bucket(Bucket=os.environ["FILES_BUCKET"])
        yield
    db.reset_clients()
