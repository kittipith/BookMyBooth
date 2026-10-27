# BookMyBooth — แผนเชื่อม Frontend กับ Backend

> เขียน 2026-10-28 · Backend โค้ดครบสัปดาห์ 1–10 แล้ว (141 tests) แต่ยังไม่ขึ้น AWS
> อ้างอิง: [Backend/PLAN.md](Backend/PLAN.md) (หัวข้อ 15 = งานฝั่ง frontend F1–F32) · [AWS-SETUP.md](AWS-SETUP.md) · ติดตามความคืบหน้าใน [Backend/PROGRESS.md](Backend/PROGRESS.md) หัวข้อ "งานฝั่ง Frontend"

---

## 1. สภาพตอนนี้

| | Frontend | Backend |
|---|---|---|
| ข้อมูล | เก็บทั้งหมดใน `localStorage` (`store/AppProvider.tsx` + `services/seed.ts`) | DynamoDB / S3 / Cognito ผ่าน Lambda 6 ตัว |
| ล็อกอิน | บัญชีจำลอง + hash รหัสผ่านในเครื่อง, OTP แสดงบนจอ (`store/AuthProvider.tsx`) | Cognito + JWT authorizer |
| action | synchronous คืนผลทันที (`submitBooking`, `approveBooking`, ...) | HTTP API แบบ async, error เป็น `{ error: { code, message, details } }` |
| คำนวณ | สถานะงาน/ล็อก, ยอดเงิน, สถิติร้าน คำนวณในเครื่อง (`services/selectors.ts`, `utils/pricing.ts`) | backend คำนวณแล้วส่งมา (`status`, `amount`, summary, vendors) |
| แจ้งเตือน | สร้างเองใน action แต่ละตัว | backend สร้างให้ทุกเหตุการณ์ หน้าเว็บแค่ poll |

งานหลักจึงเป็น **การเปลี่ยนชั้นข้อมูลทั้งชั้น** จาก store ในเครื่อง เป็น API + cache โดยพยายามให้หน้าจอ (pages/components) เปลี่ยนน้อยที่สุด

---

## 2. การตัดสินใจ (2026-10-28)

| # | เรื่อง | ผล |
|---|---|---|
| I1 | เชื่อมก่อนขึ้น AWS | **ทำ API จำลองในเครื่องก่อน** (`Backend/scripts/local_api.py`) แล้วค่อยสลับไป AWS ตอนสัปดาห์ 11 · สิ่งที่ต้องเปลี่ยนตอนสลับเขียนไว้ใน [AWS-SETUP.md](AWS-SETUP.md) หัวข้อ 14 |
| I2 | ยอดที่ผู้ขายต้องโอน | **ราคาโซนอย่างเดียว** ตาม scope — frontend ตัดค่าไฟ 50 บาท/วัน และค่าธรรมเนียมระบบ 20 บาทออก (F31) `power` ยังเก็บเป็นข้อมูลให้ผู้จัดงานรู้ |
| I3 | บัญชีรับเงินตั้งต้นของผู้จัดงาน | **เก็บในโปรไฟล์ด้วย** — backend เพิ่ม `payment` ในฟิลด์ที่ผู้จัดงานแก้ได้ผ่าน `PUT /me` (B2) งานยังเก็บบัญชีของตัวเองเหมือนเดิม (F32) |
| I4 | ดึงข้อมูลใน frontend | **TanStack Query** (`@tanstack/react-query`) จัดการ cache, loading/error, refetch หลังแก้ และ poll แจ้งเตือน |
| I5 | หน้า Admin | **เพิ่ม route `GET /admin/users`** (ใหม่ 1 ตัว อนุมัติแล้ว) และให้ `GET /admin/events` คืน `bookingCount`, `revenue` ต่องาน (B3) |

---

## 3. สถาปัตยกรรมหลังเชื่อม

```
pages / components  (เปลี่ยนน้อยที่สุด)
      │  ใช้ hooks
      ▼
src/queries/*.ts      ← TanStack Query: useEvents(), useMyBookings(), useApproveBooking() ...
      │
      ▼
src/api/*.ts          ← ฟังก์ชันเรียกแต่ละ endpoint + mapper แปลง DTO ↔ type เดิมของหน้าจอ
      │
src/api/client.ts     ← fetch + base URL + แนบ token + แปลง error เป็น ApiError
      │
src/auth/             ← AuthAdapter: dev (API จำลอง) | cognito (aws-amplify)  เลือกด้วย VITE_AUTH_MODE
      ▼
VITE_API_URL  =  http://localhost:3001 (API จำลอง)  หรือ  Invoke URL ของ API Gateway (AWS)
```

### 3.1 ไฟล์ใหม่ฝั่ง frontend
| ไฟล์ | หน้าที่ |
|---|---|
| `src/config.ts` | อ่าน `VITE_API_URL`, `VITE_AUTH_MODE` (`dev` / `cognito`), `VITE_USER_POOL_ID`, `VITE_USER_POOL_CLIENT_ID`, `VITE_REGION` |
| `src/api/client.ts` | `apiFetch(method, path, body?)` แนบ `Authorization: Bearer <token>` เมื่อล็อกอินอยู่, แปลงคำตอบที่ไม่ใช่ 2xx เป็น `ApiError { status, code, message, details }` · 401 → เรียก `onUnauthorized` (เปิด popup ล็อกอิน) |
| `src/api/dto.ts` | type ของ JSON ที่ backend ส่ง (สถานะตัวพิมพ์ใหญ่, `userId`, `lotId`, `expiresAt` ...) |
| `src/api/mappers.ts` | แปลง DTO → type เดิมใน `types.ts` (F4): สถานะ, `lotId→lot`, `createdAt→submittedAt`, `userId→id` ฯลฯ ให้หน้าจอเดิมใช้ต่อได้ |
| `src/api/{events,bookings,admin,me,notifications}.ts` | ฟังก์ชันต่อ endpoint ตาม PLAN หัวข้อ 6 |
| `src/auth/adapter.ts` | interface: `signUp`, `confirmSignUp(email, code, profile)`, `resendCode`, `signIn`, `signOut`, `forgotPassword`, `confirmForgotPassword`, `getAccessToken`, `refreshSession` |
| `src/auth/cognitoAdapter.ts` | ใช้ `aws-amplify/auth` (ส่งโปรไฟล์ใน `clientMetadata` ตอน `confirmSignUp`) |
| `src/auth/devAdapter.ts` | คุยกับ endpoint `/_dev/*` ของ API จำลอง (ไม่มีรหัส OTP จริง) |
| `src/queries/*.ts` | hook ของ TanStack Query แยกตามหน้าที่ + key กลาง (`queryKeys.ts`) |

### 3.2 ไฟล์เดิมที่จะเลิกใช้ (ลบในเฟส 8)
`store/AppProvider.tsx`, `store/appContext.ts`, `services/seed.ts`, `services/notifications.ts`, `services/auth.ts` (ส่วน hash/OTP), ส่วนคำนวณใน `services/selectors.ts` ที่ backend ทำแทน, `utils/sha256.ts`, `data/accounts.ts`, `data/bookings.ts`, `data/events.ts`, `data/shops.ts`, `data/organizers.ts`, `data/notifications.ts` (ข้อความมาจาก backend), `components/organizer/editor/DayPricingTable.tsx`, `components/organizer/DailyBarChart.tsx` (การจองรายวันถูกตัด D1)

---

## 4. API จำลองในเครื่อง (`Backend/scripts/local_api.py`)

ให้ frontend ต่อกับ **โค้ด backend จริง** ได้ตั้งแต่ตอนนี้ โดยไม่สร้างอะไรบน AWS

| ส่วน | ทำอย่างไร |
|---|---|
| เซิร์ฟเวอร์ | `ThreadingHTTPServer` (Python stdlib) ที่ `localhost:3001` |
| AWS จำลอง | moto **server mode** (`ThreadedMotoServer` พอร์ต 5000) + ตั้ง `AWS_ENDPOINT_URL=http://localhost:5000` ให้ boto3 ทุกตัวชี้ไปที่ moto → presigned POST ของสลิปชี้มาที่ `localhost:5000` เบราว์เซอร์อัปโหลดได้จริง |
| ตาราง / bucket / user pool | สร้างจาก `tests/tables.py` + bucket + CORS + user pool + 3 groups ตอนเปิดเซิร์ฟเวอร์ แล้วรัน `seed_accounts` + `seed_event` (บัญชีเดโมและ `demo-event`) |
| เลือก Lambda | ตาราง route เดียวกับ AWS-SETUP ข้อ 6.1 → สร้าง event แบบ HTTP API v2 (เหมือน `tests/apigw.py`) → เรียก `lambda_handler` ของ function นั้น |
| route สาธารณะ / authorizer | route สาธารณะส่งต่อโดยไม่มี claims · route อื่นต้องมี `Authorization: Bearer dev.<userId>` → เซิร์ฟเวอร์ใส่ claims `{sub, cognito:groups}` (อ่าน group จาก Cognito จำลอง) เหมือนที่ JWT authorizer ทำ · ไม่มี token → 401 เหมือนของจริง |
| CORS | เซิร์ฟเวอร์ใส่ header CORS ให้ `http://localhost:5173` (บน AWS เป็นหน้าที่ของ API Gateway) |
| endpoint สำหรับ dev เท่านั้น | `GET /_dev/accounts` (บัญชีเดโมให้เลือกล็อกอิน) · `POST /_dev/sign-up` → เก็บผู้ใช้ไว้รอยืนยัน · `POST /_dev/confirm` `{email, code, profile}` → รัน PostConfirmation trigger จริงพร้อม `clientMetadata` · `POST /_dev/sign-in` `{email, password}` → คืน token `dev.<userId>` · `POST /_dev/expire` → รัน expire_booking โหมดกวาด (ทดสอบหมดเวลาโดยไม่ต้องมี Scheduler) |
| ข้อมูล | อยู่ในหน่วยความจำ ปิดเซิร์ฟเวอร์แล้วหาย เปิดใหม่ได้ข้อมูลเดโมชุดเดิม |
| ความปลอดภัย | ไฟล์อยู่ใน `scripts/` ซึ่ง **ไม่ถูกใส่ใน `lambda.zip`** (`build_zip.py` ใส่แค่ `src/`) โค้ดใน `src/` ไม่ต้องแก้และไม่มีทาง dev ติดขึ้น AWS |

### 4.1 endpoint `/_dev/*` (ทำแล้ว — ใช้ใน `src/auth/devAdapter.ts`)
error ใช้รูปแบบ `{ error: { code, message } }` โดย `code` เป็นชื่อ error ของ Cognito ให้ adapter แปลงเหมือน Amplify

| endpoint | body | ตอบ | error |
|---|---|---|---|
| `GET /_dev/accounts` | — | `{ items: [{ email, password, role, userId }] }` บัญชีเดโม (รหัสผ่าน `Passw0rd!`) | — |
| `POST /_dev/sign-up` | `{ email, password, role: "seller" \| "organizer" }` | `{ userId, userConfirmed: false }` | `UsernameExistsException`, `InvalidPasswordException` (≥ 8 ตัว มีพิมพ์เล็ก + ตัวเลข) |
| `POST /_dev/confirm` | `{ email, code, profile: { name, phone, orgName, category } }` (ไม่ตรวจ `code`) | `{ userId }` — รัน PostConfirmation จริง | `NotAuthorizedException` (ยืนยันไปแล้ว / ไม่มีผู้ใช้) |
| `POST /_dev/sign-in` | `{ email, password }` | `{ accessToken: "dev.<userId>", userId }` | `NotAuthorizedException` (รหัสผิด / ไม่มีผู้ใช้ · ถูกระงับ = message `User is disabled.` เหมือน Cognito), `UserNotConfirmedException` |
| `POST /_dev/reset-password` | `{ email, code, newPassword }` (ไม่ตรวจ `code`) | `{}` — ไม่มีผู้ใช้นี้ก็ตอบสำเร็จ | `InvalidPasswordException` |
| `POST /_dev/expire` | — | `{ expired: [bookingId...] }` | — |

token ไม่มีวันหมดอายุ (`refreshSession()` ในโหมด dev ไม่ต้องทำอะไร) และ group อ่านจาก Cognito จำลองทุก request จึงมีผลทันทีหลัง Admin อนุมัติ

รัน (ต้อง `pip install -r requirements-dev.txt` ที่มี `moto[server]`): `python scripts/local_api.py` (`--port`, `--moto-port` เปลี่ยนพอร์ตได้) แล้ว frontend ใช้ `.env.local`:
```
VITE_API_URL=http://localhost:3001
VITE_AUTH_MODE=dev
```

---

## 5. ขั้นตอน (เรียงตามลำดับ ทำทีละเฟสแล้วหน้าเว็บยังใช้งานได้ทุกเฟส)

แต่ละเฟสสลับหน้าจอกลุ่มหนึ่งจาก `useAppStore()` ไปใช้ API ส่วนหน้าที่ยังไม่ถึงคิวใช้ store เดิมไปก่อน

### เฟส 0 — Backend เตรียมให้ frontend ✅ (2026-10-28)
| # | งาน | ไฟล์ |
|---|---|---|
| B1 | API จำลองในเครื่อง (หัวข้อ 4) + เทสต์ว่าเปิดได้และเรียก `/health`, `/_dev/sign-in`, `/events` ได้ | `Backend/scripts/local_api.py`, `Backend/tests/test_local_api.py` |
| B2 | ผู้จัดงานเก็บ `payment {bank, accountName, accountNo}` ในโปรไฟล์ (I3) | `domain/users.py` `EDITABLE_FIELDS`, `domain/schemas.py` `UpdateMeInput` |
| B3 | `GET /admin/users?role=` (route ใหม่) + `GET /admin/events` เพิ่ม `bookingCount`, `revenue` (I5) | `functions/admin/app.py` + AWS-SETUP 6.1 + PLAN หัวข้อ 6 |
| B4 | อัปเดต PLAN, PROGRESS, AWS-SETUP | — |

**เสร็จเมื่อ:** `pytest` ผ่าน, เปิด `local_api.py` แล้ว `curl localhost:3001/events` ได้ `demo-event`

### เฟส 1 — โครงพื้นฐาน frontend ✅ (2026-10-28)
> ทำแล้ว: `src/config.ts`, `src/vite-env.d.ts`, `src/api/{client,dto,mappers,errorReporter}.ts`, `src/queries/{queryClient,queryKeys,health}.ts`, `components/common/ApiErrorToaster.tsx` (F3), `components/common/ApiStatusBadge.tsx` (ชั่วคราว แสดงบนหน้าแรกเฉพาะ `npm run dev` ลบในเฟส 3), `.env.example` · ตรวจในเบราว์เซอร์กับ API จำลองแล้ว
> - `client.ts`: `setTokenProvider()` / `setUnauthorizedHandler()` ให้ auth adapter เฟส 2 มาเสียบ · error ที่ไม่ใช่ 2xx เป็น `ApiError` (status 0 = เชื่อมต่อไม่ได้) · 401 ไม่ขึ้น toast
> - toast อัตโนมัติจาก `QueryCache` / `MutationCache` ทุกตัว ถ้าหน้าจอแสดง error เอง (เช่น ใต้ฟอร์ม) ใส่ `meta: { silentError: true }`
> - `mappers.ts` มีแค่ตัวแปลงสถานะ + `accountFromDto` + `notificationFromDto` ตัวแปลงงาน/การจองเพิ่มในเฟสที่สลับหน้านั้น · สถานะการจองฝั่งหน้าจอเพิ่ม `awaiting_slip` (`PENDING_PAYMENT`) และ `expired` (`BookingUiStatus`) — `types.ts` ยังไม่เปลี่ยนจนถึงเฟส 5
> - `.claude/launch.json` เพิ่ม `local-api` เปิด API จำลองคู่กับ `frontend`
- เพิ่ม dependency: `@tanstack/react-query`, `aws-amplify`
- `src/config.ts`, `src/api/client.ts`, `src/api/dto.ts`, `src/api/mappers.ts`, `QueryClientProvider` ใน `main.tsx`
- `.env.example` (ค่าตัวอย่างทั้ง dev และ cognito) และ `.env.local` อยู่ใน `.gitignore` แล้ว
- F3 แสดง error จาก `ApiError.message` ผ่าน toast เดิม (`useToast`)
- **เสร็จเมื่อ:** หน้าแรกเรียก `GET /health` ผ่าน client ได้ (ชั่วคราว) `npm run build` และ `npm run lint` ผ่าน

### เฟส 2 — ล็อกอิน / สมัคร / บัญชี (F1, F2, F5, F6, F7, F8) ✅ (2026-10-28)
> ทำแล้ว: `src/auth/*`, `AuthProvider` ใหม่ (async, `me` จาก `GET /me`), ฟอร์ม auth รอผล + loading, หน้าโปรไฟล์ทั้งสอง → `PUT /me` · ทดสอบครบกับ API จำลองในเบราว์เซอร์ · โหมด cognito รอทดสอบเฟส 9
> - **ช่วงเปลี่ยนผ่าน (ถึงเฟส 8):** บัญชีจาก API มี id เป็น `userId` จึงไม่เห็นงาน/การจองเดโมเดิมใน `localStorage` (ผู้จัดงานเดโมเห็นแดชบอร์ดว่าง) จนกว่าหน้าเหล่านั้นจะสลับไปใช้ API ในเฟส 3–6 · `syncProfile` + `services/profileBridge.ts` กันหน้าเดิมพัง
> - หน้า Admin (`UserPage`, `OrganizerApprovalsPage`) ยังทำงานกับบัญชีจำลอง จนถึงเฟส 7 ระหว่างนี้อนุมัติ/ระงับผ่าน API ตรง
- `src/auth/*` + เขียน `AuthProvider` ใหม่ให้ใช้ adapter โดย **คง interface `AuthStore` เดิม** แต่เปลี่ยนเป็น async (`login`, `register`, `verifyEmail`, `resetPassword` คืน Promise) → แก้ `LoginForm`, `RegisterForm`, `VerifyEmailForm`, `ForgotPasswordForm`, `OtpField` ให้รอผลและแสดง loading
- `account` มาจาก `GET /me` (query `['me']`) หลังล็อกอิน · บัญชี PENDING/REJECTED ใช้หน้าที่อนุญาตได้ตามเดิม (`RequireAuth`)
- สมัคร: `signUp` ส่ง `custom:role` → `confirmSignUp` ส่ง `{name, phone, orgName, category}` ใน `clientMetadata` · เก็บค่าฟอร์มใน `sessionStorage` ระหว่างรอ OTP
- ลืมรหัสผ่าน: Cognito `resetPassword` / `confirmResetPassword` (โหมด dev ข้าม OTP)
- ลบการแสดง OTP บนจอ (`AUTH_RULES` / `lastOtp`) ในโหมด cognito
- หลัง Admin อนุมัติผู้จัดงาน: เมื่อได้แจ้งเตือน `organizer_approved` เรียก `refreshSession()` (= `fetchAuthSession({ forceRefresh: true })`) (F7)
- หน้าโปรไฟล์ `ShopProfilePage` / `OrganizerProfilePage` → `GET/PUT /me` (F8, F29, F32)
- **เสร็จเมื่อ:** สมัครผู้ขาย → ยืนยัน → ล็อกอิน → แก้โปรไฟล์ → ออกจากระบบ ได้ครบกับ API จำลอง

### เฟส 3 — ดูงานและผัง (สาธารณะ) (F4, F11, F14) ✅ (2026-10-28)
> ทำแล้ว: หน้าผู้ขายใช้ type ใหม่ `PublicEvent` + `LotStates` จาก API (`api/events.ts`, `queries/events.ts`, `services/events.ts`) · หน้าฝั่งผู้จัดงานยังใช้ `MarketEvent` เดิมจนถึงเฟส 4
> - **ปุ่มจองปิดชั่วคราว** (เลือกล็อกได้ แต่กดจองไม่ได้ มีข้อความแจ้ง) จนเฟส 5 ย้ายขั้นตอนจองไป API — เฟส 5 ขึ้นกับเฟส 2–3 เท่านั้น จึงทำก่อนเฟส 4 ได้
> - ราคาบนผัง = ราคาโซน ไม่มีค่าธรรมเนียม (ทำ F31 ส่วนแผงเลือกล็อกไปแล้ว)
- `HomePage`, `EventPage`, `EventMapPage`, `EventListItem`, `LotMap` → `GET /events`, `GET /events/{id}`, `GET /events/{id}/lots`
- ตัดการเลือกวัน, `days`, `surcharge`, `lotState` รายวัน (F11) → สถานะล็อกชุดเดียวจาก `/lots`
- ใช้ `status` ที่ backend คำนวณ (`SCHEDULED/OPEN/CLOSED/ENDED`) แทน `deriveEvents()`
- **เสร็จเมื่อ:** หน้าแรกแสดง `demo-event` จาก API และผังแสดงสถานะล็อกจริง

### เฟส 4 — ผู้จัดงาน: สร้าง/แก้งาน (F10, F12, F13, F16) ✅ (2026-10-28)
> ทำแล้ว: `api/organizer.ts`, `queries/organizer.ts` (`useSaveEvent` บันทึกงาน → sync ล็อก → เผยแพร่), `MyEventsPage`, `MapEditorPage` · ทดสอบครบกับ API จำลอง
> - ลำดับบันทึกเมื่อลบโซน: `PUT` งานโดยยังเก็บโซนเดิม → `PUT /lots` → `PUT` งานด้วยโซนใหม่ (กัน `ZONE_IN_USE`)
> - งานที่ปิดแล้วแก้/เปิดใหม่ไม่ได้ (backend) จึงตัดปุ่ม "เปิดงานอีกครั้ง" หน้าแก้งานเป็นแบบดูอย่างเดียว
> - หน้าภาพรวม การจอง และร้านค้าของผู้จัดงานยังใช้ข้อมูลจำลองจนถึงเฟส 6 (จะไม่เห็นงานจาก API)
- `MyEventsPage` → `GET /organizer/events`
- `MapEditorPage` บันทึก: `POST /events` (ครั้งแรก) หรือ `PUT /events/{id}` → แล้ว `PUT /events/{id}/lots` ด้วยรายการจาก `lotsOf(layout)` + `lotSizes` + `disabledCells` → รับมือ `409 LOT_IN_USE` (ไฮไลต์ล็อกใน `details.lotIds`)
- เปลี่ยนชื่อฟิลด์ (`bookingOpens→bookingOpensAt` เป็น ISO มี timezone, `status→publishStatus`, `startDate/endDate`, `slipDeadlineMinutes`) และตัด `DayPricingTable`, `autoApprove` (F16)
- ปุ่มเผยแพร่ `PUT {publishStatus:"OPEN"}` (`409 NO_LOTS`) · ปิดรับจอง `POST /events/{id}/close`
- ฟอร์มงานใหม่เติมบัญชีรับเงินจากโปรไฟล์ (`me.payment`) (F32)
- **เสร็จเมื่อ:** ผู้จัดงานสร้างงาน วาดผัง เผยแพร่ แล้วงานขึ้นหน้าแรก

### เฟส 5 — ผู้ขาย: จองและแนบสลิป (F17, F19, F20, F21, F22, F31) ✅ (2026-10-28)
> ทำแล้ว: `api/bookings.ts`, `queries/bookings.ts`, `services/bookings.ts`, `services/bookingDraft.ts` · route เปลี่ยนเป็น `/booking/payment/:groupId` และ `/booking/sent/:groupId` · ทดสอบครบกับ API จำลอง (อัปโหลดสลิปไป moto จริง)
> - ร่างการจองไม่ใช้ `AppProvider.draft` แล้ว (เก็บใน `sessionStorage`) · หน้าผู้จัดงาน (ตรวจการจอง) ยังไม่เห็นการจองจาก API จนถึงเฟส 6
- `BookingDrawer` / `BookingShopInfoPage` → `POST /bookings` `{eventId, lotIds, shopName, productDescription, category, staff, power, note}` → `409 LOT_NOT_AVAILABLE` ให้เลือกล็อกใหม่ (ไฮไลต์ `details.lotIds`), `QUOTA_EXCEEDED`, `BOOKING_CLOSED`
- `BookingSummary` / `utils/pricing.ts`: ยอด = ผลรวมราคาโซน ตัดค่าไฟ/ค่าธรรมเนียม (F31) ใช้ `amount` จาก backend เป็นหลัก
- `BookingPaymentPage`: แสดงเวลาที่เหลือจาก `expiresAt` → `POST /bookings/{id}/slip-url` → อัปโหลด `FormData` (ทุกค่าใน `fields` แล้ว `file` ท้ายสุด) → `POST /bookings/{id}/slip` (สลิปเดียวทั้งชุด) → `409 BOOKING_EXPIRED` แจ้งให้จองใหม่
- `BookingSentPage`, `MyBookingsPage`, `BookingTicket` → `GET /bookings/me` จัดกลุ่มตาม `groupId` · สถานะใหม่ "รอแนบสลิป" (`PENDING_PAYMENT`) และ "หมดเวลา" (`EXPIRED`) · ยกเลิก `POST /bookings/{id}/cancel` · ดูสลิป `GET /bookings/{id}/slip`
- **เสร็จเมื่อ:** ผู้ขายจอง 2 ล็อก → แนบสลิป → เห็นสถานะรอตรวจ · ทดสอบหมดเวลาด้วย `slipDeadlineMinutes: 2` + `POST /_dev/expire`

### เฟส 6 — ผู้จัดงาน: ตรวจการจอง หน้างาน และสถิติ (F15, F24–F28) ✅ (2026-10-28)
> ทำแล้ว: `api/organizer.ts` + `queries/organizer.ts` (การจองทุกงานผ่าน `GET /events/{id}/bookings` ทีละงาน), `useBookingDecisions`, `BookingsPage`, `BookingDrawer`, `OverviewPage`, `VendorsPage`, `CheckInPanel`, `services/organizer.ts` · ทดสอบครบกับ API จำลอง
> - เช็กอิน: กล่อง "เช็กอินหน้างาน" ในหน้าภาพรวม รับรหัสการจองจากเครื่องสแกน/พิมพ์ หรือค้นหาล็อก/ร้านของงานที่จัดวันนี้ · ยังไม่มีสแกนด้วยกล้อง (QR บนจอผู้ขายยังเป็นลายจำลอง)
> - กราฟการจองรายวันในหน้าภาพรวมถูกตัด (D1) · drawer ไม่มีชื่อเจ้าของร้าน/เบอร์โทร (การจองไม่ได้เก็บ) และไม่มียอดในสลิป (ดูจากรูปสลิปจริงแทน)
> - `dateTimeLabel` แปลงเวลา UTC จาก backend เป็นเวลาเครื่องแล้ว
- `BookingsPage`, `PendingQueue`, `SlipCard`, `useBookingDecisions` → `GET /events/{id}/bookings?status=` · อนุมัติ `POST .../approve {newLotId?}` · ปฏิเสธ `POST .../reject {reason}` · ยกเลิกหลังอนุมัติ `POST .../cancel {reason}` (`BookingReasonDialog` เดิม)
- เช็กอิน: `QrDialog` / `QrCode` ของผู้ขายสร้าง QR จาก `bookingId` · ฝั่งผู้จัดงานสแกนหรือพิมพ์รหัส → `POST /bookings/{id}/check-in` (`409 NOT_EVENT_DAY`) (F27)
- `OverviewPage`, `ZoneFillBars`, `FloorMiniMap` → `GET /events/{id}/summary` + `/lots` (F15) · `VendorsPage` → `GET /organizer/vendors` (F28)
- **เสร็จเมื่อ:** ผู้จัดงานอนุมัติ (ย้ายล็อก 1 รายการ) ปฏิเสธ เช็กอิน และเห็นยอดสรุปตรงกับที่จอง

### เฟส 7 — Admin และแจ้งเตือน (F9, F18, F23, F30) ✅ (2026-10-28 · ยังไม่ได้กดทดสอบ flow)
> ทำแล้ว: `api/{admin,notifications}.ts`, `queries/{admin,notifications}.ts`, หน้า Admin 3 หน้า, `NotificationBell`, `NotificationWatcher` · build/lint ผ่าน เปิดหน้าได้กับ API จำลอง
> - หน้าอนุมัติผู้จัดงานใช้ `GET /admin/users` ครั้งเดียว (ได้ทุกสถานะ) แทนเรียก `/admin/organizers?status=` ทีละแท็บ · ตัดปุ่ม "อนุมัติแทน" ของบัญชีที่ไม่อนุมัติแล้ว (backend รับเฉพาะ PENDING)
> - หน้างานทั้งหมดแสดง "การจองที่ใช้งานอยู่" (`bookingCount`) แทนล็อกที่ขายแล้ว
> - ลิงก์แจ้งเตือนสร้างในหน้าเว็บจากประเภท + บทบาท + `bookingId`/`eventId` เมื่อ backend ไม่ส่ง `link`
> - poll แจ้งเตือนอยู่ระดับแอป (`NotificationWatcher`) ผู้จัดงานที่รออนุมัติจึงได้ `organizer_approved` แล้วโหลด `/me` ใหม่ → refresh token อัตโนมัติ
- `OrganizerApprovalsPage` → `GET /admin/organizers?status=` + approve/reject · ตัวเลขสรุปจาก `GET /admin/users` และ `GET /admin/events` (`bookingCount`)
- `UserPage` → `GET /admin/users?role=` + suspend/unsuspend · `AllEventsPage` → `GET /admin/events` (`revenue`)
- `NotificationBell` → `useQuery(['notifications'], { refetchInterval: 30_000 })` (`POLL_SECONDS` เดิม) · อ่านแล้ว `POST /notifications/read` · เพิ่ม type ใหม่ `booking_slip_uploaded`, `booking_expired`, `account_unsuspended` ใน `NotificationType` + ไอคอน · ใช้ `message` จาก backend
- **เสร็จเมื่อ:** Admin อนุมัติผู้จัดงานใหม่ → ผู้จัดงานเห็นแจ้งเตือนภายใน 30 วินาที → refresh token แล้วเข้าเมนูผู้จัดงานได้

### เฟส 8 — เก็บกวาด ✅ (2026-10-28 · ยังไม่ได้ไล่ checklist หัวข้อ 6)
> ทำแล้ว: ลบไฟล์ในข้อ 3.2 ทั้งหมด + `hooks/useAppStore.ts`, `services/profileBridge.ts` · ตัด type และค่าตั้งค่าที่ไม่ใช้ · `main.tsx` ล้าง key เดิมใน `localStorage` · build/lint ผ่าน
- ลบไฟล์ในข้อ 3.2 และ `AppProvider` ออกจาก `main.tsx` · ลบ key `bookmybooth-data-v1` / `bookmybooth-session` ใน `localStorage`
- `npm run build` + `npm run lint` ผ่าน, ไม่มี import จาก `data/*` ที่เป็นข้อมูลจำลองเหลือ
- ไล่ checklist หัวข้อ 6 ครบกับ API จำลอง

### เฟส 9 — สลับไป AWS (สัปดาห์ 11 ตาม AWS-SETUP)
- สร้าง resource ตาม AWS-SETUP ข้อ 1–8 → ตั้ง `VITE_AUTH_MODE=cognito` และค่าของจริงใน Amplify → ไล่ checklist หัวข้อ 6 ซ้ำกับ AWS · รายละเอียดที่ต้องเปลี่ยนอยู่ใน AWS-SETUP หัวข้อ 14

---

## 6. Checklist ทดสอบร่วม (ใช้ทั้งกับ API จำลองและ AWS)

| # | flow | ผลที่ต้องได้ |
|---|---|---|
| 1 | สมัครผู้ขาย + ยืนยันอีเมล + แก้โปรไฟล์ร้าน | `/me` มี `shopName`, `line`, `bio` |
| 2 | สมัครผู้จัดงาน → Admin อนุมัติ → refresh | เมนูผู้จัดงานเปิดได้ |
| 3 | สร้างงาน วาดผัง เผยแพร่ | งานขึ้นหน้าแรก ผังตรงกับที่วาด |
| 4 | ผู้ขายจอง 2 ล็อก / ล็อกที่มีคนจองแล้ว | สำเร็จ / ข้อความว่าล็อกไหนไม่ว่าง |
| 5 | แนบสลิป jpg/png/pdf, ไฟล์ > 5 MB | สำเร็จ / ถูกปฏิเสธ |
| 6 | ไม่แนบสลิปจนหมดเวลา | สถานะ "หมดเวลา" ล็อกกลับว่าง |
| 7 | อนุมัติ, ย้ายล็อก, ปฏิเสธ, ยกเลิกหลังอนุมัติ | สถานะ/ผัง/แจ้งเตือนตรงทุกฝั่ง |
| 8 | เช็กอินวันงาน / ก่อนวันงาน | สำเร็จ / "เช็กอินได้เฉพาะวันที่จัดงาน" |
| 9 | สรุปงานและสถิติร้าน | ยอดเท่ากับผลรวมราคาโซนที่อนุมัติ |
| 10 | Admin ระงับ / ยกเลิกระงับ | ผู้ถูกระงับใช้งานไม่ได้ทันที / กลับมาใช้ได้ |
| 11 | ปิดแท็บแล้วเปิดใหม่ | ยังล็อกอินอยู่ ข้อมูลมาจาก API ไม่ใช่ localStorage |

---

## 7. ลำดับความสำคัญและขนาดงานโดยประมาณ

| เฟส | ขนาด | ขึ้นกับ |
|---|---|---|
| 0 Backend เตรียม | กลาง | — |
| 1 โครงพื้นฐาน | เล็ก | — |
| 2 ล็อกอิน/บัญชี | ใหญ่ (ทุกหน้าใช้ auth) | 0, 1 |
| 3 ดูงาน | กลาง | 1 |
| 4 สร้าง/แก้งาน | ใหญ่ (MapEditor) | 2, 3 |
| 5 จอง/สลิป | ใหญ่ | 2, 3 |
| 6 ตรวจการจอง/สถิติ | ใหญ่ | 5 |
| 7 Admin/แจ้งเตือน | กลาง | 2 |
| 8 เก็บกวาด | เล็ก | 2–7 |
| 9 สลับไป AWS | กลาง | 8 + สร้าง AWS |

เฟส 3 กับ 7 ทำคู่ขนานกับเฟสอื่นได้ เพราะไม่แตะไฟล์เดียวกัน
