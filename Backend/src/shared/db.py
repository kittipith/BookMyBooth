import os
from functools import cache
from typing import Literal

import boto3

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


def reset_clients() -> None:
    """ล้าง client ที่ cache ไว้ ใช้ใน test ให้สร้างใหม่ภายใต้ moto"""
    _resource.cache_clear()
    client.cache_clear()
