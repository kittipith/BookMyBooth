import boto3
import pytest

from domain import users
from functions.admin.app import lambda_handler
from helpers import call, claims, cognito_groups, create_cognito_user, get_user, notifications_of
from helpers import put_user as _put_user
from shared import db

ADMIN = claims("admin-1", "Admin")


@pytest.fixture
def put_user(user_pool):
    """สร้างผู้ใช้ทั้งในตาราง Users และใน Cognito จำลอง"""

    def _create(user_id, role, status=users.ACTIVE, **profile):
        create_cognito_user(user_pool, user_id)
        return _put_user(user_id, role, status, **profile)

    _create("admin-1", users.ADMIN)
    return _create


def test_non_admin_is_forbidden(put_user):
    put_user("s1", users.SELLER)
    status, _ = call(lambda_handler, "GET", "/admin/organizers", as_user=claims("s1", "Seller"))
    assert status == 403


def test_list_pending_organizers(put_user):
    put_user("o1", users.ORGANIZER, users.PENDING, orgName="A")
    put_user("o2", users.ORGANIZER, users.ACTIVE, orgName="B")

    status, body = call(lambda_handler, "GET", "/admin/organizers", as_user=ADMIN)

    assert status == 200
    assert [item["userId"] for item in body["items"]] == ["o1"]
    assert "roleStatus" not in body["items"][0]


def test_list_by_status(put_user):
    put_user("o2", users.ORGANIZER, users.ACTIVE)
    status, body = call(
        lambda_handler, "GET", "/admin/organizers", as_user=ADMIN, query={"status": "active"}
    )
    assert status == 200
    assert [item["userId"] for item in body["items"]] == ["o2"]


def test_approve_organizer(put_user, user_pool):
    put_user("o1", users.ORGANIZER, users.PENDING)

    status, body = call(lambda_handler, "POST", "/admin/organizers/o1/approve", as_user=ADMIN)

    assert status == 200
    assert body["status"] == users.ACTIVE
    assert get_user("o1")["roleStatus"] == "ORGANIZER#ACTIVE"
    assert cognito_groups(user_pool, "o1") == {"Organizer"}
    [notice] = notifications_of("o1")
    assert notice["type"] == "organizer_approved"
    assert notice["link"] == "/organizer"


def test_approve_twice_is_conflict(put_user):
    put_user("o1", users.ORGANIZER, users.PENDING)
    call(lambda_handler, "POST", "/admin/organizers/o1/approve", as_user=ADMIN)

    status, body = call(lambda_handler, "POST", "/admin/organizers/o1/approve", as_user=ADMIN)

    assert status == 409
    assert body["error"]["code"] == "INVALID_STATUS"


def test_approve_unknown_or_non_organizer(put_user):
    put_user("s1", users.SELLER)
    assert call(lambda_handler, "POST", "/admin/organizers/nope/approve", as_user=ADMIN)[0] == 404
    assert call(lambda_handler, "POST", "/admin/organizers/s1/approve", as_user=ADMIN)[0] == 404


def test_reject_requires_reason(put_user):
    put_user("o1", users.ORGANIZER, users.PENDING)
    status, body = call(lambda_handler, "POST", "/admin/organizers/o1/reject", {}, as_user=ADMIN)
    assert status == 400
    assert body["error"]["code"] == "VALIDATION_ERROR"


def test_reject_organizer(put_user, user_pool):
    put_user("o1", users.ORGANIZER, users.PENDING)

    status, body = call(
        lambda_handler,
        "POST",
        "/admin/organizers/o1/reject",
        {"reason": "ข้อมูลไม่ครบ"},
        as_user=ADMIN,
    )

    assert status == 200
    assert body["status"] == users.REJECTED
    assert body["statusReason"] == "ข้อมูลไม่ครบ"
    assert cognito_groups(user_pool, "o1") == set()
    [notice] = notifications_of("o1")
    assert notice["message"] == "บัญชีผู้จัดงานของคุณไม่ได้รับอนุมัติ: ข้อมูลไม่ครบ"


def test_suspend_user(put_user, user_pool):
    put_user("s1", users.SELLER)

    status, body = call(
        lambda_handler, "POST", "/admin/users/s1/suspend", {"reason": "สแปม"}, as_user=ADMIN
    )

    assert status == 200
    assert body["status"] == users.SUSPENDED
    assert get_user("s1")["roleStatus"] == "SELLER#SUSPENDED"
    cognito_user = boto3.client("cognito-idp").admin_get_user(UserPoolId=user_pool, Username="s1")
    assert cognito_user["Enabled"] is False
    assert notifications_of("s1")[0]["type"] == "account_suspended"


def test_cannot_suspend_admin_or_twice(put_user):
    put_user("admin-2", users.ADMIN)
    put_user("s1", users.SELLER, users.SUSPENDED)
    body = {"reason": "x"}

    assert (
        call(lambda_handler, "POST", "/admin/users/admin-2/suspend", body, as_user=ADMIN)[0] == 409
    )
    assert call(lambda_handler, "POST", "/admin/users/s1/suspend", body, as_user=ADMIN)[0] == 409


def test_list_events_newest_first(put_user):
    events = db.table("events")
    events.put_item(Item={"eventId": "e1", "createdAt": "2026-10-01T00:00:00.000Z"})
    events.put_item(Item={"eventId": "e2", "createdAt": "2026-10-02T00:00:00.000Z"})

    status, body = call(lambda_handler, "GET", "/admin/events", as_user=ADMIN)

    assert status == 200
    assert [item["eventId"] for item in body["items"]] == ["e2", "e1"]


def test_unsuspend_user(put_user, user_pool):
    put_user("s1", users.SELLER)
    call(lambda_handler, "POST", "/admin/users/s1/suspend", {"reason": "สแปม"}, as_user=ADMIN)

    status, body = call(lambda_handler, "POST", "/admin/users/s1/unsuspend", as_user=ADMIN)

    assert status == 200
    assert body["status"] == users.ACTIVE
    assert "statusReason" not in body
    assert get_user("s1")["roleStatus"] == "SELLER#ACTIVE"
    cognito_user = boto3.client("cognito-idp").admin_get_user(UserPoolId=user_pool, Username="s1")
    assert cognito_user["Enabled"] is True
    assert "Seller" in cognito_groups(user_pool, "s1")
    assert "account_unsuspended" in {n["type"] for n in notifications_of("s1")}

    assert call(lambda_handler, "POST", "/admin/users/s1/unsuspend", as_user=ADMIN)[0] == 409


def test_unsuspend_pending_organizer_becomes_active_organizer(put_user, user_pool):
    put_user("o1", users.ORGANIZER, users.PENDING)
    call(lambda_handler, "POST", "/admin/users/o1/suspend", {"reason": "x"}, as_user=ADMIN)

    status, body = call(lambda_handler, "POST", "/admin/users/o1/unsuspend", as_user=ADMIN)

    assert status == 200
    assert body["status"] == users.ACTIVE
    assert cognito_groups(user_pool, "o1") == {"Organizer"}
