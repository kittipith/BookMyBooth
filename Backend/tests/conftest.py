import os

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
        **{env: f"bookmybooth-test-{env.removesuffix('_TABLE').lower()}" for env in TABLES},
    }
)

from shared import db  # noqa: E402


@pytest.fixture
def aws():
    """DynamoDB และ S3 จำลองที่มีตารางและ bucket ครบตาม tests/tables.py"""
    with mock_aws():
        db.reset_clients()
        dynamodb = boto3.client("dynamodb")
        for env, definition in TABLES.items():
            dynamodb.create_table(TableName=os.environ[env], **definition)
        boto3.client("s3").create_bucket(Bucket=os.environ["FILES_BUCKET"])
        yield
    db.reset_clients()
