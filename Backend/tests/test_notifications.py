from datetime import timedelta

from domain import users
from functions.me.app import lambda_handler
from helpers import NOW, call, claims, put_user
from shared.notify import notify

USER = claims("s1", "Seller")


def seed_notifications(count=3):
    for index in range(count):
        notify(
            ["s1"], "booking_new", f"ข้อความ {index}", now=NOW + timedelta(minutes=index), link="/x"
        )


def test_list_newest_first_with_unread_count(aws):
    put_user("s1", users.SELLER)
    seed_notifications()

    status, body = call(lambda_handler, "GET", "/notifications", as_user=USER)

    assert status == 200
    assert [n["message"] for n in body["items"]] == ["ข้อความ 2", "ข้อความ 1", "ข้อความ 0"]
    assert body["unreadCount"] == 3
    assert set(body["items"][0]) == {"id", "type", "message", "read", "createdAt", "link"}


def test_mark_some_read(aws):
    put_user("s1", users.SELLER)
    seed_notifications()
    _, body = call(lambda_handler, "GET", "/notifications", as_user=USER)
    ids = [body["items"][0]["id"]]

    status, result = call(lambda_handler, "POST", "/notifications/read", {"ids": ids}, as_user=USER)

    assert status == 200
    assert result == {"updated": 1, "unreadCount": 2}
    _, body = call(lambda_handler, "GET", "/notifications", as_user=USER)
    assert [n["read"] for n in body["items"]] == [True, False, False]


def test_mark_all_read(aws):
    put_user("s1", users.SELLER)
    seed_notifications()
    _, result = call(lambda_handler, "POST", "/notifications/read", {"all": True}, as_user=USER)
    assert result == {"updated": 3, "unreadCount": 0}


def test_cannot_touch_other_users_notifications(aws):
    put_user("s1", users.SELLER)
    put_user("s2", users.SELLER)
    seed_notifications(1)
    _, body = call(lambda_handler, "GET", "/notifications", as_user=USER)

    _, result = call(
        lambda_handler,
        "POST",
        "/notifications/read",
        {"ids": [body["items"][0]["id"]]},
        as_user=claims("s2", "Seller"),
    )

    assert result == {"updated": 0, "unreadCount": 0}
    assert call(lambda_handler, "GET", "/notifications", as_user=USER)[1]["unreadCount"] == 1


def test_mark_read_requires_ids_or_all(aws):
    put_user("s1", users.SELLER)
    assert call(lambda_handler, "POST", "/notifications/read", {}, as_user=USER)[0] == 400


def test_pending_organizer_can_read_notifications(aws):
    put_user("o1", users.ORGANIZER, users.PENDING)
    status, body = call(lambda_handler, "GET", "/notifications", as_user=claims("o1"))
    assert status == 200
    assert body == {"items": [], "unreadCount": 0}
