from ulid import ULID


def new_id() -> str:
    """ULID: ไม่ซ้ำและเรียงตามเวลาที่สร้าง"""
    return str(ULID())
