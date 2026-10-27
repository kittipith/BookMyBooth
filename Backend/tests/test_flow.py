"""flow ครบในเครื่องเทสต์เดียว (PLAN 10.1): เรียก handler จริงต่อกันตั้งแต่สมัครจนเช็กอิน

สมัคร → Admin อนุมัติผู้จัดงาน → สร้างงาน → sync ล็อก → เผยแพร่ → ผู้ขายจอง 2 ล็อก
→ แนบสลิปเดียวทั้งชุด → ผู้จัดงานอนุมัติ (ย้ายล็อก 1 รายการ) → เช็กอินวันงาน → แจ้งเตือน → สรุปงาน
"""

import boto3

from apigw import FakeLambdaContext
from domain import lots, users
from functions.admin.app import lambda_handler as admin_api
from functions.bookings.app import lambda_handler as bookings_api
from functions.events.app import lambda_handler as events_api
from functions.me.app import lambda_handler as me_api
from functions.post_confirmation.app import lambda_handler as post_confirmation
from helpers import call, claims, create_cognito_user, event_body, put_user
from shared import s3


def sign_up(pool_id: str, sub: str, role: str, metadata: dict) -> None:
    """จำลอง confirmSignUp: Cognito เรียก PostConfirmation trigger พร้อม clientMetadata"""
    create_cognito_user(pool_id, sub)
    event = {
        "version": "1",
        "region": "us-east-1",
        "userPoolId": pool_id,
        "userName": sub,
        "triggerSource": "PostConfirmation_ConfirmSignUp",
        "request": {
            "userAttributes": {"sub": sub, "email": f"{sub}@example.com", "custom:role": role},
            "clientMetadata": metadata,
        },
        "response": {},
    }
    assert post_confirmation(event, FakeLambdaContext()) == event


def ok(result, expected_status=200):
    status, body = result
    assert status == expected_status, body
    return body


def notice_types(user):
    body = ok(call(me_api, "GET", "/notifications", as_user=user))
    return [item["type"] for item in body["items"]], body["unreadCount"]


def test_full_booking_flow(user_pool, frozen_clock):
    admin = claims("admin-1", "Admin")
    create_cognito_user(user_pool, "admin-1")
    put_user("admin-1", users.ADMIN)

    # ---------- สมัครสมาชิก ----------
    sign_up(user_pool, "org-1", "organizer", {"name": "คุณจัด", "orgName": "ตลาดนัดเช้า"})
    sign_up(
        user_pool,
        "seller-1",
        "seller",
        {"name": "คุณขาย", "phone": "0812345678", "orgName": "ร้านขนม", "category": "อาหาร"},
    )
    pending_org = claims("org-1")  # ยังไม่มี group Organizer ใน token
    assert ok(call(me_api, "GET", "/me", as_user=pending_org))["status"] == users.PENDING
    assert call(events_api, "POST", "/events", event_body(), as_user=pending_org)[0] == 403
    assert notice_types(admin) == (["organizer_pending"], 1)

    # ---------- Admin อนุมัติผู้จัดงาน ----------
    pending = ok(call(admin_api, "GET", "/admin/organizers", as_user=admin))["items"]
    assert [item["orgName"] for item in pending] == ["ตลาดนัดเช้า"]
    ok(call(admin_api, "POST", "/admin/organizers/org-1/approve", as_user=admin))
    organizer = claims("org-1", "Organizer")  # token ใหม่หลัง fetchAuthSession(forceRefresh)
    seller = claims("seller-1", "Seller")

    # ---------- สร้างงาน + ล็อก + เผยแพร่ ----------
    body = event_body(maxLotsPerSeller=2, slipDeadlineMinutes=60)
    event = ok(call(events_api, "POST", "/events", body, as_user=organizer), 201)
    event_id = event["eventId"]
    assert event["organizerName"] == "ตลาดนัดเช้า"

    layout_lots = lots.lots_from_layout(body["layout"])
    synced = ok(
        call(
            events_api, "PUT", f"/events/{event_id}/lots", {"lots": layout_lots}, as_user=organizer
        )
    )
    assert [lot["lotId"] for lot in synced["items"]] == ["A01", "A02", "B01", "B02", "B03"]
    published = ok(
        call(
            events_api,
            "PUT",
            f"/events/{event_id}",
            {"publishStatus": "OPEN"},
            as_user=organizer,
        )
    )
    assert published["status"] == "OPEN"

    # ---------- ผู้ขายเลือกงานและจอง 2 ล็อก ----------
    listed = ok(call(events_api, "GET", "/events"))["items"]
    assert [item["eventId"] for item in listed] == [event_id]
    created = ok(
        call(
            bookings_api,
            "POST",
            "/bookings",
            {"eventId": event_id, "lotIds": ["A01", "B01"], "shopName": "ร้านขนม", "power": True},
            as_user=seller,
        ),
        201,
    )
    by_lot = {item["lotId"]: item["bookingId"] for item in created["bookings"]}
    public_lots = ok(call(events_api, "GET", f"/events/{event_id}/lots"))["items"]
    assert {lot["lotId"]: lot["status"] for lot in public_lots}["A01"] == "HELD"

    # ---------- แนบสลิปเดียวทั้งชุด ----------
    upload = ok(
        call(
            bookings_api,
            "POST",
            f"/bookings/{by_lot['A01']}/slip-url",
            {"contentType": "image/png"},
            as_user=seller,
        )
    )
    boto3.client("s3").put_object(Bucket=s3.bucket(), Key=upload["key"], Body=b"png")
    attached = ok(
        call(
            bookings_api,
            "POST",
            f"/bookings/{by_lot['A01']}/slip",
            {"key": upload["key"]},
            as_user=seller,
        )
    )
    assert {item["status"] for item in attached["bookings"]} == {"PENDING_REVIEW"}

    # ---------- ผู้จัดงานตรวจ: ย้าย A01 → A02 และอนุมัติ B01 ----------
    review = ok(
        call(
            bookings_api,
            "GET",
            f"/events/{event_id}/bookings",
            as_user=organizer,
            query={"status": "PENDING_REVIEW"},
        )
    )["items"]
    assert len(review) == 2
    assert ok(call(bookings_api, "GET", f"/bookings/{by_lot['B01']}/slip", as_user=organizer))[
        "url"
    ]

    moved = ok(
        call(
            bookings_api,
            "POST",
            f"/bookings/{by_lot['A01']}/approve",
            {"newLotId": "A02"},
            as_user=organizer,
        )
    )
    assert (moved["status"], moved["lotId"], moved["amount"]) == ("APPROVED", "A02", 500)
    ok(call(bookings_api, "POST", f"/bookings/{by_lot['B01']}/approve", as_user=organizer))

    lot_status = {
        lot["lotId"]: lot["status"]
        for lot in ok(call(events_api, "GET", f"/events/{event_id}/lots"))["items"]
    }
    assert lot_status == {
        "A01": "AVAILABLE",
        "A02": "BOOKED",
        "B01": "BOOKED",
        "B02": "AVAILABLE",
        "B03": "AVAILABLE",
    }

    # ---------- วันงาน: เช็กอินทั้งสองล็อก ----------
    frozen_clock.advance(days=10)
    for booking_id in by_lot.values():
        checked = ok(
            call(bookings_api, "POST", f"/bookings/{booking_id}/check-in", as_user=organizer)
        )
        assert checked["checkedIn"] is True
    mine = ok(call(bookings_api, "GET", "/bookings/me", as_user=seller))["items"]
    assert {(item["lotId"], item["status"], item["checkedIn"]) for item in mine} == {
        ("A02", "APPROVED", True),
        ("B01", "APPROVED", True),
    }

    # ---------- แจ้งเตือน ----------
    seller_types, seller_unread = notice_types(seller)
    assert sorted(seller_types) == ["booking_approved", "booking_moved"]
    assert seller_unread == 2
    org_types, _ = notice_types(organizer)
    assert sorted(org_types) == ["booking_new", "booking_slip_uploaded", "organizer_approved"]
    read = ok(call(me_api, "POST", "/notifications/read", {"all": True}, as_user=seller))
    assert read == {"updated": 2, "unreadCount": 0}

    # ---------- สรุปงานและสถิติร้าน ----------
    summary = ok(call(events_api, "GET", f"/events/{event_id}/summary", as_user=organizer))
    assert summary["revenue"] == 800
    assert summary["lots"]["BOOKED"] == 2
    assert summary["bookings"] == {"APPROVED": 2}
    [vendor] = ok(call(bookings_api, "GET", "/organizer/vendors", as_user=organizer))["items"]
    assert vendor["shop"]["shopName"] == "ร้านขนม"
    assert (vendor["approved"], vendor["total"]) == (2, 800)
