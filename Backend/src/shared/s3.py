import os
from functools import cache

import boto3
from botocore.exceptions import ClientError

URL_EXPIRES_SECONDS = 300


@cache
def client():
    return boto3.client("s3")


def bucket() -> str:
    return os.environ["FILES_BUCKET"]


def presigned_post(key: str, content_type: str, max_bytes: int) -> dict:
    """หน้าเว็บอัปโหลดตรงไป S3 ด้วย FormData ใช้ POST เพื่อจำกัดขนาดและชนิดไฟล์ได้"""
    return client().generate_presigned_post(
        Bucket=bucket(),
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[
            {"Content-Type": content_type},
            ["content-length-range", 1, max_bytes],
        ],
        ExpiresIn=URL_EXPIRES_SECONDS,
    )


def presigned_get(key: str) -> str:
    return client().generate_presigned_url(
        "get_object", Params={"Bucket": bucket(), "Key": key}, ExpiresIn=URL_EXPIRES_SECONDS
    )


def object_size(key: str) -> int | None:
    """ขนาดไฟล์ หรือ None ถ้ายังไม่มีไฟล์"""
    try:
        return client().head_object(Bucket=bucket(), Key=key)["ContentLength"]
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return None
        raise
