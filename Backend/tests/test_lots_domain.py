from domain import lots

NOW = "2026-11-01T00:00:00.000Z"


def lot(lot_id, zone, status=lots.AVAILABLE, **extra):
    return {"eventId": "e1", "lotId": lot_id, "zoneId": zone, "status": status,
            "createdAt": "old", **extra}  # fmt: skip


def test_lot_codes_count_per_zone_like_frontend():
    layout = ["walk", "A", "A", "stage", "B", "", "A", "gate"]
    assert lots.lot_codes(layout) == [None, "A01", "A02", None, "B01", None, "A03", None]


def test_lots_from_layout_with_size_and_disabled():
    result = lots.lots_from_layout(["A", "walk", "A"], {"2": "4x4"}, [0])
    assert result == [
        {"lotId": "A01", "zoneId": "A", "disabled": True},
        {"lotId": "A02", "zoneId": "A", "disabled": False, "size": "4x4"},
    ]


def test_plan_creates_updates_and_deletes():
    existing = {"A01": lot("A01", "A"), "A02": lot("A02", "A"), "B01": lot("B01", "B")}
    desired = [
        {"lotId": "A01", "zoneId": "A"},  # ไม่เปลี่ยน
        {"lotId": "A02", "zoneId": "A", "disabled": True},  # ปิดล็อก
        {"lotId": "C01", "zoneId": "C"},  # ใหม่
    ]

    plan = lots.plan_sync("e1", existing, desired, NOW)

    assert {item["lotId"] for item in plan.puts} == {"A02", "C01"}
    assert plan.new_ids == {"C01"}
    assert plan.deletes == ["B01"]
    assert plan.blocked == []
    updated = next(item for item in plan.puts if item["lotId"] == "A02")
    assert updated["status"] == lots.DISABLED
    assert updated["createdAt"] == "old"


def test_plan_blocks_changes_to_lots_in_use():
    existing = {
        "A01": lot("A01", "A", lots.HELD),
        "A02": lot("A02", "A", lots.BOOKED),
        "A03": lot("A03", "A", lots.BOOKED),
        "A04": lot("A04", "A", lots.HELD),
    }
    desired = [
        {"lotId": "A01", "zoneId": "B"},  # ย้ายโซน
        {"lotId": "A02", "zoneId": "A", "disabled": True},  # ปิด
        {"lotId": "A03", "zoneId": "A"},  # ไม่เปลี่ยน ผ่านได้
        # A04 ถูกลบ
    ]

    plan = lots.plan_sync("e1", existing, desired, NOW)

    assert plan.blocked == ["A01", "A02", "A04"]
    assert not plan.has_changes


def test_lot_view_uses_zone_price_and_hides_booking():
    zones = {"A": {"id": "A", "size": "3x3", "price": 500}}
    view = lots.lot_view(lot("A01", "A", lots.HELD, bookingId="b1"), zones)
    assert view == {"lotId": "A01", "zoneId": "A", "size": "3x3", "price": 500, "status": "HELD"}
    assert lots.lot_view(lot("A02", "A", size="5x5"), zones)["size"] == "5x5"
