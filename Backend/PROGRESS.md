# BookMyBooth Backend — ติดตามความคืบหน้า

> แผนอ้างอิง: [PLAN.md](PLAN.md) · Scope: [BookMtBooth-scope.md](../BookMtBooth-scope.md)
> อัปเดตล่าสุด: 2026-10-27

**สถานะ:** ⬜ ยังไม่เริ่ม · 🟨 กำลังทำ · ✅ เสร็จ · ⛔ ติดปัญหา · ➖ ตัดออก

> สัปดาห์ 1–10 เป็นงานโค้ดล้วน ("เสร็จ" = โค้ด + เทสต์ในเครื่องผ่าน) ยังไม่ deploy ขึ้น AWS จนถึงสัปดาห์ 11 (PLAN หัวข้อ 1 ข้อ 7)

---

## ภาพรวม

| สัปดาห์ | หัวข้อ | ผู้รับผิดชอบ | สถานะ |
|---|---|---|---|
| 0 | เตรียมเอกสาร (scope, plan) | ทีม | ✅ |
| 1–2 | ตั้งโปรเจกต์ + infra พื้นฐาน (โค้ด) + spike | กิตติพิชญ์ | ✅ |
| 3–4 | Cognito, auth, `/me`, Admin API, seed | กิตติพิชญ์, สรวิชญ์ | ✅ |
| 5–6 | Events / Lots API, ผังกริด | สรวิชญ์ | ✅ |
| 7–8 | จอง, สลิป, หมดเวลาจอง | ปณวัฒน์ | ✅ |
| 9 | อนุมัติ / ย้าย / ปฏิเสธ / ยกเลิก, summary | ปณวัฒน์ | ✅ |
| 10 | Notifications + ฟีเจอร์ตามข้อ 14 | สรวิชญ์ | ✅ |
| 11 | Deploy `dev` ครั้งแรก, integration/race test, เชื่อม frontend, แก้บั๊ก | ทุกคน | ⬜ |
| 12 | Deploy prod, seed เดโม, เอกสาร API | กิตติพิชญ์ | ⬜ |

---

## สัปดาห์ 0 — เตรียมเอกสาร ✅
- [x] ปรับ scope ให้ใช้ Amplify Hosting + Cognito + SAM บน Learner Lab (เพิ่มหัวข้อ 5.1 ข้อจำกัดของ Lab)
- [x] เปลี่ยนหลังบ้านเป็น Python 3.13
- [x] เขียน `Backend/PLAN.md`
- [ ] ตัดสินใจเรื่องที่ spec กับ frontend ไม่ตรงกัน (ดู [ประเด็นที่ต้องตัดสินใจ](#ประเด็นที่ต้องตัดสินใจ))

## สัปดาห์ 1–2 — ตั้งโปรเจกต์และ infra พื้นฐาน
- [x] โครงโฟลเดอร์ `src/`, `tests/`, `scripts/` ตาม PLAN หัวข้อ 2
- [x] `pyproject.toml`, `requirements.txt`, `requirements-dev.txt`, `Backend/.gitignore` (`.venv/` `build/` ฯลฯ)
- [x] `tests/tables.py`: โครงสร้างตาราง DynamoDB 5 ตาราง + GSI (PLAN หัวข้อ 4) ใช้สร้างตารางใน moto
- [x] `functions/events/app.py` + `GET /health` ไว้ตรวจหลังขึ้น AWS
- [x] `shared/http.py` (`create_app`, แปลง Decimal, error handler), `shared/errors.py`, `shared/db.py`
- [x] `scripts/build_zip.py` → `build/lambda.zip` (src + python-ulid แบบ Linux x86_64)
- [x] pytest + moto ผ่าน (13 tests), ruff ผ่าน
- [x] เขียน checklist สร้าง resource ใน Console (PLAN หัวข้อ 3)
- ➖ ~~SAM (`template.yaml`, `samconfig.toml`, `cfn-lint`)~~ ยกเลิก เปลี่ยนเป็นสร้างใน Console เอง

### Spike ใน Learner Lab (PLAN หัวข้อ 13)
| # | ทดสอบ | สถานะ | ผล / หมายเหตุ |
|---|---|---|---|
| 1 | EventBridge Scheduler ใช้ `LabRole` เรียก Lambda ได้ | ✅ | trust policy มี `scheduler.amazonaws.com` แล้ว ทดสอบ `rate(1 minutes)` ผ่าน CloudFormation · ยังต้องทดสอบให้ Lambda สร้าง schedule `at(...)` เองตอนสัปดาห์ 7 (ต้องมี `iam:PassRole`) |
| 2 | Cognito PostConfirmation + `admin_add_user_to_group` ผ่าน `LabRole` | ✅ | ผู้ใช้ถูกใส่ group อัตโนมัติหลัง confirm |
| 3 | `sam deploy` ผ่านโดยไม่สร้าง IAM resource | ✅ | ใส่ `Role:` ที่ Function ทีละตัว ใน `Globals` ไม่ได้ |
| 4 | Powertools Layer ใช้ได้ และ `import pydantic` บน Lambda ได้ | ✅ | layer `:40` (Powertools 3.37.0) มี pydantic 2.14.1 มาด้วย ไม่ต้อง bundle |

- [ ] ลบ S3 bucket ที่ `--resolve-s3` สร้างตอน spike ถ้าไม่ใช้ต่อ

## สัปดาห์ 3–4 — Auth และ Admin
- ➖ ~~Cognito User Pool, Client, Groups~~ สร้างใน Console สัปดาห์ 11 (PLAN 3.3)
- [x] `post_confirmation`: สร้าง Users (โปรไฟล์จาก `clientMetadata`), ใส่ group ผู้ขาย, ผู้จัดงานเป็น PENDING + แจ้ง Admin, ข้าม forgot-password, รันซ้ำไม่สร้างซ้ำ
- [x] `shared/auth.py`: `current_user`, `require_group`, `parse_groups`, ไม่มี claims → 401, ระงับ → 403
- [x] `GET /me`, `PUT /me` (แก้ได้เฉพาะฟิลด์ของ role ตัวเอง)
- [x] `GET /admin/organizers`, `POST .../approve`, `POST .../reject`
- [x] `POST /admin/users/{userId}/suspend`, `GET /admin/events`
- [x] `shared/notify.py`, `domain/messages.py` (ส่วนแจ้งเตือนบัญชี) — ดึงมาทำก่อนเพราะ admin/post_confirmation ต้องใช้
- [x] `scripts/seed.py`: บัญชี admin / organizer / seller เดโม (ยังไม่รันจริง · งานตัวอย่างเพิ่มสัปดาห์ 5–6)
- [x] Unit test ของ auth, post_confirmation, me, admin, seed — รวม 51 tests ผ่าน, ruff ผ่าน

## สัปดาห์ 5–6 — Events และ Lots ✅
- [x] `GET /events` (OPEN/CLOSED), `GET /events/{id}` (DRAFT → 404), `GET /organizer/events`
- [x] `POST /events` (DRAFT), `PUT /events/{id}` (แก้บางฟิลด์ + เผยแพร่), `POST /events/{id}/close` (ตรวจเจ้าของ)
- [x] `domain/events.py`: คำนวณ `status` (SCHEDULED/OPEN/CLOSED/ENDED ตามเวลาไทย)
- [x] เก็บผังกริด (`cols, rows, layout, disabledCells, lotSizes`) ใน Events (D4)
- [x] `PUT /events/{id}/lots` sync ทั้งชุด (`domain/lots.plan_sync`) กันแก้/ลบล็อกที่มีคนจอง
- [x] `GET /events/{id}/lots` (กรอง `QUOTA#`, ราคาจากโซน, ไม่ส่ง bookingId)
- [x] `GET /events/{id}/summary`
- [x] `scripts/seed.py` เพิ่มงานตัวอย่าง `demo-event` (OPEN, 12 ล็อก)
- [x] Unit test — รวม 87 tests ผ่าน, ruff ผ่าน
- ➖ ~~floorplan-url / floorplan, สร้างล็อกแบบช่วง, `PUT /events/{id}/lots/{lotId}`~~ ตัดออก (D4)
- [x] fallback หมดเวลาใน `GET /events/{id}/lots` (ทำในสัปดาห์ 7)

## สัปดาห์ 7–8 — การจองและสลิป ✅
- [x] `domain/booking.py`: สถานะ + TransactItems (`create_items`, `slip_items`, `release_items`)
- [x] `POST /bookings` หลายล็อก all-or-nothing (Lot HELD + Booking + Quota ใน transaction เดียว) บอกล็อกที่ถูกแย่งจาก `CancellationReasons`
- [x] `GET /bookings/me`
- [x] `POST /bookings/{id}/slip-url` (presigned POST ≤ 5 MB, jpg/png/pdf), `POST /bookings/{id}/slip` — สลิปเดียวต่อชุด (D3)
- [x] `GET /bookings/{id}/slip` (presigned GET ผู้ขาย/ผู้จัดงาน)
- [x] `POST /bookings/{id}/cancel` ฝั่งผู้ขาย
- [x] `shared/scheduler.py` (`expire-<groupId>`) + `expire_booking` (รวมโหมดกวาดไม่มี bookingIds)
- [x] Fallback หมดเวลา (`shared/booking_ops.expire_stale_lots` ใช้ `holdExpiresAt` ในล็อก) ใน GET lots, POST bookings, GET bookings/me, slip
- [x] Unit test (moto) จองซ้ำ, ล็อกถูกแย่งในชุด, เกินโควตา, หมดเวลา, fallback, สลิป, ยกเลิก — รวม 110 tests ผ่าน, ruff ผ่าน
- [ ] สัปดาห์ 11: ทดสอบว่า Lambda สร้าง schedule ด้วย LabRole ได้ (`iam:PassRole`) ถ้าไม่ได้ ใช้ expire_booking โหมดกวาดกับ schedule `rate(5 minutes)` (ต้องขออนุมัติสร้างก่อน)

## สัปดาห์ 9 — ผู้จัดงานตรวจการจอง ✅
- [x] `GET /events/{id}/bookings?status=` (เปลี่ยนที่เลยเวลาเป็น EXPIRED ก่อนตอบ)
- [x] `POST /bookings/{id}/approve` (ปกติ + ย้ายล็อก `newLotId`, ราคาเดิม, บันทึก `moves`) — `domain/booking.approve_items`
- [x] `POST /bookings/{id}/reject` `{reason}`
- [x] `POST /bookings/{id}/cancel` ใช้ร่วมกัน: ผู้ขายก่อนอนุมัติ / ผู้จัดงานหลังอนุมัติ `{reason}`
- [x] แจ้งเตือน `booking_approved`, `booking_moved`, `booking_rejected`, `booking_cancelled` (ผู้จัดงานยกเลิก)
- [x] Unit test ทุก transition ในตาราง PLAN 7.4 + ย้ายล็อกไปล็อกที่ถูกจอง/หมดเวลา — รวม 126 tests ผ่าน, ruff ผ่าน

## สัปดาห์ 10 — Notifications + ฟีเจอร์ตามข้อ 14 ✅
- [x] `shared/notify.py`, `domain/messages.py` (ทำไปแล้วตั้งแต่สัปดาห์ 3–9 ครบทุกเหตุการณ์ที่มี)
- [x] `GET /notifications` (+ `unreadCount`), `POST /notifications/read` (`{ids}` / `{all}`)
- [x] เรียก notify ครบทุกเหตุการณ์ในตาราง PLAN หัวข้อ 8 (+ `account_unsuspended`)
- [x] เขียน attribute `ttl` (90 วัน) ทุก notification (เปิด TTL ใน Console สัปดาห์ 11)
- [x] D5b เช็กอิน `POST /bookings/{id}/check-in` (เฉพาะ APPROVED + วันงาน)
- [x] D5c ข้อมูลร้านตอนจอง `category`, `staff`, `power`, `note`
- [x] D5d `POST /admin/users/{userId}/unsuspend`
- [x] D5e `GET /organizer/vendors` (`domain/vendors.py`)
- [x] D5f โปรไฟล์ร้าน `line`, `bio`, `power`
- [x] Unit test — รวม 140 tests ผ่าน, ruff ผ่าน
- [x] เทสต์ flow ครบในเครื่อง `tests/test_flow.py`: สมัคร → Admin อนุมัติ → สร้างงาน → sync ล็อก → เผยแพร่ → จอง 2 ล็อก → สลิปเดียว → อนุมัติ (ย้าย 1) → เช็กอิน → แจ้งเตือน → สรุปงาน/สถิติร้าน — รวม 141 tests ผ่าน

## สัปดาห์ 11 — ขึ้น AWS และทดสอบ (PLAN 3, 10.2, 11.2)
> ทำตาม [AWS-SETUP.md](../AWS-SETUP.md) ทีละข้อ
- [ ] สร้าง DynamoDB 5 ตาราง + GSI + TTL (PLAN 3.1)
- [ ] สร้าง S3 bucket + CORS (PLAN 3.2)
- [ ] สร้าง Cognito User Pool, App client, Groups (PLAN 3.3)
- [ ] `python scripts/build_zip.py` แล้วสร้าง Lambda 6 ตัว + layer + env + อัปโหลด zip (PLAN 3.4)
- [ ] ตั้ง PostConfirmation trigger (PLAN 3.3)
- [ ] สร้าง HTTP API + CORS + JWT authorizer + routes + throttling (PLAN 3.5)
- [ ] เปิด `<Invoke URL>/health` ได้ `{"status":"ok"}`
- [ ] จดชื่อ/ID ของ resource ที่สร้างจริงไว้ในตารางด้านล่าง
- [ ] รัน `scripts/seed.py` กับชุด `dev`
- [ ] PostConfirmation trigger ทำงานจริง และตรวจรูปแบบ `cognito:groups` ใน claims
- [ ] Lambda สร้าง schedule `at(...)` ได้ด้วย LabRole (`iam:PassRole`) ถ้าไม่ได้ เพิ่ม rule `rate(5 minutes)`
- [ ] ทดสอบหมดเวลาด้วย `slipDeadlineHours` สั้น
- [ ] อัปโหลดสลิปจากเบราว์เซอร์ผ่าน CORS ของ bucket
- [ ] Integration test flow ครบกับชุด `dev`
- [ ] `scripts/race_test.py`: 5 request พร้อมกัน → `201` × 1, `409` × 4
- [ ] เชื่อมกับ frontend จริงและแก้บั๊ก

### Resource ที่สร้างจริง (ชุด dev)
| ส่วน | ชื่อ / ID |
|---|---|
| Account ID | |
| S3 bucket | |
| User Pool ID | |
| App client ID | |
| HTTP API Invoke URL | |

## สัปดาห์ 12 — ส่งงาน
- [ ] สร้างชุด `prod` ใน Console บนบัญชีหลัก (PLAN หัวข้อ 3)
- [ ] ใส่ env `VITE_*` ใน Amplify Hosting
- [ ] Seed ข้อมูลเดโม
- [ ] เอกสาร API

---

## ประเด็นที่ต้องตัดสินใจ

อ้างอิง PLAN หัวข้อ 14

| # | เรื่อง | ต้องตัดสินใจก่อน | ผลการตัดสินใจ | วันที่ |
|---|---|---|---|---|
| D1 | จองรายวัน (Lots SK `lotId#date`) หรือจองทั้งงาน | สัปดาห์ 5 | จองทั้งงานตาม scope, Lots SK = `lotId`, frontend ซ่อนการเลือกวัน | 2026-10-27 |
| D2 | จองหลายล็อกในคำขอเดียว | สัปดาห์ 7 | ได้ แบบ all-or-nothing: `lotIds[]` → Booking ล็อกละรายการใน transaction เดียว ผูกด้วย `groupId` (PLAN 7.1) | 2026-10-27 |
| D3 | แนบสลิปตอนส่งคำขอ หรืออัปโหลดภายหลังภายใน 24 ชม. | สัปดาห์ 7 | จองก่อน แนบสลิปทีหลังภายใน `slipDeadlineMinutes` (ตาม scope) · สลิปเดียวต่อชุด (`groupId`) | 2026-10-27 |
| D4 | เก็บ `layout` ผังกริดใน Events หรือไม่ | สัปดาห์ 5 | ใช้ผังกริดตาม frontend เก็บใน Events + sync ล็อกด้วย `PUT /events/{id}/lots` ไม่มีรูปผัง · เพิ่ม route `GET /organizer/events` | 2026-10-27 |
| D5a | อนุมัติอัตโนมัติ (`autoApprove`) | สัปดาห์ 9 | ไม่ทำ | 2026-10-27 |
| D5b | เช็กอิน QR | สัปดาห์ 9 | ทำ: `POST /bookings/{id}/check-in` เฉพาะ APPROVED และเฉพาะวันงาน (route ใหม่) | 2026-10-27 |
| D5c | ข้อมูลร้านตอนจอง (category, staff, power, note) | สัปดาห์ 9 | เก็บเป็นฟิลด์เสริมใน Booking | 2026-10-27 |
| D5d | ยกเลิกการระงับบัญชี | สัปดาห์ 9 | ทำ: `POST /admin/users/{userId}/unsuspend` (route ใหม่) | 2026-10-27 |
| D5e | สถิติร้านของผู้จัดงาน (VendorsPage) | สัปดาห์ 9 | ทำ: `GET /organizer/vendors` (route ใหม่) | 2026-10-27 |
| D5f | โปรไฟล์ร้าน line / bio / power | สัปดาห์ 9 | เก็บใน Users แก้ผ่าน `PUT /me` | 2026-10-27 |
| D6 | ชื่อสถานะใน JSON | — | ตัวพิมพ์ใหญ่ตาม scope frontend map เอง | 2026-10-27 |

---

## งานฝั่ง Frontend

รายละเอียดแต่ละข้ออยู่ใน PLAN หัวข้อ 15 ติ๊กเมื่อ frontend แก้เสร็จ

| # | เรื่อง | สถานะ |
|---|---|---|
| F1 | เชื่อม Cognito (`aws-amplify/auth`) แทนบัญชีจำลอง | ⬜ |
| F2 | แนบ `Authorization: Bearer <accessToken>` | ⬜ |
| F3 | อ่าน error `{ error: { code, message, details } }` | ⬜ |
| F4 | map ค่าสถานะตัวพิมพ์ใหญ่ | ⬜ |
| F5 | ใช้ `userId` แทน accountId/shopId/organizerId | ⬜ |
| F6 | สมัคร: `custom:role` + `clientMetadata` ตอน `confirmSignUp` | ⬜ |
| F7 | `fetchAuthSession({ forceRefresh: true })` หลังได้รับอนุมัติ | ⬜ |
| F8 | หน้าโปรไฟล์ `GET/PUT /me` | ⬜ |
| F9 | หน้า Admin + ปุ่มยกเลิกระงับใช้ `unsuspend` | ⬜ |
| F10 | ฟอร์มงาน: ชื่อฟิลด์ใหม่, `startDate/endDate`, `slipDeadlineMinutes` | ⬜ |
| F11 | ตัดการจองรายวัน (`days`, `surcharge`, `lotState` รายวัน) | ⬜ |
| F12 | `PUT /events/{id}/lots` หลังบันทึกผัง | ⬜ |
| F13 | เผยแพร่ด้วย `publishStatus: "OPEN"` / ปิดด้วย `/close` | ⬜ |
| F14 | รายการงานสาธารณะ / `GET /organizer/events` | ⬜ |
| F15 | หน้าสรุปงาน `GET /events/{id}/summary` | ⬜ |
| F16 | ซ่อนสวิตช์ `autoApprove` (D5a) | ⬜ |
| F17 | จองหลายล็อก `POST /bookings` `lotIds[]` + รับมือ error | ⬜ |
| F18 | poll แจ้งเตือน (หลัง backend สัปดาห์ 10) | ⬜ |
| F19 | แนบสลิปทีหลัง: slip-url → FormData ไป S3 → slip (สลิปเดียวต่อชุด) | ⬜ |
| F20 | ดูสลิป `GET /bookings/{id}/slip` | ⬜ |
| F21 | การจองของฉัน `GET /bookings/me` + สถานะรอสลิป/หมดเวลา | ⬜ |
| F22 | ผู้ขายยกเลิก `POST /bookings/{id}/cancel` | ⬜ |
| F23 | ประเภทแจ้งเตือนใหม่ `booking_slip_uploaded`, `booking_expired` | ⬜ |
| F24 | หน้าตรวจการจอง `GET /events/{id}/bookings?status=` | ⬜ |
| F25 | อนุมัติ / ย้ายล็อก `POST /bookings/{id}/approve {newLotId?}` | ⬜ |
| F26 | ปฏิเสธ / ยกเลิกหลังอนุมัติ พร้อมเหตุผล | ⬜ |
| F27 | เช็กอิน QR: QR จาก `bookingId` + `POST /bookings/{id}/check-in` | ⬜ |
| F28 | VendorsPage ใช้ `GET /organizer/vendors` | ⬜ |
| F29 | โปรไฟล์ร้าน `line`, `bio`, `power` ผ่าน `GET/PUT /me` | ⬜ |
| F30 | แจ้งเตือน `account_unsuspended` | ⬜ |

---

## บันทึกการเปลี่ยนแปลง

| วันที่ | เรื่อง |
|---|---|
| 2026-10-27 | ปรับ scope ให้ใช้ Amplify Hosting + Cognito บน Learner Lab, ตัด CloudFront |
| 2026-10-27 | เขียน PLAN.md และเปลี่ยนหลังบ้านจาก Node.js เป็น Python 3.13 |
| 2026-10-27 | สร้างไฟล์ติดตามความคืบหน้านี้ |
| 2026-10-28 | เขียน `AWS-SETUP.md` ที่ root: คู่มือสร้าง AWS ทีละขั้น + role + routes 31 ตัว + จุดในโค้ดที่เกี่ยวข้อง |
| 2026-10-28 | เพิ่มเทสต์ flow ครบในเครื่อง (`tests/test_flow.py`) ปิดงานโค้ดสัปดาห์ 1–10 |
| 2026-10-27 | ตัดสินข้อ 14 ครบ (D5a–D5f, D6) · ทำเช็กอิน, สถิติร้าน, ยกเลิกระงับ, ข้อมูลเสริมการจอง, โปรไฟล์ร้าน · route ใหม่ 3 ตัว (อนุมัติแล้ว) · ทำสัปดาห์ 10 Notifications API · F-items F28–F30 และแก้ F9, F16, F17, F18, F27 |
| 2026-10-27 | ทำสัปดาห์ 9 เสร็จ · approve/ย้ายล็อก/reject/cancel ผู้จัดงาน · `GET /events/{id}/bookings` · cancel route เดียวทั้งผู้ขายและผู้จัดงาน · เพิ่มงาน frontend F24–F27 |
| 2026-10-27 | ทำสัปดาห์ 7–8 เสร็จ · D3 จองก่อน แนบสลิปทีหลัง สลิปเดียวต่อชุด · ล็อกเก็บ `holdExpiresAt` · expire_booking มีโหมดกวาด · เพิ่มงาน frontend F19–F23 |
| 2026-10-27 | ทำสัปดาห์ 5–6 เสร็จ · D4 ใช้ผังกริด · เพิ่ม `GET /organizer/events` · `slipDeadlineHours` → `slipDeadlineMinutes` · ราคาล็อกมาจากโซน · เพิ่ม PLAN หัวข้อ 15 งานฝั่ง frontend |
| 2026-10-27 | ทำสัปดาห์ 3–4 เสร็จ (โค้ด + เทสต์) · ตัดสินใจเก็บโปรไฟล์ตอนสมัครใน DynamoDB ผ่าน `clientMetadata` ไม่เพิ่ม attribute ใน Cognito |
| 2026-10-27 | เลิกใช้ SAM: สร้าง resource เองใน Console ตาม PLAN หัวข้อ 3 · ลบ `template.yaml`, `samconfig.toml`, `events/`, `test_template.py` · ย้ายโครงสร้างตารางไป `tests/tables.py` · เพิ่ม `scripts/build_zip.py` |
| 2026-10-27 | เปลี่ยนแผน: สัปดาห์ 1–10 เขียนโค้ด + เทสต์ในเครื่องอย่างเดียว ย้าย deploy และการทดสอบบน AWS ไปสัปดาห์ 11 (PLAN 1.7, 10, 11, 12) |
| 2026-10-27 | ตั้งโครงโปรเจกต์ + `template.yaml` (ตาราง, bucket, Cognito, HttpApi, `/health`) เปลี่ยน `LabRoleArn` เป็น `LabRoleName` + `!Sub` venv ต้องใช้ Python 3.13 |
| 2026-10-27 | ตัดสิน D1 (จองทั้งงาน) และ D2 (หลายล็อก all-or-nothing) ปรับ PLAN 7.1 / 7.5 |
| 2026-10-27 | Spike ใน Lab ผ่านทั้ง 4 ข้อ ปรับ PLAN: `Role` ใส่ทีละ Function, pydantic ใช้จาก layer `:40`, `sam build` ไม่ต้องใช้ Docker |
