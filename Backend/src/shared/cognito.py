import os
from functools import cache

import boto3


@cache
def client():
    return boto3.client("cognito-idp")


def user_pool_id() -> str:
    """ใช้ใน function ที่จัดการผู้ใช้ (admin) ส่วน post_confirmation อ่านจาก trigger event"""
    return os.environ["USER_POOL_ID"]
