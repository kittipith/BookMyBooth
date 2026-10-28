"""ผู้จัดงานตรวจการจอง: ดูรายการ อนุมัติ ย้ายล็อก ปฏิเสธ ยกเลิกหลังอนุมัติ (PLAN 7.3, 7.4)"""

import boto3
import pytest

from domain import booking, users
from functions.bookings.app import lambda_handler
from functions.events.app import lambda_handler as events_handler
from helpers import call, claims, get_lot, notifications_of, put_open_event, put_user
from shared import booking_ops, db, s3

SELLER = claims("s1", "Seller")
OTHER_SELLER = claims("s2", "Seller")
ORGANIZER = claims("o1", "Organizer")
OTHER_ORGANIZER = claims("o2", "Organizer")


@pytest.fixture
def setup(aws, frozen_clock):
    put_user("o1", users.ORGANIZER)
    put_user("o2", users.ORGANIZER)
    put_user("s1", users.SELLER)
    put_user("s2", users.SELLER)
    put_open_event(max_lots=None)
    return frozen_clock


def book(lot_ids, as_user=SELLER):
    status, body = call(
        lambda_handler,
        "POST",
        "/bookings",
        {"eventId": "e1", "lotIds": lot_ids, "shopName": "ร้านขนม"},
        as_user=as_user,
    )
    assert status == 201, body
    return body["bookings"]


def book_with_slip(lot_id, as_user=SELLER) -> str:
    """จองแล้วแนบสลิป ได้ booking ที่ PENDING_REVIEW"""
    return book_group_with_slip([lot_id], as_user)[0]


def book_group_with_slip(lot_ids, as_user=SELLER) -> list[str]:
    """จองหลายล็อกในชุดเดียวแล้วแนบสลิปเดียว คืน bookingId ตามลำดับ lot_ids"""
    booking_ids = [b["bookingId"] for b in book(lot_ids, as_user)]
    booking_id = booking_ids[0]
    _, upload = call(
        lambda_handler,
        "POST",
        f"/bookings/{booking_id}/slip-url",
        {"contentType": "image/jpeg"},
        as_user=as_user,
    )
    boto3.client("s3").put_object(Bucket=s3.bucket(), Key=upload["key"], Body=b"jpg")
    status, _ = call(
        lambda_handler,
        "POST",
        f"/bookings/{booking_id}/slip",
        {"key": upload["key"]},
        as_user=as_user,
    )
    assert status == 200
    return booking_ids


def one(body):
    """ผลของชุดที่มีล็อกเดียว"""
    [item] = body["bookings"]
    return item


def approve(booking_id, body=None, as_user=ORGANIZER):
    return call(lambda_handler, "POST", f"/bookings/{booking_id}/approve", body, as_user=as_user)


def quota(seller_id):
    item = get_lot("e1", f"QUOTA#{seller_id}")
    return int(item["count"]) if item else 0


def last_notice(user_id):
    return sorted(notifications_of(user_id), key=lambda n: n["sk"])[-1]


# ---------- รายการ ----------


def test_list_event_bookings(setup):
    reviewed = book_with_slip("A01")
    setup.advance(seconds=1)
    waiting = book(["A02"], OTHER_SELLER)[0]["bookingId"]

    status, body = call(lambda_handler, "GET", "/events/e1/bookings", as_user=ORGANIZER)
    assert status == 200
    assert [b["bookingId"] for b in body["items"]] == [waiting, reviewed]

    status, body = call(
        lambda_handler,
        "GET",
        "/events/e1/bookings",
        as_user=ORGANIZER,
        query={"status": "pending_review"},
    )
    assert [b["bookingId"] for b in body["items"]] == [reviewed]


def test_list_marks_expired(setup):
    booking_id = book(["A01"])[0]["bookingId"]
    setup.advance(minutes=61)

    _, body = call(
        lambda_handler,
        "GET",
        "/events/e1/bookings",
        as_user=ORGANIZER,
        query={"status": "PENDING_PAYMENT"},
    )
    assert body["items"] == []
    assert booking_ops.get(booking_id)["status"] == booking.EXPIRED


def test_list_permissions(setup):
    path = "/events/e1/bookings"
    assert call(lambda_handler, "GET", path, as_user=OTHER_ORGANIZER)[0] == 403
    assert call(lambda_handler, "GET", path, as_user=SELLER)[0] == 403
    assert call(lambda_handler, "GET", path, as_user=ORGANIZER, query={"status": "X"})[0] == 400
    assert call(lambda_handler, "GET", "/events/nope/bookings", as_user=ORGANIZER)[0] == 404


# ---------- อนุมัติ ----------


def test_approve(setup):
    booking_id = book_with_slip("A01")

    status, body = approve(booking_id)

    assert status == 200
    body = one(body)
    assert body["status"] == booking.APPROVED
    assert body["decidedBy"] == "o1"
    assert get_lot("e1", "A01")["status"] == "BOOKED"
    assert get_lot("e1", "A01")["bookingId"] == booking_id
    notice = last_notice("s1")
    assert notice["type"] == "booking_approved"
    assert notice["bookingId"] == booking_id

    assert approve(booking_id)[0] == 409


def test_cannot_approve_before_slip(setup):
    booking_id = book(["A01"])[0]["bookingId"]
    status, body = approve(booking_id)
    assert status == 409
    assert body["error"]["code"] == "INVALID_STATUS"


def test_approve_permissions(setup):
    booking_id = book_with_slip("A01")
    assert approve(booking_id, as_user=OTHER_ORGANIZER)[0] == 403
    assert approve(booking_id, as_user=SELLER)[0] == 403
    assert approve("missing")[0] == 404


def test_approve_with_move(setup):
    booking_id = book_with_slip("A01")

    status, body = approve(booking_id, {"moves": {"A01": "B01"}})

    assert status == 200
    body = one(body)
    assert body["status"] == booking.APPROVED
    assert body["lotId"] == "B01"
    assert body["amount"] == 500  # ราคาเดิมที่ผู้ขายโอนมา ไม่คิดส่วนต่าง
    [move] = body["moves"]
    assert (move["from"], move["to"], move["by"]) == ("A01", "B01", "o1")

    old, new = get_lot("e1", "A01"), get_lot("e1", "B01")
    assert old["status"] == "AVAILABLE"
    assert "bookingId" not in old
    assert new["status"] == "BOOKED"
    assert new["bookingId"] == booking_id
    assert quota("s1") == 1
    assert last_notice("s1")["type"] == "booking_moved"

    _, lots_body = call(events_handler, "GET", "/events/e1/lots")
    assert {lot["lotId"]: lot["status"] for lot in lots_body["items"]} == {
        "A01": "AVAILABLE",
        "A02": "AVAILABLE",
        "B01": "BOOKED",
    }


def test_move_to_same_lot_is_plain_approve(setup):
    booking_id = book_with_slip("A01")
    status, body = approve(booking_id, {"moves": {"A01": "A01"}})
    assert status == 200
    assert one(body)["moves"] == []
    assert last_notice("s1")["type"] == "booking_approved"


def test_move_to_taken_or_unknown_lot(setup):
    booking_id = book_with_slip("A01")
    book(["B01"], OTHER_SELLER)

    status, body = approve(booking_id, {"moves": {"A01": "B01"}})
    assert status == 409
    assert body["error"] == {
        "code": "LOT_NOT_AVAILABLE",
        "message": "ล็อกปลายทางไม่ว่าง",
        "details": {"lotIds": ["B01"]},
    }
    assert booking_ops.get(booking_id)["status"] == booking.PENDING_REVIEW
    assert get_lot("e1", "A01")["status"] == "HELD"

    status, body = approve(booking_id, {"moves": {"A01": "Z99"}})
    assert status == 400
    assert body["error"]["code"] == "UNKNOWN_LOT"

    status, body = approve(booking_id, {"moves": {"A02": "B01"}})  # ล็อกที่ไม่อยู่ในชุด
    assert status == 400
    assert body["error"]["code"] == "UNKNOWN_LOT"


def test_move_to_lot_whose_hold_expired(setup):
    booking_id = book_with_slip("A01")
    book(["B01"], OTHER_SELLER)  # ถือไว้แต่ไม่แนบสลิป
    setup.advance(minutes=61)

    status, body = approve(booking_id, {"moves": {"A01": "B01"}})

    assert status == 200
    assert one(body)["lotId"] == "B01"


def test_approved_counts_in_summary(setup):
    approve(book_with_slip("A01"))
    status, body = call(events_handler, "GET", "/events/e1/summary", as_user=ORGANIZER)
    assert status == 200
    assert body["revenue"] == 500
    assert body["lots"]["BOOKED"] == 1


# ---------- ปฏิเสธ ----------


def test_reject(setup):
    booking_id = book_with_slip("A01")
    path = f"/bookings/{booking_id}/reject"

    status, body = call(lambda_handler, "POST", path, {}, as_user=ORGANIZER)
    assert status == 400

    status, body = call(lambda_handler, "POST", path, {"reason": "ยอดเงินไม่ตรง"}, as_user=ORGANIZER)

    assert status == 200
    body = one(body)
    assert body["status"] == booking.REJECTED
    assert body["reason"] == "ยอดเงินไม่ตรง"
    assert body["decidedBy"] == "o1"
    assert get_lot("e1", "A01")["status"] == "AVAILABLE"
    assert quota("s1") == 0
    notice = last_notice("s1")
    assert notice["type"] == "booking_rejected"
    assert notice["message"].endswith(": ยอดเงินไม่ตรง")

    assert call(lambda_handler, "POST", path, {"reason": "x"}, as_user=ORGANIZER)[0] == 409


def test_cannot_reject_approved(setup):
    booking_id = book_with_slip("A01")
    approve(booking_id)
    status, _ = call(
        lambda_handler, "POST", f"/bookings/{booking_id}/reject", {"reason": "x"}, as_user=ORGANIZER
    )
    assert status == 409


# ---------- ยกเลิกหลังอนุมัติ ----------


def test_organizer_cancels_approved(setup):
    booking_id = book_with_slip("A01")
    approve(booking_id)
    path = f"/bookings/{booking_id}/cancel"

    assert call(lambda_handler, "POST", path, {}, as_user=ORGANIZER)[0] == 400
    assert call(lambda_handler, "POST", path, {"reason": "x"}, as_user=OTHER_ORGANIZER)[0] == 403

    status, body = call(lambda_handler, "POST", path, {"reason": "ร้านไม่มาตามนัด"}, as_user=ORGANIZER)

    assert status == 200
    body = one(body)
    assert body["status"] == booking.CANCELLED
    assert body["reason"] == "ร้านไม่มาตามนัด"
    assert get_lot("e1", "A01")["status"] == "AVAILABLE"
    assert quota("s1") == 0
    notice = last_notice("s1")
    assert notice["type"] == "booking_cancelled"
    assert notice["message"] == "ผู้จัดงานยกเลิกการจองล็อก A01 ในตลาดนัดทดสอบ: ร้านไม่มาตามนัด"


def test_organizer_cannot_cancel_before_approval(setup):
    booking_id = book_with_slip("A01")
    status, body = call(
        lambda_handler, "POST", f"/bookings/{booking_id}/cancel", {"reason": "x"}, as_user=ORGANIZER
    )
    assert status == 409
    assert body["error"]["code"] == "INVALID_STATUS"


def test_seller_cannot_cancel_after_approval(setup):
    booking_id = book_with_slip("A01")
    approve(booking_id)
    status, _ = call(lambda_handler, "POST", f"/bookings/{booking_id}/cancel", as_user=SELLER)
    assert status == 409


# ---------- เช็กอิน (D5b) ----------


def test_check_in_on_event_day(setup):
    booking_id = book_with_slip("A01")
    approve(booking_id)
    path = f"/bookings/{booking_id}/check-in"

    status, body = call(lambda_handler, "POST", path, as_user=ORGANIZER)
    assert status == 409
    assert body["error"]["code"] == "NOT_EVENT_DAY"

    setup.advance(days=10)  # วันงาน (startDate = วันนี้ + 10)
    assert call(lambda_handler, "POST", path, as_user=OTHER_ORGANIZER)[0] == 403
    status, body = call(lambda_handler, "POST", path, as_user=ORGANIZER)
    assert status == 200
    body = one(body)
    assert body["checkedIn"] is True
    assert body["checkedInBy"] == "o1"

    first_time = body["checkedInAt"]
    setup.advance(minutes=5)
    status, body = call(lambda_handler, "POST", path, as_user=ORGANIZER)
    assert status == 200
    assert one(body)["checkedInAt"] == first_time


def test_check_in_requires_approval(setup):
    booking_id = book_with_slip("A01")
    setup.advance(days=10)
    status, _ = call(lambda_handler, "POST", f"/bookings/{booking_id}/check-in", as_user=ORGANIZER)
    assert status == 409


# ---------- สถิติร้าน (D5e) ----------


def _past_booking(booking_id, seller_id, checked_in):
    db.table("bookings").put_item(
        Item={
            "bookingId": booking_id,
            "eventId": "past",
            "organizerId": "o1",
            "sellerId": seller_id,
            "lotId": "A01",
            "status": booking.APPROVED,
            "statusCreatedAt": f"APPROVED#2026-01-01T00:00:0{booking_id[-1]}",
            "amount": 200,
            "checkedIn": checked_in,
            "createdAt": "2026-01-01T00:00:00.000Z",
        }
    )


def test_vendor_stats(setup):
    db.table("events").put_item(
        Item={
            "eventId": "past",
            "title": "งานที่จบแล้ว",
            "organizerId": "o1",
            "publishStatus": "CLOSED",
            "startDate": "2026-01-10",
            "endDate": "2026-01-11",
            "bookingOpensAt": "2026-01-01T00:00:00.000Z",
            "bookingClosesAt": "2026-01-09T00:00:00.000Z",
            "createdAt": "2026-01-01T00:00:00.000Z",
        }
    )
    _past_booking("p1", "s1", True)
    _past_booking("p2", "s2", False)
    _past_booking("p3", "s2", False)
    approve(book_with_slip("A01"))  # s1 งานปัจจุบัน 500 บาท ยังไม่จบ

    status, body = call(lambda_handler, "GET", "/organizer/vendors", as_user=ORGANIZER)

    assert status == 200
    stats = {item["shop"]["userId"]: item for item in body["items"]}
    s1 = stats["s1"]
    assert (s1["approved"], s1["total"], s1["pastCount"], s1["showRate"]) == (2, 700, 1, 100)
    assert s1["flagged"] is False
    assert stats["s2"]["showRate"] == 0
    assert stats["s2"]["flagged"] is True
    assert "roleStatus" not in s1["shop"]

    status, body = call(lambda_handler, "GET", "/organizer/vendors", as_user=OTHER_ORGANIZER)
    assert body == {"items": []}


# ---------- ทั้งชุด (D7) ----------


def test_approve_group_with_partial_move(setup):
    _, a02 = book_group_with_slip(["A01", "A02"])

    status, body = approve(a02, {"moves": {"A02": "B01"}})  # เรียกผ่าน booking ใดก็ได้ในชุด

    assert status == 200
    assert {b["lotId"] for b in body["bookings"]} == {"A01", "B01"}
    assert {b["status"] for b in body["bookings"]} == {booking.APPROVED}
    assert get_lot("e1", "A01")["status"] == "BOOKED"
    assert get_lot("e1", "A02")["status"] == "AVAILABLE"
    assert get_lot("e1", "B01")["bookingId"] == a02
    assert quota("s1") == 2
    assert last_notice("s1")["message"] == (
        "ผู้จัดงานย้ายการจองของคุณจากล็อก A02 ไปล็อก B01 ในตลาดนัดทดสอบ และอนุมัติแล้ว"
    )


def test_approve_group_notifies_once(setup):
    a01, _ = book_group_with_slip(["A01", "A02"])
    assert approve(a01)[0] == 200
    approved = [n["message"] for n in notifications_of("s1") if n["type"] == "booking_approved"]
    assert approved == ["การจองล็อก A01, A02 ในตลาดนัดทดสอบ ได้รับอนุมัติแล้ว"]


def test_move_two_lots_to_same_target(setup):
    a01, _ = book_group_with_slip(["A01", "A02"])
    status, body = approve(a01, {"moves": {"A01": "B01", "A02": "B01"}})
    assert status == 400
    assert body["error"]["code"] == "DUPLICATE_LOT"


def test_reject_group_releases_all(setup):
    a01, _ = book_group_with_slip(["A01", "A02"])
    status, body = call(
        lambda_handler,
        "POST",
        f"/bookings/{a01}/reject",
        {"reason": "สลิปไม่ถูกต้อง"},
        as_user=ORGANIZER,
    )
    assert status == 200
    assert {b["status"] for b in body["bookings"]} == {booking.REJECTED}
    assert get_lot("e1", "A01")["status"] == get_lot("e1", "A02")["status"] == "AVAILABLE"
    assert quota("s1") == 0
    assert last_notice("s1")["message"] == (
        "คำขอจองล็อก A01, A02 ในตลาดนัดทดสอบ ไม่ได้รับอนุมัติ: สลิปไม่ถูกต้อง"
    )


def test_seller_cancels_whole_group(setup):
    a01, a02 = [b["bookingId"] for b in book(["A01", "A02"])]
    status, body = call(lambda_handler, "POST", f"/bookings/{a02}/cancel", as_user=SELLER)
    assert status == 200
    assert {b["status"] for b in body["bookings"]} == {booking.CANCELLED}
    assert booking_ops.get(a01)["status"] == booking.CANCELLED
    assert quota("s1") == 0
    assert last_notice("o1")["message"] == "ร้านขนม ยกเลิกคำขอจองล็อก A01, A02 ในตลาดนัดทดสอบ"


def test_organizer_cancels_whole_group(setup):
    a01, a02 = book_group_with_slip(["A01", "A02"])
    approve(a01)
    status, body = call(
        lambda_handler, "POST", f"/bookings/{a02}/cancel", {"reason": "ปรับผัง"}, as_user=ORGANIZER
    )
    assert status == 200
    assert {b["status"] for b in body["bookings"]} == {booking.CANCELLED}
    assert quota("s1") == 0


def test_check_in_whole_group(setup):
    a01, a02 = book_group_with_slip(["A01", "A02"])
    approve(a01)
    setup.advance(days=10)
    status, body = call(lambda_handler, "POST", f"/bookings/{a02}/check-in", as_user=ORGANIZER)
    assert status == 200
    assert [b["checkedIn"] for b in body["bookings"]] == [True, True]


def test_group_ignores_finished_members(setup):
    """ชุดเก่าที่บางล็อกจบไปแล้ว (ก่อน D7) ทำได้กับล็อกที่เหลือ แต่เรียกผ่านล็อกที่จบแล้วไม่ได้"""
    a01, a02 = book_group_with_slip(["A01", "A02"])
    assert booking_ops.run(
        booking.release_items(
            booking_ops.tables(),
            [booking_ops.get(a01)],
            to_status=booking.REJECTED,
            from_statuses=(booking.PENDING_REVIEW,),
            now="2026-01-01T00:00:00.000Z",
        )
    )
    assert approve(a01)[0] == 409
    status, body = approve(a02)
    assert status == 200
    assert [b["lotId"] for b in body["bookings"]] == ["A02"]


def test_vendor_stats_count_group_once(setup):
    approve(book_group_with_slip(["A01", "A02"])[0])
    _, body = call(lambda_handler, "GET", "/organizer/vendors", as_user=ORGANIZER)
    [s1] = body["items"]
    assert (s1["approved"], s1["total"]) == (1, 1000)
