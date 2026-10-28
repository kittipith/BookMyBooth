import boto3
import pytest

from apigw import FakeLambdaContext
from domain import booking, users
from functions.bookings.app import lambda_handler
from functions.events.app import lambda_handler as events_handler
from functions.expire_booking.app import lambda_handler as expire_handler
from helpers import call, claims, get_lot, notifications_of, put_open_event, put_user
from shared import booking_ops, db, s3, scheduler

SELLER = claims("s1", "Seller")
OTHER_SELLER = claims("s2", "Seller")
ORGANIZER = claims("o1", "Organizer")


@pytest.fixture
def setup(aws, frozen_clock):
    put_user("o1", users.ORGANIZER)
    put_user("s1", users.SELLER)
    put_user("s2", users.SELLER)
    return frozen_clock


def book(lot_ids, as_user=SELLER, event_id="e1"):
    return call(
        lambda_handler,
        "POST",
        "/bookings",
        {"eventId": event_id, "lotIds": lot_ids, "shopName": "ร้านขนม"},
        as_user=as_user,
    )


def booked(lot_ids, as_user=SELLER):
    status, body = book(lot_ids, as_user)
    assert status == 201, body
    return body


def quota(seller_id, event_id="e1"):
    item = get_lot(event_id, f"QUOTA#{seller_id}")
    return int(item["count"]) if item else 0


def upload_slip(booking_id, as_user=SELLER):
    status, upload = call(
        lambda_handler,
        "POST",
        f"/bookings/{booking_id}/slip-url",
        {"contentType": "image/png"},
        as_user=as_user,
    )
    assert status == 200, upload
    boto3.client("s3").put_object(Bucket=s3.bucket(), Key=upload["key"], Body=b"png")
    return upload


def expire_run(payload):
    return expire_handler(payload, FakeLambdaContext())


# ---------- จอง ----------


def test_book_one_lot(setup):
    put_open_event()

    body = booked(["A01"])

    [created] = body["bookings"]
    assert created["status"] == booking.PENDING_PAYMENT
    assert created["groupId"] == body["groupId"]
    assert created["amount"] == 500
    assert created["eventTitle"] == "ตลาดนัดทดสอบ"
    assert "statusCreatedAt" not in created

    lot = get_lot("e1", "A01")
    assert lot["status"] == "HELD"
    assert lot["bookingId"] == created["bookingId"]
    assert lot["holdExpiresAt"] == created["expiresAt"]
    assert quota("s1") == 1

    schedule = boto3.client("scheduler").get_schedule(Name=scheduler.schedule_name(body["groupId"]))
    assert schedule["ScheduleExpression"].startswith("at(")
    assert notifications_of("o1")[0]["type"] == "booking_new"


def test_book_several_lots_together(setup):
    put_open_event()

    body = booked(["A01", "B01"])

    assert sorted(b["lotId"] for b in body["bookings"]) == ["A01", "B01"]
    assert {b["groupId"] for b in body["bookings"]} == {body["groupId"]}
    assert sorted(b["amount"] for b in body["bookings"]) == [300, 500]
    assert quota("s1") == 2


def test_all_or_nothing_when_one_lot_is_taken(setup):
    put_open_event()
    booked(["A01"], OTHER_SELLER)

    status, body = book(["A02", "A01"])

    assert status == 409
    assert body["error"]["code"] == "LOT_NOT_AVAILABLE"
    assert body["error"]["details"] == {"lotIds": ["A01"]}
    assert get_lot("e1", "A02")["status"] == "AVAILABLE"
    assert quota("s1") == 0


def test_same_lot_twice_second_is_conflict(setup):
    put_open_event()
    booked(["A01"])
    status, body = book(["A01"], OTHER_SELLER)
    assert status == 409
    assert body["error"]["code"] == "LOT_NOT_AVAILABLE"


def test_quota_counts_previous_bookings(setup):
    put_open_event(max_lots=2)
    booked(["A01"])

    status, body = book(["A02", "B01"])

    assert status == 409
    assert body["error"]["code"] == "QUOTA_EXCEEDED"
    assert get_lot("e1", "A02")["status"] == "AVAILABLE"
    assert quota("s1") == 1


def test_request_over_quota_is_rejected_up_front(setup):
    put_open_event(max_lots=1)
    status, body = book(["A01", "A02"])
    assert status == 409
    assert body["error"]["code"] == "QUOTA_EXCEEDED"


def test_unlimited_quota(setup):
    put_open_event(max_lots=None)
    assert len(booked(["A01", "A02", "B01"])["bookings"]) == 3


def test_unknown_and_disabled_lots(setup):
    put_open_event()
    db.table("lots").update_item(
        Key={"eventId": "e1", "lotId": "B01"},
        UpdateExpression="SET #s = :d",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":d": "DISABLED"},
    )

    status, body = book(["Z99"])
    assert status == 400
    assert body["error"]["code"] == "UNKNOWN_LOT"

    status, body = book(["B01"])
    assert status == 409
    assert body["error"]["details"] == {"lotIds": ["B01"]}


def test_booking_closed(setup):
    event = put_open_event()
    db.table("events").update_item(
        Key={"eventId": "e1"},
        UpdateExpression="SET bookingClosesAt = :past",
        ExpressionAttributeValues={":past": event["bookingOpensAt"]},
    )
    status, body = book(["A01"])
    assert status == 409
    assert body["error"]["code"] == "BOOKING_CLOSED"


def test_only_sellers_can_book(setup):
    put_open_event()
    assert book(["A01"], ORGANIZER)[0] == 403


# ---------- สลิป ----------


def test_one_slip_covers_the_whole_group(setup):
    put_open_event()
    body = booked(["A01", "B01"])
    first = body["bookings"][0]["bookingId"]

    upload = upload_slip(first)
    assert upload["key"].startswith(f"slips/e1/{body['groupId']}/")
    assert upload["fields"]["Content-Type"] == "image/png"

    status, result = call(
        lambda_handler, "POST", f"/bookings/{first}/slip", {"key": upload["key"]}, as_user=SELLER
    )

    assert status == 200, result
    assert {b["status"] for b in result["bookings"]} == {booking.PENDING_REVIEW}
    assert {b["slipKey"] for b in result["bookings"]} == {upload["key"]}
    assert "holdExpiresAt" not in get_lot("e1", "A01")
    assert get_lot("e1", "A01")["status"] == "HELD"
    with pytest.raises(boto3.client("scheduler").exceptions.ResourceNotFoundException):
        boto3.client("scheduler").get_schedule(Name=scheduler.schedule_name(body["groupId"]))
    assert notifications_of("o1")[-1]["type"] == "booking_slip_uploaded"


def test_slip_must_be_uploaded_and_belong_to_group(setup):
    put_open_event()
    booking_id = booked(["A01"])["bookings"][0]["bookingId"]
    path = f"/bookings/{booking_id}/slip"

    status, body = call(
        lambda_handler, "POST", path, {"key": "slips/e1/other/x.png"}, as_user=SELLER
    )
    assert status == 400
    assert body["error"]["code"] == "INVALID_SLIP_KEY"

    status, upload = call(
        lambda_handler,
        "POST",
        f"/bookings/{booking_id}/slip-url",
        {"contentType": "image/png"},
        as_user=SELLER,
    )
    status, body = call(lambda_handler, "POST", path, {"key": upload["key"]}, as_user=SELLER)
    assert status == 400
    assert body["error"]["code"] == "SLIP_NOT_UPLOADED"


def test_slip_url_rejects_other_file_types_and_other_sellers(setup):
    put_open_event()
    booking_id = booked(["A01"])["bookings"][0]["bookingId"]
    path = f"/bookings/{booking_id}/slip-url"
    assert (
        call(lambda_handler, "POST", path, {"contentType": "image/gif"}, as_user=SELLER)[0] == 400
    )
    assert (
        call(lambda_handler, "POST", path, {"contentType": "image/png"}, as_user=OTHER_SELLER)[0]
        == 403
    )


def test_view_slip(setup):
    put_open_event()
    booking_id = booked(["A01"])["bookings"][0]["bookingId"]
    path = f"/bookings/{booking_id}/slip"
    assert call(lambda_handler, "GET", path, as_user=SELLER)[0] == 404

    upload = upload_slip(booking_id)
    call(lambda_handler, "POST", path, {"key": upload["key"]}, as_user=SELLER)

    for viewer in (SELLER, ORGANIZER):
        status, body = call(lambda_handler, "GET", path, as_user=viewer)
        assert status == 200
        assert upload["key"] in body["url"]
    assert call(lambda_handler, "GET", path, as_user=OTHER_SELLER)[0] == 403


# ---------- หมดเวลา ----------


def test_expire_by_schedule(setup):
    put_open_event(slip_minutes=60)
    body = booked(["A01", "B01"])
    ids = [b["bookingId"] for b in body["bookings"]]

    assert expire_run({"bookingIds": ids}) == {"expired": []}  # ยังไม่ถึงเวลา

    setup.advance(minutes=61)
    assert sorted(expire_run({"bookingIds": ids})["expired"]) == sorted(ids)

    assert {booking_ops.get(i)["status"] for i in ids} == {booking.EXPIRED}
    assert get_lot("e1", "A01")["status"] == "AVAILABLE"
    assert "bookingId" not in get_lot("e1", "A01")
    assert quota("s1") == 0
    # หมดเวลาทั้งชุดใน transaction เดียว แจ้งเตือนครั้งเดียว (D7)
    [notice] = notifications_of("s1")
    assert notice["type"] == "booking_expired"
    assert notice["message"].startswith("การจองล็อก A01, B01 ใน")

    assert expire_run({"bookingIds": ids}) == {"expired": []}  # รันซ้ำไม่มีผล


def test_fallback_expires_whole_group_once(setup):
    put_open_event(slip_minutes=60)
    ids = [b["bookingId"] for b in booked(["A01", "A02"])["bookings"]]
    setup.advance(minutes=61)

    status, body = call(lambda_handler, "GET", "/bookings/me", as_user=SELLER)

    assert status == 200
    assert {b["status"] for b in body["items"]} == {booking.EXPIRED}
    assert {booking_ops.get(i)["status"] for i in ids} == {booking.EXPIRED}
    assert quota("s1") == 0
    assert len(notifications_of("s1")) == 1


def test_sweep_expires_group_once(setup):
    put_open_event(slip_minutes=60)
    ids = [b["bookingId"] for b in booked(["A01", "A02"])["bookings"]]
    setup.advance(minutes=61)
    assert sorted(expire_run({})["expired"]) == sorted(ids)
    assert len(notifications_of("s1")) == 1


def test_expire_does_nothing_after_slip(setup):
    put_open_event(slip_minutes=60)
    booking_id = booked(["A01"])["bookings"][0]["bookingId"]
    upload = upload_slip(booking_id)
    call(
        lambda_handler,
        "POST",
        f"/bookings/{booking_id}/slip",
        {"key": upload["key"]},
        as_user=SELLER,
    )

    setup.advance(minutes=61)

    assert expire_run({"bookingIds": [booking_id]}) == {"expired": []}
    assert booking_ops.get(booking_id)["status"] == booking.PENDING_REVIEW


def test_sweep_mode_without_booking_ids(setup):
    put_open_event(slip_minutes=60)
    booking_id = booked(["A01"])["bookings"][0]["bookingId"]
    setup.advance(minutes=61)
    assert expire_run({}) == {"expired": [booking_id]}


def test_slip_after_deadline_is_rejected(setup):
    put_open_event(slip_minutes=60)
    booking_id = booked(["A01"])["bookings"][0]["bookingId"]
    setup.advance(minutes=61)

    status, body = call(
        lambda_handler,
        "POST",
        f"/bookings/{booking_id}/slip-url",
        {"contentType": "image/png"},
        as_user=SELLER,
    )

    assert status == 409
    assert body["error"]["code"] == "BOOKING_EXPIRED"
    assert booking_ops.get(booking_id)["status"] == booking.EXPIRED


def test_fallback_frees_expired_lot_without_scheduler(setup):
    """schedule ไม่ทำงาน (ข้อ 7.6): ล็อกที่เลยเวลาต้องว่างทั้งตอนดูล็อกและตอนจอง"""
    put_open_event(slip_minutes=60)
    old = booked(["A01"])["bookings"][0]["bookingId"]
    setup.advance(minutes=61)

    status, body = call(events_handler, "GET", "/events/e1/lots")
    assert status == 200
    assert next(lot for lot in body["items"] if lot["lotId"] == "A01")["status"] == "AVAILABLE"
    assert booking_ops.get(old)["status"] == booking.EXPIRED


def test_booking_an_expired_hold_directly(setup):
    put_open_event(slip_minutes=60)
    old = booked(["A01"])["bookings"][0]["bookingId"]
    setup.advance(minutes=61)

    body = booked(["A01"], OTHER_SELLER)

    assert booking_ops.get(old)["status"] == booking.EXPIRED
    assert get_lot("e1", "A01")["bookingId"] == body["bookings"][0]["bookingId"]


def test_my_bookings_shows_expired(setup):
    put_open_event(slip_minutes=60)
    booked(["A01"])
    setup.advance(minutes=1)
    booked(["A02"])
    setup.advance(minutes=59.5)  # A01 เลยเวลาแล้ว A02 ยังเหลือ 30 วินาที

    status, body = call(lambda_handler, "GET", "/bookings/me", as_user=SELLER)

    assert status == 200
    assert [(b["lotId"], b["status"]) for b in body["items"]] == [
        ("A02", booking.PENDING_PAYMENT),
        ("A01", booking.EXPIRED),
    ]


# ---------- ยกเลิก ----------


def test_seller_cancels(setup):
    put_open_event()
    booking_id = booked(["A01"])["bookings"][0]["bookingId"]
    path = f"/bookings/{booking_id}/cancel"

    assert call(lambda_handler, "POST", path, as_user=OTHER_SELLER)[0] == 403
    status, body = call(lambda_handler, "POST", path, as_user=SELLER)

    assert status == 200
    assert [b["status"] for b in body["bookings"]] == [booking.CANCELLED]
    assert get_lot("e1", "A01")["status"] == "AVAILABLE"
    assert quota("s1") == 0
    assert notifications_of("o1")[-1]["type"] == "booking_cancelled"
    assert call(lambda_handler, "POST", path, as_user=SELLER)[0] == 409


def test_cannot_cancel_approved(setup):
    put_open_event()
    booking_id = booked(["A01"])["bookings"][0]["bookingId"]
    db.table("bookings").update_item(
        Key={"bookingId": booking_id},
        UpdateExpression="SET #s = :a",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":a": booking.APPROVED},
    )
    status, body = call(lambda_handler, "POST", f"/bookings/{booking_id}/cancel", as_user=SELLER)
    assert status == 409


def test_booking_keeps_shop_extras(setup):
    put_open_event()
    status, body = call(
        lambda_handler,
        "POST",
        "/bookings",
        {
            "eventId": "e1",
            "lotIds": ["A01", "A02"],
            "shopName": "ร้านขนม",
            "productDescription": "ขนมไทย",
            "category": "อาหาร",
            "staff": "2 คน",
            "power": True,
            "note": "ขอใกล้ปลั๊ก",
        },
        as_user=SELLER,
    )
    assert status == 201
    for created in body["bookings"]:
        stored = booking_ops.get(created["bookingId"])
        assert stored["category"] == "อาหาร"
        assert stored["staff"] == "2 คน"
        assert stored["power"] is True
        assert stored["note"] == "ขอใกล้ปลั๊ก"
        assert stored["productDescription"] == "ขนมไทย"
