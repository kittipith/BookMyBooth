from domain import users
from functions.me.app import lambda_handler
from helpers import call, claims, get_user, put_user


def test_get_me_hides_internal_fields(aws):
    put_user("o1", users.ORGANIZER, users.PENDING, orgName="ตลาดนัดเช้า")

    status, body = call(lambda_handler, "GET", "/me", as_user=claims("o1"))

    assert status == 200
    assert body["status"] == users.PENDING
    assert body["orgName"] == "ตลาดนัดเช้า"
    assert "roleStatus" not in body
    assert "username" not in body


def test_get_me_requires_login(aws):
    status, _ = call(lambda_handler, "GET", "/me")
    assert status == 401


def test_seller_updates_own_profile(aws):
    put_user("s1", users.SELLER, shopName="เดิม")

    status, body = call(
        lambda_handler,
        "PUT",
        "/me",
        {"shopName": "ร้านใหม่", "phone": "0899999999"},
        as_user=claims("s1", "Seller"),
    )

    assert status == 200
    assert body["shopName"] == "ร้านใหม่"
    assert get_user("s1")["phone"] == "0899999999"


def test_cannot_set_field_of_other_role(aws):
    put_user("o1", users.ORGANIZER)

    status, body = call(
        lambda_handler, "PUT", "/me", {"shopName": "x"}, as_user=claims("o1", "Organizer")
    )

    assert status == 400
    assert body["error"]["code"] == "FIELD_NOT_ALLOWED"
    assert body["error"]["details"] == {"fields": ["shopName"]}


def test_unknown_field_is_rejected(aws):
    put_user("s1", users.SELLER)

    status, body = call(
        lambda_handler, "PUT", "/me", {"role": "ADMIN"}, as_user=claims("s1", "Seller")
    )

    assert status == 400
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert get_user("s1")["role"] == users.SELLER


def test_invalid_phone(aws):
    put_user("s1", users.SELLER)
    status, _ = call(lambda_handler, "PUT", "/me", {"phone": "abc"}, as_user=claims("s1"))
    assert status == 400


def test_suspended_cannot_update(aws):
    put_user("s1", users.SELLER, users.SUSPENDED)
    status, body = call(lambda_handler, "PUT", "/me", {"phone": "0811111111"}, as_user=claims("s1"))
    assert status == 403
    assert body["error"]["code"] == "ACCOUNT_SUSPENDED"


def test_seller_shop_profile_fields(aws):
    put_user("s1", users.SELLER)
    status, body = call(
        lambda_handler,
        "PUT",
        "/me",
        {"line": "@kanom", "bio": "ขนมไทยโบราณ", "power": "ไฟ 5A"},
        as_user=claims("s1", "Seller"),
    )
    assert status == 200
    assert (body["line"], body["bio"], body["power"]) == ("@kanom", "ขนมไทยโบราณ", "ไฟ 5A")


def test_organizer_cannot_set_shop_profile_fields(aws):
    put_user("o1", users.ORGANIZER)
    status, body = call(
        lambda_handler, "PUT", "/me", {"line": "@x"}, as_user=claims("o1", "Organizer")
    )
    assert status == 400
    assert body["error"]["details"] == {"fields": ["line"]}


def test_organizer_saves_default_payment(aws):
    put_user("o1", users.ORGANIZER)
    payment = {"bank": "กสิกรไทย", "accountName": "ทีมจัดงาน", "accountNo": "123-4-56789-0"}

    status, body = call(
        lambda_handler, "PUT", "/me", {"payment": payment}, as_user=claims("o1", "Organizer")
    )

    assert status == 200
    assert body["payment"] == payment
    assert get_user("o1")["payment"] == payment


def test_payment_is_validated_and_organizer_only(aws):
    put_user("o1", users.ORGANIZER)
    put_user("s1", users.SELLER)

    status, body = call(
        lambda_handler,
        "PUT",
        "/me",
        {"payment": {"bank": "กสิกรไทย"}},
        as_user=claims("o1", "Organizer"),
    )
    assert status == 400
    assert body["error"]["code"] == "VALIDATION_ERROR"

    payment = {"bank": "กสิกรไทย", "accountName": "ร้าน", "accountNo": "1"}
    status, body = call(
        lambda_handler, "PUT", "/me", {"payment": payment}, as_user=claims("s1", "Seller")
    )
    assert status == 400
    assert body["error"]["code"] == "FIELD_NOT_ALLOWED"
