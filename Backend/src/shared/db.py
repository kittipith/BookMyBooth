import os
from functools import cache
from typing import Literal

import boto3
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

TableName = Literal["users", "events", "lots", "bookings", "notifications"]

_TABLE_ENV: dict[str, str] = {
    "users": "USERS_TABLE",
    "events": "EVENTS_TABLE",
    "lots": "LOTS_TABLE",
    "bookings": "BOOKINGS_TABLE",
    "notifications": "NOTIFICATIONS_TABLE",
}


@cache
def _resource():
    return boto3.resource("dynamodb")


@cache
def client():
    """low-level client สำหรับ transact_write_items (ค่าต้องอยู่ในรูป {"S": ...})"""
    return boto3.client("dynamodb")


def table_name(name: TableName) -> str:
    return os.environ[_TABLE_ENV[name]]


def table(name: TableName):
    return _resource().Table(table_name(name))


def query_all(name: TableName, **kwargs) -> list[dict]:
    """query ต่อจนครบทุกหน้า (ข้อมูลระบบนี้เล็ก ไม่ต้องทำ pagination ให้หน้าเว็บ)"""
    return _paginate(table(name).query, kwargs)


def scan_all(name: TableName, **kwargs) -> list[dict]:
    return _paginate(table(name).scan, kwargs)


def _paginate(operation, kwargs: dict) -> list[dict]:
    items: list[dict] = []
    while True:
        page = operation(**kwargs)
        items.extend(page.get("Items", []))
        if "LastEvaluatedKey" not in page:
            return items
        kwargs = {**kwargs, "ExclusiveStartKey": page["LastEvaluatedKey"]}


_serializer = TypeSerializer()

# DynamoDB รับได้ไม่เกิน 100 item ต่อ transaction
TRANSACTION_LIMIT = 100


def serialize(item: dict) -> dict:
    """แปลง dict ธรรมดาเป็นรูป low-level ({"S": ...}) สำหรับ transact_write_items"""
    return {key: _serializer.serialize(value) for key, value in item.items()}


def transact_write(items: list[dict]) -> None:
    """เขียนทีละไม่เกิน 100 item (แต่ละชุด all-or-nothing แต่ข้ามชุดไม่ atomic)"""
    for start in range(0, len(items), TRANSACTION_LIMIT):
        client().transact_write_items(TransactItems=items[start : start + TRANSACTION_LIMIT])


def is_condition_failure(error: ClientError) -> bool:
    return error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException"


def reset_clients() -> None:
    """ล้าง client ที่ cache ไว้ ใช้ใน test ให้สร้างใหม่ภายใต้ moto"""
    _resource.cache_clear()
    client.cache_clear()
