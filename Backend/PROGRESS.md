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
| 3–4 | Cognito, auth, `/me`, Admin API, seed | กิตติพิชญ์, สรวิชญ์ | ⬜ |
| 5–6 | Events / Lots API, ภาพผังงาน | สรวิชญ์ | ⬜ |
| 7–8 | จอง, สลิป, หมดเวลาจอง | ปณวัฒน์ | ⬜ |
| 9 | อนุมัติ / ย้าย / ปฏิเสธ / ยกเลิก, summary | ปณวัฒน์ | ⬜ |
| 10 | Notifications | สรวิชญ์ | ⬜ |
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
- [ ] `post_confirmation`: สร้าง Users, ใส่ group ผู้ขาย, ผู้จัดงานเป็น PENDING + แจ้ง Admin
- [ ] `shared/auth.py`: `get_user`, `require_group`, ตรวจสถานะ ACTIVE
- [ ] `GET /me`, `PUT /me`
- [ ] `GET /admin/organizers`, `POST .../approve`, `POST .../reject`
- [ ] `POST /admin/users/{userId}/suspend`, `GET /admin/events`
- [ ] `scripts/seed.py`: บัญชี admin / organizer / seller เดโม
- [ ] Unit test ของ auth และ admin

## สัปดาห์ 5–6 — Events และ Lots
- [ ] `GET /events`, `GET /events/{id}`
- [ ] `POST /events`, `PUT /events/{id}`, `POST /events/{id}/close` (ตรวจเจ้าของ)
- [ ] `GET /events/{id}/lots` (กรอง item `QUOTA#` ออก)
- [ ] `POST /events/{id}/lots` แบบช่วง (`domain/lots.py`), `PUT /events/{id}/lots/{lotId}`
- [ ] `POST /events/{id}/floorplan-url`, `GET /events/{id}/floorplan`
- [ ] `GET /events/{id}/summary`
- [ ] Unit test

## สัปดาห์ 7–8 — การจองและสลิป
- [ ] `domain/booking.py`: state machine + TransactItems
- [ ] `POST /bookings` (Lot HELD + Quota + Booking ใน transaction เดียว)
- [ ] `GET /bookings/me`
- [ ] `POST /bookings/{id}/slip-url` (presigned POST ≤ 5 MB), `POST /bookings/{id}/slip`
- [ ] `GET /bookings/{id}/slip` (presigned GET)
- [ ] `POST /bookings/{id}/cancel` ฝั่งผู้ขาย
- [ ] `shared/scheduler.py` + `expire_booking`
- [ ] Fallback หมดเวลาตอนอ่าน/จองล็อก (PLAN 7.6)
- [ ] Unit test (moto) กรณีจองซ้ำ, เกินโควตา, หมดเวลา

## สัปดาห์ 9 — ผู้จัดงานตรวจการจอง
- [ ] `GET /events/{id}/bookings?status=`
- [ ] `POST /bookings/{id}/approve` (ปกติ + ย้ายล็อก)
- [ ] `POST /bookings/{id}/reject`
- [ ] `POST /bookings/{id}/cancel` ฝั่งผู้จัดงาน (หลังอนุมัติ)
- [ ] Unit test ทุก transition ในตาราง PLAN 7.4

## สัปดาห์ 10 — Notifications
- [ ] `shared/notify.py`, `domain/messages.py`
- [ ] `GET /notifications` (+ `unreadCount`), `POST /notifications/read`
- [ ] เรียก notify ครบทุกเหตุการณ์ในตาราง PLAN หัวข้อ 8
- [ ] เขียน attribute `ttl` (90 วัน) ทุก notification (เปิด TTL ใน Console สัปดาห์ 11)

## สัปดาห์ 11 — ขึ้น AWS และทดสอบ (PLAN 3, 10.2, 11.2)
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
| D3 | แนบสลิปตอนส่งคำขอ หรืออัปโหลดภายหลังภายใน 24 ชม. | สัปดาห์ 7 | | |
| D4 | เก็บ `layout` ผังกริดใน Events หรือไม่ | สัปดาห์ 5 | | |
| D5 | ฟีเจอร์นอก scope ใน frontend (autoApprove, เช็กอิน QR, ไฟฟ้า/จำนวนคน) | สัปดาห์ 9 | | |

---

## บันทึกการเปลี่ยนแปลง

| วันที่ | เรื่อง |
|---|---|
| 2026-10-27 | ปรับ scope ให้ใช้ Amplify Hosting + Cognito บน Learner Lab, ตัด CloudFront |
| 2026-10-27 | เขียน PLAN.md และเปลี่ยนหลังบ้านจาก Node.js เป็น Python 3.13 |
| 2026-10-27 | สร้างไฟล์ติดตามความคืบหน้านี้ |
| 2026-10-27 | เลิกใช้ SAM: สร้าง resource เองใน Console ตาม PLAN หัวข้อ 3 · ลบ `template.yaml`, `samconfig.toml`, `events/`, `test_template.py` · ย้ายโครงสร้างตารางไป `tests/tables.py` · เพิ่ม `scripts/build_zip.py` |
| 2026-10-27 | เปลี่ยนแผน: สัปดาห์ 1–10 เขียนโค้ด + เทสต์ในเครื่องอย่างเดียว ย้าย deploy และการทดสอบบน AWS ไปสัปดาห์ 11 (PLAN 1.7, 10, 11, 12) |
| 2026-10-27 | ตั้งโครงโปรเจกต์ + `template.yaml` (ตาราง, bucket, Cognito, HttpApi, `/health`) เปลี่ยน `LabRoleArn` เป็น `LabRoleName` + `!Sub` venv ต้องใช้ Python 3.13 |
| 2026-10-27 | ตัดสิน D1 (จองทั้งงาน) และ D2 (หลายล็อก all-or-nothing) ปรับ PLAN 7.1 / 7.5 |
| 2026-10-27 | Spike ใน Lab ผ่านทั้ง 4 ข้อ ปรับ PLAN: `Role` ใส่ทีละ Function, pydantic ใช้จาก layer `:40`, `sam build` ไม่ต้องใช้ Docker |
