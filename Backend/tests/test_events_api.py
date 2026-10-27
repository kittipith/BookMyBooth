import pytest

from domain import lots, users
from functions.events.app import lambda_handler
from helpers import call, claims, event_body, put_user
from shared import db

ORGANIZER = claims("o1", "Organizer")
OTHER_ORGANIZER = claims("o2", "Organizer")

LOTS = [
    {"lotId": "A01", "zoneId": "A"},
    {"lotId": "A02", "zoneId": "A", "size": "4x4"},
    {"lotId": "B01", "zoneId": "B"},
]


@pytest.fixture
def organizers(aws):
    put_user("o1", users.ORGANIZER, orgName="ตลาดนัดเช้า")
    put_user("o2", users.ORGANIZER)


def create(body=None):
    status, event = call(lambda_handler, "POST", "/events", body or event_body(), as_user=ORGANIZER)
    assert status == 201, event
    return event


def sync(event_id, lot_list, as_user=ORGANIZER):
    return call(
        lambda_handler, "PUT", f"/events/{event_id}/lots", {"lots": lot_list}, as_user=as_user
    )


def publish(event_id):
    return call(
        lambda_handler, "PUT", f"/events/{event_id}", {"publishStatus": "OPEN"}, as_user=ORGANIZER
    )


def published_event():
    event = create()
    sync(event["eventId"], LOTS)
    status, body = publish(event["eventId"])
    assert status == 200, body
    return body


def test_health():
    assert call(lambda_handler, "GET", "/health") == (200, {"status": "ok"})


def test_create_event_as_draft(organizers):
    event = create()

    assert event["publishStatus"] == "DRAFT"
    assert event["status"] == "DRAFT"
    assert event["organizerId"] == "o1"
    assert event["organizerName"] == "ตลาดนัดเช้า"
    assert event["maxLotsPerSeller"] == 1
    assert event["slipDeadlineMinutes"] == 1440
    assert event["bookingOpensAt"].endswith("Z")


def test_seller_cannot_create_event(organizers):
    put_user("s1", users.SELLER)
    status, _ = call(
        lambda_handler, "POST", "/events", event_body(), as_user=claims("s1", "Seller")
    )
    assert status == 403


@pytest.mark.parametrize(
    "overrides",
    [
        {"bookingClosesAt": "2020-01-01T00:00:00+00:00"},  # ปิดก่อนเปิด
        {"zones": []},
        {"type": "คอนเสิร์ต"},
        {"layout": ["A"]},  # ไม่เท่ากับ cols × rows
        {"bookingOpensAt": "2026-11-01T00:00:00"},  # ไม่มี timezone
    ],
)
def test_invalid_event(organizers, overrides):
    status, body = call(
        lambda_handler, "POST", "/events", event_body(**overrides), as_user=ORGANIZER
    )
    assert status == 400
    assert body["error"]["code"] == "VALIDATION_ERROR"


def test_draft_is_hidden_from_public(organizers):
    event = create()
    assert call(lambda_handler, "GET", f"/events/{event['eventId']}")[0] == 404
    assert call(lambda_handler, "GET", f"/events/{event['eventId']}/lots")[0] == 404
    assert call(lambda_handler, "GET", "/events")[1] == {"items": []}


def test_organizer_lists_own_events(organizers):
    first = create()
    second = create(event_body(title="งานที่สอง"))
    call(lambda_handler, "POST", "/events", event_body(), as_user=OTHER_ORGANIZER)

    status, body = call(lambda_handler, "GET", "/organizer/events", as_user=ORGANIZER)

    assert status == 200
    assert [e["eventId"] for e in body["items"]] == [second["eventId"], first["eventId"]]
    assert "layout" in body["items"][0]


def test_sync_lots(organizers):
    event = create()

    status, body = sync(event["eventId"], LOTS)

    assert status == 200
    assert body["items"] == [
        {"lotId": "A01", "zoneId": "A", "size": "3x3", "price": 500, "status": "AVAILABLE"},
        {"lotId": "A02", "zoneId": "A", "size": "4x4", "price": 500, "status": "AVAILABLE"},
        {"lotId": "B01", "zoneId": "B", "size": "2x2", "price": 300, "status": "AVAILABLE"},
    ]

    status, body = sync(
        event["eventId"], [{"lotId": "A01", "zoneId": "A", "disabled": True}, LOTS[2]]
    )
    assert status == 200
    assert [(lot["lotId"], lot["status"]) for lot in body["items"]] == [
        ("A01", "DISABLED"),
        ("B01", "AVAILABLE"),
    ]


def test_sync_rejects_unknown_zone_and_duplicates(organizers):
    event = create()
    status, body = sync(event["eventId"], [{"lotId": "Z01", "zoneId": "Z"}])
    assert status == 400
    assert body["error"]["details"] == {"zoneIds": ["Z"]}

    status, _ = sync(event["eventId"], [LOTS[0], LOTS[0]])
    assert status == 400


def test_sync_cannot_touch_lot_in_use(organizers):
    event = create()
    sync(event["eventId"], LOTS)
    db.table("lots").update_item(
        Key={"eventId": event["eventId"], "lotId": "A01"},
        UpdateExpression="SET #s = :held, bookingId = :b",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":held": lots.HELD, ":b": "booking-1"},
    )

    status, body = sync(event["eventId"], LOTS[1:])

    assert status == 409
    assert body["error"] == {
        "code": "LOT_IN_USE",
        "message": "ล็อกที่มีผู้จองอยู่แก้ไขหรือลบไม่ได้",
        "details": {"lotIds": ["A01"]},
    }
    assert len(sync(event["eventId"], LOTS)[1]["items"]) == 3


def test_other_organizer_cannot_edit(organizers):
    event = create()
    assert sync(event["eventId"], LOTS, as_user=OTHER_ORGANIZER)[0] == 403
    status, _ = call(
        lambda_handler,
        "PUT",
        f"/events/{event['eventId']}",
        {"title": "x"},
        as_user=OTHER_ORGANIZER,
    )
    assert status == 403


def test_publish_requires_lots(organizers):
    event = create()
    status, body = publish(event["eventId"])
    assert status == 409
    assert body["error"]["code"] == "NO_LOTS"


def test_published_event_is_public(organizers):
    event = published_event()
    assert event["publishStatus"] == "OPEN"
    assert event["status"] == "OPEN"

    status, body = call(lambda_handler, "GET", "/events")
    assert status == 200
    [listed] = body["items"]
    assert listed["eventId"] == event["eventId"]
    assert "payment" not in listed
    assert "layout" not in listed

    status, detail = call(lambda_handler, "GET", f"/events/{event['eventId']}")
    assert status == 200
    assert detail["payment"]["accountNo"] == "123-4-56789-0"

    status, body = call(lambda_handler, "GET", f"/events/{event['eventId']}/lots")
    assert status == 200
    assert len(body["items"]) == 3


def test_partial_update_keeps_other_fields(organizers):
    event = create()
    path = f"/events/{event['eventId']}"

    status, body = call(lambda_handler, "PUT", path, {"maxLotsPerSeller": None}, as_user=ORGANIZER)
    assert status == 200
    assert body["maxLotsPerSeller"] is None

    status, body = call(lambda_handler, "PUT", path, {"title": "ชื่อใหม่"}, as_user=ORGANIZER)
    assert status == 200
    assert body["title"] == "ชื่อใหม่"
    assert body["venue"] == "ลานหน้าตึก"
    assert body["maxLotsPerSeller"] is None


def test_cannot_remove_zone_with_lots(organizers):
    event = create()
    sync(event["eventId"], LOTS)
    zones = event_body()["zones"][:1]

    status, body = call(
        lambda_handler, "PUT", f"/events/{event['eventId']}", {"zones": zones}, as_user=ORGANIZER
    )

    assert status == 409
    assert body["error"]["details"] == {"zoneIds": ["B"]}


def test_unknown_field_is_rejected(organizers):
    event = create()
    status, _ = call(
        lambda_handler,
        "PUT",
        f"/events/{event['eventId']}",
        {"organizerId": "o2"},
        as_user=ORGANIZER,
    )
    assert status == 400


def test_close_event(organizers):
    event = published_event()
    path = f"/events/{event['eventId']}"

    status, body = call(lambda_handler, "POST", f"{path}/close", as_user=ORGANIZER)
    assert status == 200
    assert body["publishStatus"] == "CLOSED"

    assert call(lambda_handler, "POST", f"{path}/close", as_user=ORGANIZER)[0] == 409
    status, body = call(lambda_handler, "PUT", path, {"title": "x"}, as_user=ORGANIZER)
    assert status == 409
    assert body["error"]["code"] == "EVENT_CLOSED"
    assert call(lambda_handler, "GET", "/events", query={"status": "CLOSED"})[1]["items"]


def test_list_rejects_draft_status(aws):
    status, _ = call(lambda_handler, "GET", "/events", query={"status": "DRAFT"})
    assert status == 400


def test_summary(organizers):
    event = published_event()
    event_id = event["eventId"]
    db.table("lots").update_item(
        Key={"eventId": event_id, "lotId": "A01"},
        UpdateExpression="SET #s = :booked",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":booked": lots.BOOKED},
    )
    bookings = db.table("bookings")
    for booking_id, status, amount in [("b1", "APPROVED", 500), ("b2", "PENDING_REVIEW", 300)]:
        bookings.put_item(
            Item={
                "bookingId": booking_id,
                "eventId": event_id,
                "status": status,
                "statusCreatedAt": f"{status}#2026-11-01",
                "amount": amount,
            }
        )

    status, body = call(lambda_handler, "GET", f"/events/{event_id}/summary", as_user=ORGANIZER)

    assert status == 200
    assert body["lots"] == {"total": 3, "AVAILABLE": 2, "HELD": 0, "BOOKED": 1, "DISABLED": 0}
    assert body["bookings"] == {"APPROVED": 1, "PENDING_REVIEW": 1}
    assert body["revenue"] == 500
