"""pydantic model ของข้อมูลที่รับจากหน้าเว็บ ใช้ชื่อฟิลด์ camelCase ตาม frontend"""

from datetime import date
from typing import Annotated, Literal, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_serializer, model_validator
from pydantic.alias_generators import to_camel

from shared import clock

_PHONE = r"^[0-9+\- ]{6,20}$"
_ZONE_ID = r"^[A-Za-z0-9]{1,5}$"
_LOT_ID = r"^[A-Za-z0-9]{1,10}$"


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


class SignupProfile(CamelModel):
    """clientMetadata ที่หน้าเว็บส่งมากับ confirmSignUp (ค่าทุกตัวเป็น string)"""

    model_config = ConfigDict(extra="ignore")

    name: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, pattern=_PHONE)
    # ชื่อร้าน (ผู้ขาย) หรือชื่อองค์กร (ผู้จัดงาน) ตามช่องเดียวกันในฟอร์มสมัคร
    org_name: str | None = Field(None, max_length=100)
    category: str | None = Field(None, max_length=50)


class PaymentInput(CamelModel):
    bank: str = Field(min_length=1, max_length=100)
    account_name: str = Field(min_length=1, max_length=100)
    account_no: str = Field(min_length=1, max_length=30)


class UpdateMeInput(CamelModel):
    display_name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, pattern=_PHONE)
    shop_name: str | None = Field(None, min_length=1, max_length=100)
    category: str | None = Field(None, min_length=1, max_length=50)
    org_name: str | None = Field(None, min_length=1, max_length=100)
    # โปรไฟล์ร้าน (D5f)
    line: str | None = Field(None, max_length=50)
    bio: str | None = Field(None, max_length=1000)
    power: str | None = Field(None, max_length=100)
    # บัญชีรับเงินตั้งต้นของผู้จัดงาน (I3)
    payment: PaymentInput | None = None


class MarkReadInput(CamelModel):
    """{ids: [...]} อ่านบางรายการ หรือ {all: true} อ่านทั้งหมด"""

    ids: list[Annotated[str, Field(min_length=1, max_length=40)]] = Field(
        default_factory=list, max_length=100
    )
    all: bool = False

    @model_validator(mode="after")
    def _one_of(self) -> Self:
        if not self.all and not self.ids:
            raise ValueError("ต้องส่ง ids หรือ all: true")
        return self


class ReasonInput(CamelModel):
    reason: str = Field(min_length=1, max_length=500)


ShortText = Annotated[str, Field(min_length=1, max_length=50)]


class ZoneInput(CamelModel):
    id: str = Field(pattern=_ZONE_ID)
    name: str = Field(min_length=1, max_length=50)
    size: str = Field(min_length=1, max_length=30)
    price: int = Field(ge=0, le=1_000_000)  # บาท เก็บเป็นจำนวนเต็มเท่านั้น
    amenities: list[ShortText] = Field(default_factory=list, max_length=20)


class EventInput(CamelModel):
    """ข้อมูลงานทั้งก้อน (POST /events) ส่วน PUT รวมกับของเดิมก่อนแล้วตรวจด้วย model นี้"""

    title: str = Field(min_length=1, max_length=200)
    round: str | None = Field(None, max_length=50)
    type: Literal["ตลาดนัด", "งานแฟร์", "งานมหาวิทยาลัย"]
    description: str = Field("", max_length=5000)
    venue: str = Field(min_length=1, max_length=300)
    hours: str = Field("", max_length=100)
    start_date: date
    end_date: date
    booking_opens_at: AwareDatetime
    booking_closes_at: AwareDatetime
    payment: PaymentInput
    # None = ไม่จำกัดจำนวนล็อกต่อร้าน
    max_lots_per_seller: int | None = Field(1, ge=1, le=50)
    # เวลาที่ผู้ขายมีให้อัปโหลดสลิปหลังจอง (นาที) ค่าเริ่มต้น 24 ชม.
    slip_deadline_minutes: int = Field(24 * 60, ge=2, le=7 * 24 * 60)
    zones: list[ZoneInput] = Field(min_length=1, max_length=20)
    # ผังกริดจาก frontend เก็บไว้ตามที่ส่งมา backend ไม่ได้ใช้คำนวณ (ล็อกจริงอยู่ในตาราง Lots)
    cols: int | None = Field(None, ge=1, le=60)
    rows: int | None = Field(None, ge=1, le=60)
    layout: list[Annotated[str, Field(max_length=10)]] | None = Field(None, max_length=3600)
    disabled_cells: list[int] = Field(default_factory=list, max_length=3600)
    lot_sizes: dict[str, Annotated[str, Field(max_length=30)]] = Field(default_factory=dict)

    @field_serializer("booking_opens_at", "booking_closes_at")
    def _iso(self, value: AwareDatetime) -> str:
        return clock.iso(value)

    @model_validator(mode="after")
    def _check(self) -> Self:
        if self.end_date < self.start_date:
            raise ValueError("endDate ต้องไม่ก่อน startDate")
        if self.booking_closes_at <= self.booking_opens_at:
            raise ValueError("bookingClosesAt ต้องหลัง bookingOpensAt")
        ids = [zone.id for zone in self.zones]
        if len(ids) != len(set(ids)):
            raise ValueError("รหัสโซนซ้ำกัน")
        if self.layout is not None and self.cols and self.rows:
            if len(self.layout) != self.cols * self.rows:
                raise ValueError("จำนวนช่องใน layout ต้องเท่ากับ cols × rows")
        return self

    def to_item(self) -> dict:
        """ค่าสำหรับเขียนลง DynamoDB (วันที่เป็น string, ไม่มี float)

        เก็บ None ไว้ด้วย (เช่น maxLotsPerSeller = None คือไม่จำกัด) ไม่งั้นตอนแก้จะกลับเป็นค่าเริ่มต้น
        """
        return self.model_dump(mode="json", by_alias=True)


class LotInput(CamelModel):
    lot_id: str = Field(pattern=_LOT_ID)
    zone_id: str = Field(pattern=_ZONE_ID)
    size: str | None = Field(None, max_length=30)
    disabled: bool = False


class CreateBookingInput(CamelModel):
    event_id: str = Field(min_length=1, max_length=40)
    # ไม่เกิน 20 ล็อกต่อคำขอ ให้ transaction (2N + 1 item) อยู่ใต้ 100 item
    lot_ids: list[Annotated[str, Field(pattern=_LOT_ID)]] = Field(min_length=1, max_length=20)
    shop_name: str = Field(min_length=1, max_length=100)
    product_description: str = Field("", max_length=1000)
    # ข้อมูลเสริม (D5c) ไม่บังคับ ผู้จัดงานใช้ประกอบการตรวจ
    category: str = Field("", max_length=50)
    staff: str = Field("", max_length=50)
    power: bool = False
    note: str = Field("", max_length=500)

    @model_validator(mode="after")
    def _unique(self) -> Self:
        if len(self.lot_ids) != len(set(self.lot_ids)):
            raise ValueError("รหัสล็อกซ้ำกัน")
        return self

    def shop_info(self) -> dict:
        """ข้อมูลร้านที่คัดลอกลงทุก Booking ในชุด"""
        return self.model_dump(
            by_alias=True,
            include={"shop_name", "product_description", "category", "staff", "power", "note"},
        )


# ชนิดไฟล์สลิปที่รับ → นามสกุลไฟล์
SLIP_TYPES = {"image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf"}
SLIP_MAX_BYTES = 5 * 1024 * 1024


class SlipUrlInput(CamelModel):
    content_type: Literal["image/jpeg", "image/png", "application/pdf"]


LotId = Annotated[str, Field(pattern=_LOT_ID)]


class ApproveInput(CamelModel):
    """อนุมัติทั้งชุด (D7) · moves {ล็อกเดิม: ล็อกใหม่} เมื่อย้ายบางล็อกพร้อมอนุมัติ"""

    moves: dict[LotId, LotId] = Field(default_factory=dict, max_length=20)


class SlipInput(CamelModel):
    key: str = Field(min_length=1, max_length=300)


class SyncLotsInput(CamelModel):
    lots: list[LotInput] = Field(max_length=1000)

    @model_validator(mode="after")
    def _unique(self) -> Self:
        ids = [lot.lot_id for lot in self.lots]
        if len(ids) != len(set(ids)):
            raise ValueError("รหัสล็อกซ้ำกัน")
        return self
