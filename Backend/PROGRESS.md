# BookMyBooth Backend — ติดตามความคืบหน้า

> แผนอ้างอิง: [PLAN.md](PLAN.md) · Scope: [BookMtBooth-scope.md](../BookMtBooth-scope.md)
> อัปเดตล่าสุด: 2026-10-28

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

## เชื่อม Frontend ↔ Backend ([INTEGRATION-PLAN.md](../INTEGRATION-PLAN.md))
| เฟส | งาน | สถานะ |
|---|---|---|
| 0 | Backend เตรียม: B1 `local_api.py`, B2 payment ในโปรไฟล์ผู้จัดงาน, B3 `GET /admin/users` + ยอดใน `/admin/events` | ✅ |
| 1 | โครงพื้นฐาน frontend (TanStack Query, api client, config) | ✅ |
| 2 | ล็อกอิน / สมัคร / บัญชี | ✅ |
| 3 | ดูงานและผัง | ✅ |
| 4 | ผู้จัดงานสร้าง/แก้งาน | ✅ |
| 5 | ผู้ขายจองและแนบสลิป | ✅ |
| 6 | ตรวจการจอง หน้างาน สถิติ | ✅ |
| 7 | Admin และแจ้งเตือน | ✅ |
| 8 | เก็บกวาด store/seed เดิม | ✅ |
| 9 | สลับไป AWS (สัปดาห์ 11) | ⬜ |

### เฟส 0 ✅
- [x] B1 `scripts/local_api.py`: moto server mode (`ThreadedMotoServer`) + ตาราง/bucket+CORS/user pool+groups + seed บัญชีเดโมและ `demo-event` · route ตาม AWS-SETUP 6.1 → event HTTP API v2 → `lambda_handler` จริง · `Bearer dev.<userId>` → claims (group จาก Cognito จำลอง) · 401/404 แบบ API Gateway · CORS `localhost:5173` · `/_dev/accounts`, `sign-up`, `confirm` (รัน PostConfirmation จริง), `sign-in` (ตรวจรหัสผ่านกับ Cognito จำลอง), `expire` (โหมดกวาด)
- [x] B1 `tests/test_local_api.py` เปิดเป็น process แยกแล้วเรียกผ่าน HTTP รวมอัปโหลดสลิปตรงไป moto (6 tests) · `requirements-dev.txt` เพิ่ม `moto[server]`
- [x] B2 ผู้จัดงานแก้ `payment {bank, accountName, accountNo}` ผ่าน `PUT /me` (`EDITABLE_FIELDS`, `UpdateMeInput.payment: PaymentInput`)
- [x] B3 `GET /admin/users?role=` (ไม่ส่ง = ทุกคน, role ผิด → `400 INVALID_ROLE`) · `GET /admin/events` เพิ่ม `status`, `bookingCount` (การจองที่ยังถือล็อก), `revenue` (ยอด APPROVED)
- [x] B4 อัปเดต PLAN (4.1, 6, 9, 10.1, F8, F9, F32, F33), AWS-SETUP (6.1, 14), INTEGRATION-PLAN (4.1 `/_dev/*`)
- [x] pytest 151 ผ่าน, ruff check + format ผ่าน

### เฟส 1 ✅
- [x] ติดตั้ง `@tanstack/react-query` 5, `aws-amplify` 6
- [x] `config.ts` (`VITE_*`), `api/client.ts` (`apiFetch`, `ApiError`, ตัวเสียบ token / 401), `api/dto.ts` (ทุก endpoint ใน PLAN 6), `api/mappers.ts` (สถานะ, Account, แจ้งเตือน)
- [x] `QueryClientProvider` ใน `main.tsx` · `queries/queryClient.ts` (ไม่ retry 4xx, toast อัตโนมัติ ยกเว้น `meta.silentError` และ 401)
- [x] F3 `ApiErrorToaster` ส่ง error ไป `useToast` เดิม
- [x] `.env.example` (dev + cognito) · `.env.local` ถูก ignore แล้ว
- [x] หน้าแรกเรียก `GET /health` ผ่าน client (ป้ายชั่วคราวตอน dev) — ตรวจในเบราว์เซอร์: 200 ผ่าน CORS, 401 ไม่ขึ้น toast, 404 ขึ้น toast ข้อความจาก backend
- [x] `npm run build` + `npm run lint` ผ่าน (แก้ lint เดิมใน `components/ui/button.tsx` ด้วย eslint-disable บรรทัดเดียว)

### เฟส 2 ✅
- [x] `src/auth/`: `adapter.ts` (interface + `AuthError`), `devAdapter.ts` (`/_dev/*`, token ใน `localStorage`), `cognitoAdapter.ts` (Amplify v6 โหลดแยก chunk `amplify.ts`), `index.ts` (เลือกตาม `VITE_AUTH_MODE`, ข้อความ error ภาษาไทย)
- [x] `AuthProvider` ใหม่: คง interface เดิมแต่เป็น async · `account`/`me` จาก `GET /me` (TanStack Query `['me']`) · เปิดหน้าแล้วกู้ session ก่อนแสดงหน้า · 401 / `ACCOUNT_SUSPENDED` ระหว่างใช้งาน → ออกจากระบบ + popup แจ้ง · ตรวจบทบาทตอนล็อกอิน
- [x] สมัคร: `custom:role` + โปรไฟล์ใน `clientMetadata` (เก็บใน `sessionStorage` ระหว่างรอรหัส) · ยืนยันแล้วเข้าสู่ระบบต่อทันที (F6)
- [x] OTP: เลิกแสดงรหัสบนจอ (`SHOW_OTP_ON_SCREEN`, `lastOtp` ลบแล้ว) · ปุ่มส่งใหม่เว้น 60 วิ · โหมด dev บอกว่ากรอกอะไรก็ได้ + ปุ่มเลือกบัญชีเดโม (`/_dev/accounts`)
- [x] ลืมรหัสผ่าน: Cognito `resetPassword` / `confirmResetPassword` · dev ใช้ `POST /_dev/reset-password` (เพิ่มใน `local_api.py` + เทสต์)
- [x] กฎรหัสผ่านฝั่งหน้าเว็บตรงกับ User Pool (≥ 8 ตัว มีพิมพ์เล็ก + ตัวเลข)
- [x] `ShopProfilePage` / `OrganizerProfilePage` → `GET/PUT /me` ส่งเฉพาะช่องที่แก้ (F8, F29, F32)
- [x] F7: เมื่อ `status` ใน `/me` เปลี่ยน เรียก `refreshSession()` · หน้ารออนุมัติมีปุ่ม "ตรวจสอบสถานะอีกครั้ง"
- [x] ชั่วคราวถึงเฟส 8: `syncProfile` คัดลอก `/me` ลงร้าน/ผู้จัดงานในข้อมูลจำลอง (id = userId) + `useMyShop`/`useOrganizerData` fallback จาก `/me` (`services/profileBridge.ts`) — หน้าที่ยังใช้ข้อมูลจำลองไม่พัง แต่บัญชีจาก API ยังไม่เห็นงาน/การจองเดโมเดิม
- [x] ทดสอบในเบราว์เซอร์กับ API จำลอง: สมัครผู้ขาย → ยืนยัน → แก้โปรไฟล์ → รีเฟรชยังล็อกอิน → ออกจากระบบ · ใช้บัญชีผู้ขายเข้าหน้าผู้จัดงาน → ข้อความบทบาทไม่ตรง · สมัครผู้จัดงาน → หน้ารออนุมัติ → Admin อนุมัติ → ตรวจสถานะ → เข้าแดชบอร์ด → บันทึกบัญชีรับโอน · ถูกระงับระหว่างใช้งาน → หลุดทันที / ล็อกอินซ้ำไม่ได้ · ลืมรหัสผ่าน
- [x] `npm run build` + `lint` ผ่าน · pytest 152 ผ่าน, ruff ผ่าน
- [ ] โหมด cognito ยังไม่ได้ทดสอบกับ Cognito จริง (เฟส 9)

### เฟส 3 ✅
- [x] `api/events.ts` (`GET /events`, `/events/{id}`, `/events/{id}/lots`), `eventFromDto` → type ใหม่ `PublicEvent` (ไม่มี `days`/`surcharge`/`lotState` — F11) + `LotStates` (สถานะล็อกทั้งงานตามรหัส)
- [x] `queries/events.ts`: `useOpenEvents` (กรอง `status === 'open'` ที่ backend คำนวณ), `useEventDetail`, `useEventLots` (stale 15 วิ), `useLotsOfEvents` (หลายงานพร้อมกัน)
- [x] `services/events.ts`: จำนวนวัน, ราคาโซน, ล็อกว่าง (แทน `selectors`/`pricing` เดิมสำหรับหน้าผู้ขาย) · ล็อกที่วาดแต่ไม่มีในตาราง Lots ถือว่าปิดจอง
- [x] `HomePage`, `EventPage` (ค้นหา/กรองเดิมใช้ได้), `EventListItem`, `EventMapPage`, `LotMap`, `LotPanelSelected`, `LotPanelEmpty` → API
- [x] ราคาบนผัง = ราคาโซนต่อทั้งงาน ไม่มีค่าธรรมเนียม (I2) ตรงกับ `amount` ที่ backend คิด
- [x] ปุ่มจองปิดชั่วคราวพร้อมข้อความ จนกว่าขั้นตอนจองจะย้ายไป API ในเฟส 5 (ตัดสิน 2026-10-28)
- [x] ลบป้ายสถานะ API ชั่วคราวของเฟส 1 (`ApiStatusBadge`, `queries/health.ts`)
- [x] ทดสอบในเบราว์เซอร์กับ API จำลอง: หน้าแรก/รายการงานแสดง `demo-event` 12 ล็อก · เลือก `?lots=A01,B02` รวม ฿800 · จอง A03 ผ่าน API แล้วผังแสดง "รออนุมัติ" · งานที่ไม่มี → "งานนี้ไม่เปิดรับจองแล้ว" ไม่มี toast ซ้ำ
- [x] `npm run build` + `lint` ผ่าน

### เฟส 4 ✅
- [x] `api/organizer.ts` (`GET /organizer/events`, `POST /events`, `PUT /events/{id}`, `POST /events/{id}/close`, `PUT /events/{id}/lots`, `GET /events/{id}/summary`) + `queries/organizer.ts`
- [x] บันทึกงาน `useSaveEvent`: ข้อมูลงาน → `PUT /lots` → เผยแพร่ (`publishStatus: "OPEN"` หลัง sync ล็อก เพราะ backend ตรวจ `NO_LOTS`) · ลบโซน: เก็บโซนเดิมไว้รอบแรก sync ล็อกแล้วค่อยลบ (กัน `ZONE_IN_USE`) · สร้างงานแล้วขั้นต่อไปล้ม → ไปแก้งานที่สร้างแล้ว ไม่สร้างซ้ำ
- [x] `MyEventsPage` → `GET /organizer/events` + ล็อกที่ขาย/รายได้จาก `/summary` ต่องาน
- [x] `MapEditorPage`: type `PublicEvent` · วันเปิด/ปิดรับจองส่งเป็นต้นวัน/ท้ายวันเวลาไทย (`+07:00`) · ช่อง `slipDeadlineMinutes` (2–10080) · บัญชีรับโอนงานใหม่เติมจาก `me.payment` (F32) · ล็อกที่มีการจอง (HELD/BOOKED จาก `/lots`) ห้ามลบ/เลื่อนรหัส + ล็อกวันงาน · ข้อความ `LOT_IN_USE` / `VALIDATION_ERROR` จาก backend
- [x] ปิดรับจองผ่าน `POST /close` พร้อมยืนยัน · งานที่ปิดแล้วแก้ไม่ได้ (`EVENT_CLOSED`) → หน้าแสดงแบบดูอย่างเดียว · ตัดปุ่ม "เปิดงานอีกครั้ง" (backend ไม่รองรับ)
- [x] ตัด `DayPricingTable`, สวิตช์ `autoApprove` (F16) · ตารางโซน/สรุปใช้ราคาต่อล็อกทั้งงาน (I2)
- [x] backend บังคับสถานที่และบัญชีรับโอนตั้งแต่ฉบับร่าง → หน้าเว็บตรวจก่อนบันทึก
- [x] ทดสอบในเบราว์เซอร์กับ API จำลอง: สร้างงาน (ผังมาตรฐาน 42 ล็อก, สลิป 2 นาที) → บันทึกร่าง → เผยแพร่ (ขึ้น `GET /events`) → ลบโซน C ทั้งโซน → บันทึก (เหลือ 36 ล็อก A/B) → ผู้ขายจอง A01 → ลบ A01 ถูกกัน + วันงานล็อก → ปิดรับจอง → ดูอย่างเดียว · `npm run build` + `lint` ผ่าน
- [ ] ยังไม่ได้ไฮไลต์ล็อกบนผังเมื่อได้ `LOT_IN_USE` (แสดงรหัสล็อกใน toast แทน — หน้าเว็บกันไว้ก่อนแล้วจากสถานะ `/lots`)

### เฟส 5 ✅
- [x] `api/bookings.ts` (`POST /bookings`, `GET /bookings/me`, slip-url, อัปโหลด `FormData` ตรงไป S3, `POST /slip`, `GET /slip`, `POST /cancel`) + `queries/bookings.ts` + `sellerBookingFromDto` → type `SellerBooking` / `BookingUiStatus` (เพิ่ม `awaiting_slip`, `expired`)
- [x] ร่างการจอง (งาน + ล็อก) ย้ายจาก store เดิมไป `sessionStorage` (`services/bookingDraft.ts`) ล้างเมื่อออกจากระบบ
- [x] หน้าผัง: เปิดปุ่มจองกลับมา · โควตาหักล็อกที่ร้านถือไว้แล้ว (รอสลิป/รอตรวจ/อนุมัติ) จาก `/bookings/me`
- [x] หน้าข้อมูลร้าน → `POST /bookings` แล้วไป `/booking/payment/:groupId` · `LOT_NOT_AVAILABLE` → กลับผังพร้อมล็อกที่ยังว่าง · `QUOTA_EXCEEDED` / `BOOKING_CLOSED` แจ้งแล้วกลับผัง
- [x] หน้าแนบสลิป: นับถอยหลังจาก `expiresAt` · ไฟล์ jpg/png/pdf ≤ 5 MB · `BOOKING_EXPIRED` → แจ้งให้จองใหม่ · สลิปเดียวต่อชุด
- [x] หน้าส่งแล้ว / การจองของฉัน (route ใช้ `groupId`) · แท็บสถานะใหม่ · ตั๋วบอกล็อกที่จองพร้อมกัน, ย้ายล็อก, เหตุผล · ปุ่มแนบสลิป (นับถอยหลัง) / ดูสลิป / ยกเลิก / QR (`bookingId`)
- [x] F31 `BookingSummary`: ยอด = ราคาโซน ไม่มีค่าไฟ/ค่าธรรมเนียม (ไฟ 15A เป็นข้อมูลให้ผู้จัดงาน)
- [x] สถิติร้านในหน้าร้านของฉันคำนวณจาก `/bookings/me` + `/events`
- [x] ทดสอบในเบราว์เซอร์กับ API จำลอง: token เก่าหลังรีสตาร์ต API ถูกล้างเงียบ · กดจอง A01+A02 → ล็อกอินผู้ขาย → ข้อมูลร้านเติมจากโปรไฟล์ ยอด ฿1,000 → จอง → นับถอยหลัง 24 ชม. → ไฟล์ 6 MB ถูกปฏิเสธ → แนบ PNG → ส่งสลิปแล้ว (slip-url → moto → slip) → การจองของฉัน รอตรวจ ×2 + ดูสลิปได้ → ยกเลิก A02 → ผังโควตาเหลือ 1 ล็อก → ร่างที่มีล็อกถูกจองแล้ว → แจ้ง + กลับผังพร้อมล็อกที่เหลือ
- [x] ทดสอบหมดเวลา: งาน `slipDeadlineMinutes: 2` จองแล้วไม่แนบสลิป → เลยเวลา `GET /lots` คืนล็อกเป็นว่าง (fallback) → การจองของฉันแสดง "หมดเวลา" · `/_dev/expire` กวาดแล้วไม่เหลือค้าง
- [x] `npm run build` + `lint` ผ่าน

### เฟส 6 ✅
- [x] `api/organizer.ts` เพิ่ม `GET /events/{id}/bookings`, approve `{newLotId?}`, reject `{reason}`, cancel `{reason}`, check-in, `GET /organizer/vendors` · `organizerBookingFromDto` → type `OrganizerBooking` (`SellerBooking` + `sellerId`, `productDescription`, `checkedInAt`) · `vendorFromDto`
- [x] `queries/organizer.ts`: `useOrganizerBookings` (API ให้ทีละงาน จึงโหลดทุกงานที่ไม่ใช่ฉบับร่างพร้อมกัน), `useVendors`, `useApproveBooking` / `useRejectBooking` / `useCancelBookingAsOrganizer` / `useCheckIn` → invalidate `['events', id]` (การจอง ล็อก สรุป) + `['organizer','vendors']`
- [x] `useBookingDecisions` async: แจ้งผล/ error เอง (mutation `silentError`) · อนุมัติหลายรายการทีละรายการแล้วสรุปครั้งเดียว
- [x] `BookingsPage`: แท็บสถานะใหม่ (รอแนบสลิป, หมดเวลา แสดงเมื่อมีรายการ) · คอลัมน์งานแสดงช่วงวันแทนวันที่จอง (F11) · ป้าย "เช็กอินแล้ว"
- [x] `BookingDrawer`: ผังย่อจาก `/lots` จริง · ย้ายไปล็อกที่ว่าง (`AVAILABLE`) · สลิปจริงจาก `GET /bookings/{id}/slip` (รูปแสดงในหน้า PDF เปิดแท็บใหม่) · ล็อกที่จองพร้อมกันในชุด · ปุ่มเช็กอินเฉพาะวันงาน · ตัดยอดในสลิป/ชื่อไฟล์จำลอง (backend ไม่มีข้อมูลนี้)
- [x] `OverviewPage`: ตัวเลขจาก `/summary` (ล็อกที่ขาย, ยอดเดือนนี้/เดือนก่อนตามเดือนที่เริ่มงาน) + `/lots` (`ZoneFillBars`) · ตัดกราฟการจองรายวัน (D1) แทนด้วยกล่อง **เช็กอินหน้างาน** (`CheckInPanel`): สแกน/พิมพ์รหัสการจอง หรือค้นหาล็อก/ร้านของงานที่จัดวันนี้แล้วกดเช็กอิน
- [x] `VendorsPage` → `GET /organizer/vendors` (F28) · ป้ายนับคำขอรออนุมัติในเมนูผู้จัดงานใช้ API
- [x] แก้ `dateTimeLabel`: เวลาจาก backend เป็น UTC (`Z`) แปลงเป็นเวลาเครื่องก่อนแสดง (เดิมเพี้ยน 7 ชม. ทั้งหน้าผู้ขายและผู้จัดงาน)
- [x] ทดสอบในเบราว์เซอร์กับ API จำลอง: ผู้ขาย 4 ร้าน (จอง 2 ล็อกสลิปเดียว, รอสลิป 1) → ดูสลิปใน drawer → ย้าย A01 → A04 แล้วอนุมัติ (ประวัติย้าย + toast) → ไม่อนุมัติ B02 พร้อมเหตุผล → อนุมัติที่เลือก 2 รายการ → ยกเลิก B01 หลังอนุมัติ → ภาพรวม 2/12 ล็อก, โซน A 33% · เช็กอินก่อนวันงาน → "เช็กอินได้เฉพาะวันที่จัดงาน" · งานที่จัดวันนี้ → ค้นหา A05/ชื่อร้านแล้ว Enter → เช็กอินสำเร็จ "มาแล้ว 1 จาก 1 ร้าน" · หน้าผู้ขาย 4 ครั้ง ฿2,000
- [x] `npm run build` + `lint` ผ่าน
- [ ] สแกน QR ด้วยกล้องยังไม่มี (QR ของผู้ขายเป็นลายจำลองจาก `QrCode.tsx`) — ใช้เครื่องสแกนที่พิมพ์เป็นข้อความ หรือพิมพ์รหัส/ค้นหาร้านแทน
- [ ] drawer ไม่มีชื่อเจ้าของร้าน/เบอร์โทร เพราะการจองไม่ได้เก็บไว้ (เดิมมาจากข้อมูลจำลอง) — ถ้าต้องการ backend ต้องเก็บ snapshot ติดต่อผู้ขายตอนจอง

### เฟส 7 ✅
- [x] `api/admin.ts` (`GET /admin/users`, `/admin/organizers`, approve/reject ผู้จัดงาน, suspend/unsuspend, `GET /admin/events`) + `queries/admin.ts` (`useAdminUsers`, `useAdminEvents`, `useReviewOrganizer`, `useSetSuspended`)
- [x] `OrganizerApprovalsPage`: รายชื่อผู้จัดงานจาก `GET /admin/users` (ทุกสถานะในครั้งเดียว กรองแท็บในหน้า) · ตัวเลขสรุปจากผู้ใช้ + `bookingCount` ของ `/admin/events` · ตัดปุ่ม "อนุมัติแทน" ของบัญชีที่ไม่อนุมัติแล้ว (backend อนุมัติได้เฉพาะ PENDING) · ตัดป้าย "ยังไม่ยืนยันอีเมล" (ผู้ใช้อยู่ในตารางหลังยืนยันแล้วเท่านั้น)
- [x] `UserPage` → `GET /admin/users` + ระงับ / ยกเลิกระงับ (F9) · `AllEventsPage` → `GET /admin/events` (คอลัมน์ล็อกที่ขายเปลี่ยนเป็นการจองที่ใช้งานอยู่ เพราะ API ไม่ส่งจำนวนล็อก) · ป้ายนับผู้สมัครรออนุมัติในเมนู Admin ใช้ API
- [x] `api/notifications.ts` + `queries/notifications.ts`: poll `GET /notifications` ทุก `POLL_SECONDS` (30 วิ) key แยกตามผู้ใช้ · อ่านแล้ว `POST /notifications/read` (`ids` / `all`) ติ๊กบนจอทันที (F18)
- [x] `NotificationBell` ใช้ `items` + `unreadCount` จาก backend · ลิงก์: ใช้ `link` ที่ backend ส่ง ไม่มีก็สร้างจากประเภท + บทบาท + `bookingId`/`eventId` (ผู้ขาย → `/my-bookings`, ผู้จัดงาน → `/organizer/bookings?…&id=`)
- [x] `NotificationType` + ไอคอน: `booking_slip_uploaded`, `booking_expired`, `account_unsuspended` (F23, F30)
- [x] `NotificationWatcher` (ใน `App`) poll ตลอดที่ล็อกอินอยู่ รวมหน้ารออนุมัติที่ไม่มีกระดิ่ง · ได้ `organizer_approved` / `organizer_rejected` / `account_unsuspended` ใหม่ → โหลด `/me` ใหม่ → AuthProvider ขอ token ใหม่เมื่อสถานะเปลี่ยน (F7)
- [x] `npm run build` + `lint` ผ่าน · เปิดหน้า Admin ทั้ง 3 หน้ากับ API จำลองแล้วแสดงข้อมูลได้ ไม่มี error ใหม่ · กระดิ่ง poll `/notifications` ได้ 200
- [x] ทดสอบ flow ในเบราว์เซอร์กับ API จำลอง (2026-10-28): อนุมัติ org2 / ไม่อนุมัติ org3 พร้อมเหตุผล · ระงับผู้ขาย → `/me` 403 + ล็อกอินขึ้น "บัญชีนี้ถูกระงับ" → ยกเลิกระงับ → ล็อกอินได้ + แจ้งเตือน `account_unsuspended` · ผู้จัดงานรออนุมัติเห็นแดชบอร์ดเองใน 24 วิ · กดแจ้งเตือน `organizer_approved` → `/organizer` และถูกติ๊กอ่าน · Admin "อ่านทั้งหมด" → `unreadCount` 0 · หน้างานทั้งหมดแสดงการจองที่ใช้งาน/ยอดอนุมัติตรงกับ `/summary`
- [x] **ผู้ขายไม่มีกระดิ่งแจ้งเตือน**: `UserLayout` ไม่มี `NotificationBell` (มีแค่ `DashboardLayout` ของผู้จัดงาน/Admin) → เพิ่มแล้ว (F34)

### เฟส 8 ✅
- [x] เอา `AppProvider` ออกจาก `App.tsx` · `AuthProvider` เลิกใช้ `syncProfile`/`setDraft` ของ store เดิม · `UserLayout` นับป้าย "การจองของฉัน" จาก `GET /bookings/me` (รอแนบสลิป + รออนุมัติ)
- [x] ลบ `store/AppProvider.tsx`, `store/appContext.ts`, `hooks/useAppStore.ts`, `services/{seed,notifications,selectors,profileBridge}.ts`, `utils/sha256.ts`, `data/{accounts,bookings,events,shops,organizers,notifications}.ts`, `components/organizer/DailyBarChart.tsx` (`DayPricingTable` ลบไปแล้วในเฟส 4)
- [x] `lotLimitReached` / `lotLimitLabel` ย้ายไป `services/events.ts` · `services/auth.ts` ตัด `hashPassword` / `accountProfile` · `utils/pricing.ts` เหลือ `zoneOf`, `lotZoneId` (ตัดค่าไฟ/ค่าธรรมเนียม/ราคารายวัน — I2, D1)
- [x] `types.ts` ตัด `MarketEvent`, `EventRecord`, `EventDay(Record)`, `Booking`, `Organizer`, `BookingDraft` และฟิลด์จำลองใน `Account` (`passwordHash`, `emailVerified`, `shopId`, `organizerId`) · `data/settings.ts` ตัด `FEES`, `WEEKEND_SURCHARGE`, `chartDays`
- [x] `main.tsx` ลบ key `bookmybooth-data-v1` / `bookmybooth-session` ที่ค้างใน `localStorage`
- [x] `npm run build` + `lint` ผ่าน · ไม่มี import จาก `data/*` ที่เป็นข้อมูลจำลองเหลือ · เปิดหน้า Admin และการจองของผู้ขายกับ API จำลองได้
- [x] ไล่ checklist INTEGRATION-PLAN หัวข้อ 6 ครบ 11 ข้อกับ API จำลอง (2026-10-28) ผ่านทุกข้อ · หมายเหตุ: ข้อ 8 กรณีก่อนวันงานทดสอบผ่าน API (`409 NOT_EVENT_DAY`) · ข้อ 5 ทดสอบ PNG + PDF + ไฟล์ 6 MB ยังไม่ได้ลอง JPG · การจองชน (ข้อ 4) ใช้การจองผ่าน API ของผู้ขายเดโมแย่งล็อกก่อนกดส่ง
- [ ] ไล่ checklist หัวข้อ 6 ซ้ำกับ AWS (เฟส 9)

### D7 — 1 การจอง = 1 ชุด ✅ (2026-10-28)
- [x] `domain/booking`: `approve_items` / `release_items` รับทั้งชุด (โควตา −N update เดียว), `check_in_items`, `FINAL`
- [x] `functions/bookings`: approve `{moves}` (ตรวจล็อกเดิมอยู่ในชุด, ปลายทางว่าง, ไม่ซ้ำ `DUPLICATE_LOT`) · reject / cancel (ผู้ขาย + ผู้จัดงาน) / check-in ทั้งชุด · ข้ามสมาชิกที่จบแล้ว (ชุดเก่าก่อน D7) · ตอบ `{groupId, bookings}` · แจ้งเตือนครั้งเดียวต่อชุด
- [x] `domain/vendors.seller_stats` นับตามชุด · `messages.booking_moved` รับหลายล็อก · `ApproveInput.moves`
- [x] เทสต์ใหม่ 9 ตัว (ย้ายบางล็อก, แจ้งเตือนครั้งเดียว, ย้ายซ้ำปลายทาง, ปฏิเสธ/ยกเลิก/เช็กอินทั้งชุด, ชุดที่บางล็อกจบแล้ว, สถิตินับตามชุด) · แก้ test_flow — pytest 161 ผ่าน, ruff ผ่าน
- [x] Frontend (F35): `groupBookings` + type `BookingGroup` · การจองของฉัน 1 ตั๋วต่อชุด + ยกเลิกทั้งชุด · หน้าตรวจการจอง/ภาพรวม/เช็กอิน 1 แถวต่อชุด · drawer เลือกล็อกที่จะย้ายในชุด + ผังย่อไฮไลต์ทุกล็อก · tsc + lint ผ่าน
- [x] ทดสอบในเบราว์เซอร์กับ API จำลอง: ตั๋ว "A01, A02 · 2 ล็อก · สลิปเดียว ฿1,000" → ผู้จัดงานย้าย A02 → A05 แล้วอนุมัติทั้งชุด (A01, A05 BOOKED, A02 ว่าง) → ไม่อนุมัติชุด B01, B02 (ว่างทั้งคู่) → ผู้ขายยกเลิกชุด B03, B04 · มือถือ 375 px ไม่ล้นจอ
- [ ] ยังไม่ได้กดในเบราว์เซอร์: เช็กอินทั้งชุด (ไม่มีงานที่จัดวันนี้) และผู้จัดงานยกเลิกหลังอนุมัติ — มีเทสต์ backend แล้ว
- [x] หมดเวลาทั้งชุด: `booking_ops.expire` หมดเวลาทุกล็อกในชุดที่เลยเวลาใน transaction เดียว + แจ้งเตือนครั้งเดียว (ใช้ทั้ง Scheduler, โหมดกวาด และ fallback) · `group_members` ย้ายไป `booking_ops` · เทสต์ใหม่ 2 ตัว — pytest 163 ผ่าน
- [x] F36 ไอคอนแจ้งเตือนเป็น SVG (`lucide-react`) แทนอิโมจิ ตรวจในเบราว์เซอร์ทั้งกระดิ่งผู้ขายและผู้จัดงาน · tsc + lint ผ่าน

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
- [ ] `scripts/race_test.py`: 5 request พร้อมกัน → `201` × 1, `409` × 4 (สคริปต์เขียนแล้ว 2026-10-28 ผ่านกับ API จำลอง · รอรันกับ AWS ตาม AWS-SETUP 11.1)
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
| I1 | เชื่อม frontend ก่อนขึ้น AWS | — | API จำลองในเครื่อง `scripts/local_api.py` แล้วสลับไป AWS (AWS-SETUP หัวข้อ 14) | 2026-10-28 |
| I2 | ยอดที่ผู้ขายโอน | — | ราคาโซนอย่างเดียว ตัดค่าไฟ/ค่าธรรมเนียมใน frontend | 2026-10-28 |
| I3 | บัญชีรับเงินตั้งต้นของผู้จัดงาน | — | เก็บ `payment` ในโปรไฟล์ แก้ผ่าน `PUT /me` | 2026-10-28 |
| I4 | ดึงข้อมูลใน frontend | — | TanStack Query | 2026-10-28 |
| D7 | 1 การจอง = ชุดล็อกที่จองพร้อมกัน (`groupId`) | ก่อนขึ้น AWS | เก็บ Booking ล็อกละ record เหมือนเดิม แต่ตัดสินทั้งชุด: route เดิม `/bookings/{id}/approve|reject|cancel|check-in` รับ `bookingId` ใดก็ได้ในชุดแล้วทำทุกล็อกใน transaction เดียว (หาชุดจาก GSI `bySeller` ไม่ต้องเพิ่ม route/GSI บน AWS) · approve ย้ายบางล็อกได้ `{moves}` · ผู้ขายยกเลิกทั้งชุดเท่านั้น · QR = `bookingId` ล็อกแรก เช็กอินทั้งชุด · หน้าเว็บแสดง 1 การ์ดต่อชุด · ✅ ทำแล้ว | 2026-10-28 |
| I5 | หน้า Admin ผู้ใช้/สรุป | — | route ใหม่ `GET /admin/users` + `GET /admin/events` เพิ่ม `bookingCount`, `revenue` | 2026-10-28 |

---

## งานฝั่ง Frontend

รายละเอียดแต่ละข้ออยู่ใน PLAN หัวข้อ 15 ติ๊กเมื่อ frontend แก้เสร็จ

| # | เรื่อง | สถานะ |
|---|---|---|
| F1 | เชื่อม Cognito (`aws-amplify/auth`) แทนบัญชีจำลอง | 🟨 `src/auth/cognitoAdapter.ts` เขียนแล้ว ทดสอบจริงตอนเฟส 9 (โหมด dev ผ่านแล้ว) |
| F2 | แนบ `Authorization: Bearer <accessToken>` | ✅ |
| F3 | อ่าน error `{ error: { code, message, details } }` | 🟨 `ApiError` + toast อัตโนมัติพร้อม (เฟส 1) หน้าจอใช้จริงตามเฟส |
| F4 | map ค่าสถานะตัวพิมพ์ใหญ่ | ✅ |
| F5 | ใช้ `userId` แทน accountId/shopId/organizerId | ✅ |
| F6 | สมัคร: `custom:role` + `clientMetadata` ตอน `confirmSignUp` | ✅ |
| F7 | `fetchAuthSession({ forceRefresh: true })` หลังได้รับอนุมัติ | ✅ refresh เมื่อสถานะใน `/me` เปลี่ยน + โหลด `/me` ใหม่เมื่อได้แจ้งเตือนสถานะบัญชี (`NotificationWatcher`) |
| F8 | หน้าโปรไฟล์ `GET/PUT /me` | ✅ |
| F9 | หน้า Admin + ปุ่มยกเลิกระงับใช้ `unsuspend` | ✅ |
| F10 | ฟอร์มงาน: ชื่อฟิลด์ใหม่, `startDate/endDate`, `slipDeadlineMinutes` | ✅ |
| F11 | ตัดการจองรายวัน (`days`, `surcharge`, `lotState` รายวัน) | ✅ ลบ `MarketEvent` และราคารายวันแล้ว (เฟส 8) |
| F12 | `PUT /events/{id}/lots` หลังบันทึกผัง | ✅ |
| F13 | เผยแพร่ด้วย `publishStatus: "OPEN"` / ปิดด้วย `/close` | ✅ |
| F14 | รายการงานสาธารณะ / `GET /organizer/events` | ✅ |
| F15 | หน้าสรุปงาน `GET /events/{id}/summary` | ✅ ภาพรวม + งานของฉัน |
| F16 | ซ่อนสวิตช์ `autoApprove` (D5a) | ✅ ลบออกจากตัววาดผังพร้อม `DayPricingTable` |
| F17 | จองหลายล็อก `POST /bookings` `lotIds[]` + รับมือ error | ✅ |
| F18 | poll แจ้งเตือน (หลัง backend สัปดาห์ 10) | ✅ poll ทุก 30 วิ |
| F19 | แนบสลิปทีหลัง: slip-url → FormData ไป S3 → slip (สลิปเดียวต่อชุด) | ✅ (ทดสอบกับ moto · S3 จริงเฟส 9) |
| F20 | ดูสลิป `GET /bookings/{id}/slip` | ✅ ผู้ขาย + ผู้จัดงาน (drawer) |
| F21 | การจองของฉัน `GET /bookings/me` + สถานะรอสลิป/หมดเวลา | ✅ |
| F22 | ผู้ขายยกเลิก `POST /bookings/{id}/cancel` | ✅ |
| F23 | ประเภทแจ้งเตือนใหม่ `booking_slip_uploaded`, `booking_expired` | ✅ |
| F24 | หน้าตรวจการจอง `GET /events/{id}/bookings?status=` | ✅ |
| F25 | อนุมัติ / ย้ายล็อก `POST /bookings/{id}/approve {newLotId?}` | ✅ |
| F26 | ปฏิเสธ / ยกเลิกหลังอนุมัติ พร้อมเหตุผล | ✅ |
| F27 | เช็กอิน QR: QR จาก `bookingId` + `POST /bookings/{id}/check-in` | ✅ QR ของผู้ขายเป็น `bookingId` · ผู้จัดงานเช็กอินด้วยรหัส/ค้นหาร้าน (ยังไม่มีสแกนด้วยกล้อง) |
| F28 | VendorsPage ใช้ `GET /organizer/vendors` | ✅ |
| F29 | โปรไฟล์ร้าน `line`, `bio`, `power` ผ่าน `GET/PUT /me` | ✅ |
| F30 | แจ้งเตือน `account_unsuspended` | ✅ |
| F31 | ยอดเงิน = ราคาโซน (ตัดค่าไฟ/ค่าธรรมเนียม) | ✅ ฟังก์ชันคิดค่าไฟ/ค่าธรรมเนียมใน `utils/pricing.ts` ลบแล้ว (เฟส 8) |
| F32 | บัญชีรับเงินตั้งต้นในโปรไฟล์ผู้จัดงาน | ✅ |
| F33 | หน้า Admin ผู้ใช้/สรุปจาก `GET /admin/users`, `GET /admin/events` | ✅ ทำในเฟส 7 (`UserPage`, `OrganizerApprovalsPage`, `AllEventsPage`) |
| F35 | 1 การจอง = 1 ชุด (D7): การ์ด/แถวต่อชุด, approve `{moves}`, ยกเลิก/เช็กอินทั้งชุด | ✅ |
| F36 | ไอคอนแจ้งเตือนเป็น SVG (`lucide-react`) แทนอิโมจิ | ✅ |
| F34 | กระดิ่งแจ้งเตือนของผู้ขายใน `UserLayout` | ✅ ข้าง `AccountMenu` เมื่อล็อกอิน · ทดสอบกดแจ้งเตือน `booking_moved` → `/my-bookings` + มือถือ 375 px ไม่ล้นจอ |

---

## บันทึกการเปลี่ยนแปลง

| วันที่ | เรื่อง |
|---|---|
| 2026-10-28 | ปุ่มบัญชีเดโมบนเว็บที่ host: ตั้ง `VITE_DEMO_PASSWORD` (= `SEED_PASSWORD`) แล้วโหมด cognito แสดงปุ่ม 3 บทบาท (`DevAccountPicker`, `DEMO_ACCOUNTS` ใน `data/settings.ts`) |
| 2026-10-28 | เขียน `AWS-SETUP.md` ใหม่แบบละเอียด: ก่อนเริ่ม (ไม่ต้องใช้ VPN/VPC, ห้ามผูก VPC ให้ Lambda, เครื่องมือ, เปิด Lab, ใบจดค่า), ขั้นตอนใน Console ทีละช่อง, ทดสอบหลังแต่ละขั้น, Amplify 2 ทาง (GitHub / Deploy without Git) + `amplify.yml` + rewrite + `VITE_AUTH_MODE=cognito`, credentials ของ Lab สำหรับ seed, race test · เพิ่ม `scripts/race_test.py` (ผ่านกับ API จำลอง) · route เรียงเลขใหม่ 1–32 |
| 2026-10-28 | หน้าเว็บเลิกบอกว่า "ระบบคืนเงินภายใน 3 วันทำการ" เปลี่ยนเป็นผู้จัดงานคืนเงินเองนอกระบบ ตาม scope (`POLICY.refundNote` แทน `refundBusinessDays`) |
| 2026-10-28 | ปรับ `BookMtBooth-scope.md` ให้ตรงกับที่ทำจริง: ผังกริดคลิกเลือก, จองหลายล็อก = 1 ชุด, เช็กอิน QR, สถิติร้าน, Admin ผู้ใช้/ยกเลิกระงับ, สร้าง resource ใน Console แทน SAM, API 32 route, นอกขอบเขตใหม่ (คืนเงินนอกระบบ, จองรายวัน, อนุมัติอัตโนมัติ, ภาพผัง, สแกนด้วยกล้อง), แผนงานตามจริง |
| 2026-10-28 | หมดเวลาทั้งชุด แจ้งเตือนครั้งเดียว · F36 ไอคอนแจ้งเตือน SVG · 163 tests ผ่าน |
| 2026-10-28 | D7 ✅ 1 การจอง = 1 ชุด: อนุมัติ (ย้ายบางล็อกได้) / ปฏิเสธ / ยกเลิก / เช็กอินทั้งชุดผ่าน route เดิม · สถิติร้านนับตามชุด · frontend รวมตาม `groupId` (F35) · 161 tests ผ่าน |
| 2026-10-28 | F34 ✅ เพิ่มกระดิ่งแจ้งเตือนฝั่งผู้ขายใน `UserLayout` · build/lint ผ่าน |
| 2026-10-28 | ทดสอบในเบราว์เซอร์กับ API จำลอง: flow Admin เฟส 7 + checklist INTEGRATION-PLAN หัวข้อ 6 ครบ 11 ข้อ ผ่านทั้งหมด · พบผู้ขายไม่มีกระดิ่งแจ้งเตือน (`UserLayout`) |
| 2026-10-28 | ติ๊ก F33 ✅ (ทำไปแล้วในเฟส 7 แต่ลืมอัปเดตตาราง) |
| 2026-10-28 | ทำ INTEGRATION-PLAN เฟส 8 เสร็จ: เอา store/ข้อมูลจำลองออกทั้งหมด (`AppProvider`, seed, `data/*` จำลอง, selectors, sha256) · ตัด type/ค่าตั้งค่าที่ไม่ใช้ · ล้าง key เดิมใน `localStorage` · build/lint ผ่าน |
| 2026-10-28 | ทำ INTEGRATION-PLAN เฟส 7 เสร็จ (โค้ด + build/lint + เปิดหน้าได้ ยังไม่ได้กดทดสอบ flow): หน้า Admin 3 หน้าใช้ API · กระดิ่ง poll `/notifications` · โหลด `/me` ใหม่เมื่อสถานะบัญชีเปลี่ยน · F7, F9, F18, F23, F30 ✅ |
| 2026-10-28 | ทำ INTEGRATION-PLAN เฟส 6 เสร็จ: ตรวจการจอง (อนุมัติ/ย้าย/ไม่อนุมัติ/ยกเลิก/อนุมัติหลายรายการ) ดูสลิปจริง เช็กอินหน้างาน ภาพรวมจาก `/summary` และสถิติร้านจาก `/organizer/vendors` · แก้เวลา UTC แสดงเพี้ยน · F15, F20, F24–F28 ✅ |
| 2026-10-28 | ทำ INTEGRATION-PLAN เฟส 5 เสร็จ: จองหลายล็อก → แนบสลิปไป S3 → รอตรวจ · การจองของฉัน/ยกเลิก/ดูสลิป · ร่างการจองย้ายไป `sessionStorage` · F17, F19, F21, F22, F31 ✅ |
| 2026-10-28 | ทำ INTEGRATION-PLAN เฟส 4 เสร็จ: ตัววาดผัง/งานของฉันใช้ API (สร้าง แก้ sync ล็อก เผยแพร่ ปิดรับจอง) · ตัด `DayPricingTable`/`autoApprove` · F10, F12, F13, F14, F16, F32 ✅ |
| 2026-10-28 | ทำ INTEGRATION-PLAN เฟส 3 เสร็จ: หน้าดูงาน/ผังของผู้ขายใช้ `GET /events*` · type `PublicEvent` ไม่มีราคารายวัน · ปุ่มจองปิดชั่วคราวถึงเฟส 5 · แนะนำทำเฟส 5 ต่อก่อนเฟส 4 (ไม่ขึ้นกัน) |
| 2026-10-28 | ทำ INTEGRATION-PLAN เฟส 2 เสร็จ: `src/auth/*` (dev + cognito adapter), `AuthProvider` async จาก `GET /me`, หน้าโปรไฟล์ใช้ `PUT /me` · `local_api.py` เพิ่ม `POST /_dev/reset-password` และข้อความ `User is disabled.` แบบ Cognito · F2, F6, F8, F29 ✅ |
| 2026-10-28 | ทำ INTEGRATION-PLAN เฟส 1 เสร็จ: TanStack Query, `api/client.ts`, DTO, mappers, toast error (F3) · หน้าแรกต่อ `/health` ของ API จำลองได้ · `.claude/launch.json` เพิ่ม `local-api` |
| 2026-10-28 | ทำ INTEGRATION-PLAN เฟส 0 เสร็จ: `scripts/local_api.py` (API จำลอง + moto server), `payment` ในโปรไฟล์ผู้จัดงาน, `GET /admin/users`, `/admin/events` มี `status`/`bookingCount`/`revenue` · แก้ F8, F9, F32, F33 · 151 tests ผ่าน |
| 2026-10-27 | ปรับ scope ให้ใช้ Amplify Hosting + Cognito บน Learner Lab, ตัด CloudFront |
| 2026-10-27 | เขียน PLAN.md และเปลี่ยนหลังบ้านจาก Node.js เป็น Python 3.13 |
| 2026-10-27 | สร้างไฟล์ติดตามความคืบหน้านี้ |
| 2026-10-28 | เขียน `INTEGRATION-PLAN.md` (เฟส 0–9) · ตัดสิน I1–I5 · AWS-SETUP เพิ่มหัวข้อ 14 ย้ายจาก API จำลองไป AWS และ route `GET /admin/users` · เพิ่ม F31–F33 |
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
