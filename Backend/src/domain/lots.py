"""ล็อกในตาราง Lots (PLAN หัวข้อ 4.3)

ผู้จัดงานวาดผังกริดใน frontend แล้วส่งรายการล็อกทั้งหมดมาที่ PUT /events/{id}/lots
backend เทียบกับของเดิมแล้วสร้าง/แก้/ลบให้ตรงกัน ล็อกที่มีคนจองอยู่ (HELD/BOOKED) ห้ามแก้หรือลบ
"""

from dataclasses import dataclass, field
from typing import Any

AVAILABLE = "AVAILABLE"
HELD = "HELD"
BOOKED = "BOOKED"
DISABLED = "DISABLED"
STATUSES = (AVAILABLE, HELD, BOOKED, DISABLED)
IN_USE = frozenset({HELD, BOOKED})

# item นับโควตาต่อผู้ขายอยู่ partition เดียวกับล็อก (SK = QUOTA#<sellerId>)
QUOTA_PREFIX = "QUOTA#"

# ช่องในผังกริดที่ไม่ใช่ล็อก (ตรงกับ Frontend/src/utils/layout.ts)
NON_LOT_CELLS = frozenset({"", "walk", "stage", "gate"})


def is_lot(item: dict[str, Any]) -> bool:
    return not item["lotId"].startswith(QUOTA_PREFIX)


def lot_codes(layout: list[str]) -> list[str | None]:
    """รหัสล็อกจากผังกริด เช่น A01, A02 นับแยกตามโซนตามลำดับช่อง (เหมือน lotCodes ใน frontend)"""
    counters: dict[str, int] = {}
    codes: list[str | None] = []
    for cell in layout:
        if cell in NON_LOT_CELLS:
            codes.append(None)
            continue
        counters[cell] = counters.get(cell, 0) + 1
        codes.append(f"{cell}{counters[cell]:02d}")
    return codes


def lots_from_layout(
    layout: list[str], lot_sizes: dict[str, str] | None = None, disabled_cells: list[int] = ()
) -> list[dict[str, Any]]:
    """รายการล็อกแบบเดียวกับที่ frontend ส่งมา PUT /events/{id}/lots (ใช้ใน seed และเทสต์)"""
    lot_sizes = lot_sizes or {}
    disabled = set(disabled_cells)
    lots = []
    for index, (cell, code) in enumerate(zip(layout, lot_codes(layout), strict=True)):
        if code is None:
            continue
        lot: dict[str, Any] = {"lotId": code, "zoneId": cell, "disabled": index in disabled}
        if str(index) in lot_sizes:
            lot["size"] = lot_sizes[str(index)]
        lots.append(lot)
    return lots


@dataclass
class SyncPlan:
    puts: list[dict[str, Any]] = field(default_factory=list)
    new_ids: set[str] = field(default_factory=set)
    deletes: list[str] = field(default_factory=list)
    blocked: list[str] = field(default_factory=list)

    @property
    def has_changes(self) -> bool:
        return bool(self.puts or self.deletes)


def plan_sync(
    event_id: str,
    existing: dict[str, dict[str, Any]],
    desired: list[dict[str, Any]],
    timestamp: str,
) -> SyncPlan:
    """เทียบล็อกที่มีกับที่ต้องการ desired: [{lotId, zoneId, size?, disabled}]"""
    plan = SyncPlan()
    for lot in desired:
        lot_id = lot["lotId"]
        status = DISABLED if lot.get("disabled") else AVAILABLE
        current = existing.get(lot_id)
        item = {
            "eventId": event_id,
            "lotId": lot_id,
            "zoneId": lot["zoneId"],
            "status": status,
            "createdAt": current["createdAt"] if current else timestamp,
            "updatedAt": timestamp,
        }
        if lot.get("size"):
            item["size"] = lot["size"]

        if current is None:
            plan.puts.append(item)
            plan.new_ids.add(lot_id)
            continue
        changed = current.get("zoneId") != item["zoneId"] or current.get("size") != item.get("size")
        if current["status"] in IN_USE:
            if changed or status == DISABLED:
                plan.blocked.append(lot_id)
        elif changed or current["status"] != status:
            plan.puts.append(item)

    wanted = {lot["lotId"] for lot in desired}
    for lot_id, current in existing.items():
        if lot_id in wanted:
            continue
        if current["status"] in IN_USE:
            plan.blocked.append(lot_id)
        else:
            plan.deletes.append(lot_id)

    plan.blocked.sort()
    return plan


def lot_view(lot: dict[str, Any], zones: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """ข้อมูลล็อกสำหรับหน้าเว็บ ราคามาจากโซนเสมอ ขนาดใช้ของล็อกถ้าตั้งไว้ (ไม่ส่ง bookingId ออกไป)"""
    zone = zones.get(lot["zoneId"], {})
    return {
        "lotId": lot["lotId"],
        "zoneId": lot["zoneId"],
        "size": lot.get("size") or zone.get("size", ""),
        "price": zone.get("price", 0),
        "status": lot["status"],
    }
