from datetime import UTC, datetime

import pytest

from domain import events

EVENT = {
    "publishStatus": events.OPEN,
    "startDate": "2026-11-20",
    "endDate": "2026-11-21",
    "bookingOpensAt": "2026-11-01T00:00:00.000Z",
    "bookingClosesAt": "2026-11-15T00:00:00.000Z",
}


@pytest.mark.parametrize(
    ("publish_status", "now", "expected"),
    [
        (events.DRAFT, datetime(2026, 11, 5, tzinfo=UTC), events.DRAFT),
        (events.OPEN, datetime(2026, 10, 30, tzinfo=UTC), events.SCHEDULED),
        (events.OPEN, datetime(2026, 11, 5, tzinfo=UTC), events.OPEN),
        (events.OPEN, datetime(2026, 11, 16, tzinfo=UTC), events.CLOSED),
        (events.CLOSED, datetime(2026, 11, 5, tzinfo=UTC), events.CLOSED),
        # 21 พ.ย. 17:00 UTC = 22 พ.ย. 00:00 เวลาไทย เลยวันสุดท้ายแล้ว
        (events.OPEN, datetime(2026, 11, 21, 17, 0, tzinfo=UTC), events.ENDED),
        (events.OPEN, datetime(2026, 11, 21, 16, 59, tzinfo=UTC), events.CLOSED),
    ],
)
def test_display_status(publish_status, now, expected):
    assert events.display_status({**EVENT, "publishStatus": publish_status}, now) == expected


def test_is_booking_open():
    assert events.is_booking_open(EVENT, datetime(2026, 11, 5, tzinfo=UTC))
    assert not events.is_booking_open(EVENT, datetime(2026, 11, 15, tzinfo=UTC))


def test_list_view_hides_payment_and_layout():
    view = events.list_view({**EVENT, "payment": {}, "layout": [], "title": "x"}, datetime.now(UTC))
    assert "payment" not in view
    assert "layout" not in view
    assert view["title"] == "x"
