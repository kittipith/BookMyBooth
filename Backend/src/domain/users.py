"""บัญชีผู้ใช้ในตาราง Users (PLAN หัวข้อ 4.1)"""

from datetime import datetime
from typing import Any

from shared import clock

SELLER = "SELLER"
ORGANIZER = "ORGANIZER"
ADMIN = "ADMIN"
ROLES = (SELLER, ORGANIZER, ADMIN)

ACTIVE = "ACTIVE"
PENDING = "PENDING"
REJECTED = "REJECTED"
SUSPENDED = "SUSPENDED"
STATUSES = (ACTIVE, PENDING, REJECTED, SUSPENDED)

# ชื่อ group ใน Cognito (PLAN 3.3)
GROUP_OF_ROLE = {SELLER: "Seller", ORGANIZER: "Organizer", ADMIN: "Admin"}

# ฟิลด์โปรไฟล์ที่เจ้าของบัญชีแก้เองได้ผ่าน PUT /me
EDITABLE_FIELDS: dict[str, frozenset[str]] = {
    SELLER: frozenset({"displayName", "phone", "shopName", "category", "line", "bio", "power"}),
    ORGANIZER: frozenset({"displayName", "phone", "orgName"}),
    ADMIN: frozenset({"displayName", "phone"}),
}

# ฟิลด์ภายในที่ไม่ส่งออกไปหน้าเว็บ
_INTERNAL_FIELDS = frozenset({"roleStatus", "username"})


def role_status(role: str, status: str) -> str:
    """ค่า PK ของ GSI byRoleStatus เช่น ORGANIZER#PENDING"""
    return f"{role}#{status}"


def initial_status(role: str) -> str:
    """ผู้ขายใช้งานได้ทันที ผู้จัดงานต้องรอ Admin อนุมัติ"""
    return PENDING if role == ORGANIZER else ACTIVE


def new_user(
    *,
    user_id: str,
    username: str,
    email: str,
    role: str,
    status: str,
    profile: dict[str, str],
    now: datetime,
) -> dict[str, Any]:
    allowed = EDITABLE_FIELDS[role]
    timestamp = clock.iso(now)
    return {
        "userId": user_id,
        "username": username,
        "email": email,
        "role": role,
        "status": status,
        "roleStatus": role_status(role, status),
        **{key: value for key, value in profile.items() if key in allowed and value},
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }


def public_profile(item: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in item.items() if key not in _INTERNAL_FIELDS}


def cognito_username(item: dict[str, Any]) -> str:
    """Username ใน Cognito (pool ที่ล็อกอินด้วยอีเมลจะเป็น UUID เดียวกับ sub)"""
    return item.get("username") or item["userId"]
