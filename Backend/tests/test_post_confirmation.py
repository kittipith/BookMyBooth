from apigw import FakeLambdaContext
from domain import users
from functions.post_confirmation.app import lambda_handler
from helpers import cognito_groups, create_cognito_user, get_user, notifications_of, put_user


def signup_event(pool_id, sub, role, metadata=None, source="PostConfirmation_ConfirmSignUp"):
    return {
        "version": "1",
        "region": "us-east-1",
        "userPoolId": pool_id,
        "userName": sub,
        "triggerSource": source,
        "request": {
            "userAttributes": {"sub": sub, "email": f"{sub}@example.com", "custom:role": role},
            "clientMetadata": metadata,
        },
        "response": {},
    }


def run(event):
    return lambda_handler(event, FakeLambdaContext())


def test_seller_is_active_and_in_seller_group(user_pool):
    create_cognito_user(user_pool, "u-seller")
    event = signup_event(
        user_pool,
        "u-seller",
        "seller",
        {"name": "สมชาย", "phone": "0812345678", "orgName": "ร้านขนม", "category": "อาหาร"},
    )

    assert run(event) == event

    user = get_user("u-seller")
    assert user["role"] == users.SELLER
    assert user["status"] == users.ACTIVE
    assert user["roleStatus"] == "SELLER#ACTIVE"
    assert user["displayName"] == "สมชาย"
    assert user["shopName"] == "ร้านขนม"
    assert user["category"] == "อาหาร"
    assert "orgName" not in user
    assert cognito_groups(user_pool, "u-seller") == {"Seller"}


def test_organizer_is_pending_and_admins_are_notified(user_pool):
    put_user("admin-1", users.ADMIN)
    create_cognito_user(user_pool, "u-org")

    run(signup_event(user_pool, "u-org", "organizer", {"orgName": "ตลาดนัดเช้า"}))

    user = get_user("u-org")
    assert user["status"] == users.PENDING
    assert user["orgName"] == "ตลาดนัดเช้า"
    assert cognito_groups(user_pool, "u-org") == set()

    [notice] = notifications_of("admin-1")
    assert notice["type"] == "organizer_pending"
    assert notice["message"] == "ตลาดนัดเช้า สมัครเป็นผู้จัดงาน รอคุณตรวจสอบ"
    assert notice["link"] == "/admin"
    assert notice["read"] is False


def test_retry_does_not_duplicate(user_pool):
    put_user("admin-1", users.ADMIN)
    create_cognito_user(user_pool, "u-org")
    event = signup_event(user_pool, "u-org", "organizer", {"orgName": "ตลาดนัดเช้า"})

    run(event)
    run(event)

    assert len(notifications_of("admin-1")) == 1


def test_forgot_password_confirmation_is_ignored(user_pool):
    run(signup_event(user_pool, "u1", "seller", source="PostConfirmation_ConfirmForgotPassword"))
    assert get_user("u1") is None


def test_cannot_sign_up_as_admin(user_pool):
    create_cognito_user(user_pool, "u-sneaky")
    run(signup_event(user_pool, "u-sneaky", "admin"))

    assert get_user("u-sneaky")["role"] == users.SELLER
    assert cognito_groups(user_pool, "u-sneaky") == {"Seller"}


def test_invalid_metadata_still_creates_account(user_pool):
    create_cognito_user(user_pool, "u2")
    run(signup_event(user_pool, "u2", "seller", {"phone": "not a phone"}))

    user = get_user("u2")
    assert user["status"] == users.ACTIVE
    assert "phone" not in user
