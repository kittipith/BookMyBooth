import pytest

from domain import users
from helpers import call, claims, put_user
from shared.auth import current_user, parse_groups, require_group
from shared.http import create_app


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("[Seller]", {"Seller"}),
        ("[Seller Admin]", {"Seller", "Admin"}),
        ("[Seller, Admin]", {"Seller", "Admin"}),
        (["Organizer"], {"Organizer"}),
        ("", set()),
        (None, set()),
    ],
)
def test_parse_groups(raw, expected):
    assert parse_groups(raw) == expected


@pytest.fixture
def handler():
    app = create_app()

    @app.get("/organizer-only")
    def organizer_only():
        return {"userId": require_group(app, "Organizer").user_id}

    @app.get("/profile")
    def profile():
        return {"status": current_user(app, allow_inactive=True).status}

    return app.resolve


def test_no_claims_is_401(aws, handler):
    status, body = call(handler, "GET", "/organizer-only")
    assert status == 401
    assert body["error"]["code"] == "UNAUTHORIZED"


def test_wrong_group_is_403(aws, handler):
    put_user("s1", users.SELLER)
    status, body = call(handler, "GET", "/organizer-only", as_user=claims("s1", "Seller"))
    assert status == 403
    assert body["error"]["code"] == "FORBIDDEN"


def test_missing_account_is_403(aws, handler):
    status, body = call(handler, "GET", "/organizer-only", as_user=claims("ghost", "Organizer"))
    assert status == 403
    assert body["error"]["code"] == "ACCOUNT_NOT_FOUND"


def test_suspended_account_is_blocked_even_with_valid_token(aws, handler):
    put_user("o1", users.ORGANIZER, users.SUSPENDED)
    status, body = call(handler, "GET", "/organizer-only", as_user=claims("o1", "Organizer"))
    assert status == 403
    assert body["error"]["code"] == "ACCOUNT_SUSPENDED"

    status, body = call(handler, "GET", "/profile", as_user=claims("o1", "Organizer"))
    assert status == 403


def test_group_member_passes(aws, handler):
    put_user("o1", users.ORGANIZER)
    status, body = call(handler, "GET", "/organizer-only", as_user=claims("o1", "Organizer"))
    assert status == 200
    assert body == {"userId": "o1"}


def test_allow_inactive_lets_pending_through(aws, handler):
    put_user("o2", users.ORGANIZER, users.PENDING)
    status, body = call(handler, "GET", "/profile", as_user=claims("o2"))
    assert status == 200
    assert body == {"status": users.PENDING}
