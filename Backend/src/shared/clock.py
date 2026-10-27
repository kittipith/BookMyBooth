from datetime import UTC, datetime


def now() -> datetime:
    """เวลาปัจจุบันแบบ UTC ให้ handler เรียกที่เดียวแล้วส่ง `now` ต่อให้ domain (เทสต์ส่งเวลาเองได้)"""
    return datetime.now(UTC)


def iso(value: datetime) -> str:
    """ISO-8601 UTC เช่น 2026-10-27T08:00:00.000Z เรียงตามตัวอักษรได้ตรงกับเวลา"""
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
