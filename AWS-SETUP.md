# BookMyBooth — คู่มือสร้าง AWS และจุดที่เชื่อมกับโค้ด Backend

> ใช้ตอนสัปดาห์ 11–12 (ขึ้น AWS) · สร้างทุกอย่างเองผ่าน **AWS Console** ใน AWS Academy Learner Lab ไม่ใช้ SAM / CloudFormation
> แผนละเอียดอยู่ที่ [Backend/PLAN.md](Backend/PLAN.md) หัวข้อ 3 · จดชื่อ/ID ที่สร้างจริงไว้ใน [Backend/PROGRESS.md](Backend/PROGRESS.md) สัปดาห์ 11
> ⚠️ ทีมตกลงกันว่า **ถ้ามีอะไรต้องสร้างเพิ่มนอกเหนือจากเอกสารนี้ ให้ถามก่อน**

---

## 0. ภาพรวม

```
เบราว์เซอร์ (Amplify Hosting)
   │  ล็อกอิน/สมัคร ─────────────► Cognito User Pool ──(PostConfirmation)──► Lambda post-confirmation
   │  เรียก API + Bearer token ──► API Gateway (HTTP API, JWT authorizer)
   │                                   ├─► Lambda events     ─┐
   │                                   ├─► Lambda bookings   ─┼─► DynamoDB 5 ตาราง
   │                                   ├─► Lambda admin      ─┤   S3 (สลิป)
   │                                   └─► Lambda me         ─┘   Cognito (admin API)
   │  อัปโหลดสลิปตรง (presigned POST) ──► S3
   │
   EventBridge Scheduler (bookings สร้างให้ทีละชุด) ──► Lambda expire-booking
```

**ลำดับการสร้าง** (ขั้นหลังต้องใช้ค่าจากขั้นก่อน):

| # | สร้าง | ได้ค่าอะไรไปใช้ต่อ |
|---|---|---|
| 1 | DynamoDB 5 ตาราง | ชื่อตาราง → env ของ Lambda |
| 2 | S3 bucket | ชื่อ bucket → env `FILES_BUCKET` |
| 3 | Cognito User Pool + App client + Groups | User Pool ID, Client ID → env `USER_POOL_ID`, authorizer, frontend |
| 4 | build zip + Lambda 6 ตัว | ARN ของ expire-booking → env `EXPIRE_FUNCTION_ARN` |
| 5 | PostConfirmation trigger | — |
| 6 | API Gateway HTTP API | Invoke URL → frontend |
| 7 | ค่า env ให้ Amplify + seed ข้อมูลเดโม | — |

ทุกอย่างอยู่ region **us-east-1** ตั้งชื่อเป็น `bookmybooth-<stage>-<ชื่อ>` (`<stage>` = `dev` หรือ `prod`)

---

## 1. Role และสิทธิ์

### 1.1 IAM Role — ใช้ `LabRole` อย่างเดียว
Learner Lab **ห้ามสร้าง IAM role/policy เอง** ทุกจุดที่ AWS ถาม role ให้เลือก `LabRole` ที่มีอยู่แล้ว

| ที่ไหน | ตั้งค่า | หมายเหตุ |
|---|---|---|
| Lambda ทั้ง 6 ตัว → Execution role | *Use an existing role* → `LabRole` | **ห้ามกด Create a new role** (จะ error หรือสร้างไม่ได้) |
| EventBridge Scheduler → Target role | โค้ดส่ง `SCHEDULER_ROLE_ARN` = ARN ของ LabRole ให้เอง | LabRole มี `scheduler.amazonaws.com` ใน trust policy แล้ว (spike ผ่าน) |
| Cognito → Lambda trigger | ไม่ต้องตั้ง role | Console เพิ่ม resource policy ให้ Cognito เรียก Lambda เอง |
| API Gateway → Lambda integration | ไม่ต้องตั้ง role | Console เพิ่ม resource policy ให้ API Gateway เรียก Lambda เอง |

ARN ของ LabRole: `arn:aws:iam::<account id>:role/LabRole` (ดู account id มุมขวาบนของ Console)

สิ่งที่ LabRole ต้องทำได้ (โค้ดเรียก): DynamoDB (get/put/update/query/scan/transact), S3 (presign, head_object), Cognito (`admin_add_user_to_group`, `admin_disable_user`, `admin_enable_user`, `admin_user_global_sign_out`), Scheduler (`create_schedule`, `delete_schedule` + **`iam:PassRole` บน LabRole — ยังไม่เคยทดสอบ** ดูข้อ 7), CloudWatch Logs

### 1.2 บทบาทผู้ใช้ในระบบ — Cognito Groups
| Group | ใครอยู่ | ใส่เข้า group เมื่อไร | โค้ดที่ใช้ |
|---|---|---|---|
| `Seller` | ผู้ขาย | อัตโนมัติตอนยืนยันอีเมล (post_confirmation) | `domain/users.py` `GROUP_OF_ROLE` |
| `Organizer` | ผู้จัดงาน | ตอน Admin อนุมัติ (`/admin/organizers/{id}/approve`) | `functions/admin/app.py` |
| `Admin` | ผู้ดูแลระบบ | สร้างด้วย `scripts/seed.py` เท่านั้น สมัครเองไม่ได้ | `scripts/seed.py` |

ชื่อ group ต้องสะกด **ตัวพิมพ์ตรงทุกตัว** เพราะโค้ดเทียบกับค่าใน token (`cognito:groups`)

---

## 2. DynamoDB — 5 ตาราง

ทุกตาราง: **Create table** → Table settings: *Customize settings* → **Capacity mode = On-demand** · Partition/Sort key เป็นชนิด **String** ทั้งหมด

GSI สร้างตอนสร้างตาราง (ส่วน *Secondary indexes* → *Create global index*) หรือเพิ่มทีหลังในแท็บ *Indexes* ก็ได้ · **Attribute projections = All** ทุก GSI

### 2.1 `bookmybooth-<stage>-users`
| | ชื่อ attribute | ชนิด |
|---|---|---|
| Partition key | `userId` | String (= Cognito `sub`) |
| GSI `byRoleStatus` | PK `roleStatus` · SK `createdAt` | String · String |

ตัวอย่างค่า `roleStatus`: `ORGANIZER#PENDING`, `ADMIN#ACTIVE` (ใช้หาผู้สมัครที่รออนุมัติ และหา Admin เพื่อแจ้งเตือน)

### 2.2 `bookmybooth-<stage>-events`
| | ชื่อ attribute | ชนิด |
|---|---|---|
| Partition key | `eventId` | String |
| GSI `byOrganizer` | PK `organizerId` · SK `createdAt` | String · String |
| GSI `byPublishStatus` | PK `publishStatus` · SK `startDate` | String · String |

### 2.3 `bookmybooth-<stage>-lots`
| | ชื่อ attribute | ชนิด |
|---|---|---|
| Partition key | `eventId` | String |
| Sort key | `lotId` | String |

ไม่มี GSI · ตารางนี้มี item 2 แบบ: ล็อก (`lotId` = `A01`) และโควตาต่อผู้ขาย (`lotId` = `QUOTA#<sellerId>`)

### 2.4 `bookmybooth-<stage>-bookings`
| | ชื่อ attribute | ชนิด |
|---|---|---|
| Partition key | `bookingId` | String |
| GSI `bySeller` | PK `sellerId` · SK `createdAt` | String · String |
| GSI `byEventStatus` | PK `eventId` · SK `statusCreatedAt` | String · String |

ตัวอย่าง `statusCreatedAt`: `PENDING_REVIEW#2026-11-01T03:00:00.000Z`

### 2.5 `bookmybooth-<stage>-notifications`
| | ชื่อ attribute | ชนิด |
|---|---|---|
| Partition key | `userId` | String |
| Sort key | `sk` | String (= `createdAt#notificationId`) |

**หลังสร้างเสร็จ:** แท็บ *Additional settings* → *Time to Live (TTL)* → Turn on → attribute name **`ttl`** (ลบแจ้งเตือนเก่าอัตโนมัติหลัง 90 วัน)

### 2.6 ตรวจหลังสร้าง
- ชื่อ index ต้องตรงตัวพิมพ์: `byRoleStatus`, `byOrganizer`, `byPublishStatus`, `bySeller`, `byEventStatus`
- ชื่อ key ต้องตรงตัวพิมพ์ (camelCase) ถ้าพิมพ์ผิด เช่น `userID` โค้ดจะ error ทันที
- ต้นฉบับโครงสร้างในโค้ด: [Backend/tests/tables.py](Backend/tests/tables.py) (ใช้สร้างตารางใน moto ตอนเทสต์ ถ้า Console ไม่ตรงไฟล์นี้ แปลว่าสร้างผิด)

---

## 3. S3 — bucket เก็บสลิป

1. *Create bucket* → ชื่อ `bookmybooth-<stage>-files-<account id>` (ชื่อ bucket ต้องไม่ซ้ำทั้งโลก)
2. **Object Ownership** = *ACLs disabled (Bucket owner enforced)*
3. **Block all public access** = เปิด (ติ๊กทุกข้อ) — สลิปเป็นข้อมูลส่วนตัว เปิดดูผ่านลิงก์ชั่วคราว 5 นาทีเท่านั้น
4. **Default encryption** = SSE-S3
5. หลังสร้าง → แท็บ *Permissions* → *Cross-origin resource sharing (CORS)* → Edit:
   ```json
   [
     {
       "AllowedMethods": ["GET", "POST"],
       "AllowedOrigins": ["http://localhost:5173", "https://<โดเมน Amplify>"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
   ถ้าไม่ตั้ง CORS หน้าเว็บจะอัปโหลดสลิปไม่ได้ (error CORS ใน console ของเบราว์เซอร์)

ไฟล์ที่เก็บ: `slips/<eventId>/<groupId>/<ulid>.<jpg|png|pdf>` ไม่เกิน 5 MB (โค้ดกำหนดใน presigned POST)

---

## 4. Cognito — User Pool

1. *Create user pool* → ประเภท **Single-page application (SPA)** → ชื่อ `bookmybooth-<stage>`
2. **Sign-in identifiers** = **Email** อย่างเดียว · Self-registration = เปิด · Required attributes = `email`
3. **Email** = *Send email with Cognito* (ใช้ได้ฟรีวันละ 50 ฉบับ พอสำหรับเดโม)
4. **Password policy**: ยาวอย่างน้อย 8, ต้องมีตัวพิมพ์เล็ก + ตัวเลข (ไม่บังคับตัวใหญ่/สัญลักษณ์)
5. **Custom attribute** (*Sign-up* → *Custom attributes* → Add): ชื่อ `role`, String, **Mutable**, min 1 max 20 → หน้าเว็บส่งเป็น `custom:role` = `seller` หรือ `organizer`
   - ⚠️ custom attribute **เพิ่มทีหลังได้ แต่ลบ/แก้ไม่ได้** ตั้งให้ถูกตั้งแต่แรก
   - โปรไฟล์อื่น (ชื่อ เบอร์ ชื่อร้าน ประเภท) **ไม่เก็บใน Cognito** ส่งผ่าน `clientMetadata` ไปเก็บใน DynamoDB
6. **App client** (สร้างพร้อม pool หรือแท็บ *App clients*):
   - ชนิด **Public client** — **ไม่มี client secret**
   - Authentication flows: `ALLOW_USER_SRP_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`
   - Token: access / ID = 1 ชั่วโมง, refresh = 30 วัน
   - *Prevent user existence errors* = เปิด
7. **Groups** (แท็บ *Groups* → Create group) 3 กลุ่ม: `Seller` (precedence 30), `Organizer` (20), `Admin` (10)
8. จดค่า: **User Pool ID** (`us-east-1_xxxxxxx`) และ **Client ID**
9. **PostConfirmation trigger** — ทำหลังสร้าง Lambda ในข้อ 5 แล้ว: *Extensions* (หรือ *User pool properties*) → *Add Lambda trigger* → Trigger type **Sign-up** → **Post confirmation trigger** → เลือก `bookmybooth-<stage>-post-confirmation`

---

## 5. Lambda — 6 function

### 5.1 เตรียม zip (ในเครื่อง)
```bash
cd Backend
py -V:3.13 -m venv .venv                    # ครั้งแรกครั้งเดียว
.venv\Scripts\activate
pip install -r requirements-dev.txt
pytest                                      # ต้องผ่านก่อนเสมอ
python scripts/build_zip.py                 # ได้ build/lambda.zip
```
zip นี้ใช้ **ไฟล์เดียวกันทุก function** (ข้างในมี `functions/`, `shared/`, `domain/`, `ulid/`) ต่างกันแค่ Handler

### 5.2 สร้างทีละตัว (ทำซ้ำ 6 ครั้ง)
*Create function* → *Author from scratch*

| ตั้งค่า | ค่า |
|---|---|
| Runtime | **Python 3.13** |
| Architecture | **x86_64** |
| Execution role | *Use an existing role* → **LabRole** |

หลังสร้าง:
1. **Code** → *Upload from* → *.zip file* → `build/lambda.zip`
2. **Runtime settings** → Edit → **Handler** ตามตารางข้างล่าง
3. **Layers** → *Add a layer* → *Specify an ARN* →
   `arn:aws:lambda:us-east-1:017000801446:layer:AWSLambdaPowertoolsPythonV3-python313-x86_64:40`
   (layer นี้มี Powertools 3.37.0 และ pydantic 2.14.1 — โค้ด import ไม่ได้ถ้าลืมใส่)
4. **Configuration → General** → Timeout **10 วินาที**, Memory **256 MB**
5. **Configuration → Environment variables** ตามข้อ 5.3

| ชื่อ function | Handler | ถูกเรียกโดย |
|---|---|---|
| `bookmybooth-<stage>-events` | `functions.events.app.lambda_handler` | API Gateway |
| `bookmybooth-<stage>-bookings` | `functions.bookings.app.lambda_handler` | API Gateway |
| `bookmybooth-<stage>-admin` | `functions.admin.app.lambda_handler` | API Gateway |
| `bookmybooth-<stage>-me` | `functions.me.app.lambda_handler` | API Gateway |
| `bookmybooth-<stage>-post-confirmation` | `functions.post_confirmation.app.lambda_handler` | Cognito trigger |
| `bookmybooth-<stage>-expire-booking` | `functions.expire_booking.app.lambda_handler` | EventBridge Scheduler |

### 5.3 Environment variables
**ใส่ชุดนี้ทุก function** (ทั้ง 6 ตัว ใส่เหมือนกันหมดง่ายสุด ไม่มีผลเสีย):

| Key | Value | โค้ดที่อ่าน |
|---|---|---|
| `USERS_TABLE` | `bookmybooth-<stage>-users` | `shared/db.py` |
| `EVENTS_TABLE` | `bookmybooth-<stage>-events` | `shared/db.py` |
| `LOTS_TABLE` | `bookmybooth-<stage>-lots` | `shared/db.py` |
| `BOOKINGS_TABLE` | `bookmybooth-<stage>-bookings` | `shared/db.py` |
| `NOTIFICATIONS_TABLE` | `bookmybooth-<stage>-notifications` | `shared/db.py` |
| `FILES_BUCKET` | ชื่อ bucket ข้อ 3 | `shared/s3.py` |
| `POWERTOOLS_SERVICE_NAME` | `bookmybooth` | Powertools Logger |
| `POWERTOOLS_LOG_LEVEL` | `INFO` | Powertools Logger |

**เพิ่มเฉพาะบางตัว** (ใส่ทุกตัวก็ได้เหมือนกัน):

| Function | Key | Value | โค้ดที่อ่าน |
|---|---|---|---|
| admin | `USER_POOL_ID` | User Pool ID ข้อ 4 | `shared/cognito.py` |
| bookings | `EXPIRE_FUNCTION_ARN` | ARN ของ `bookmybooth-<stage>-expire-booking` (หน้า function มุมขวาบน) | `shared/scheduler.py` |
| bookings | `SCHEDULER_ROLE_ARN` | `arn:aws:iam::<account id>:role/LabRole` | `shared/scheduler.py` |

ถ้าลืม env ตัวไหน → function นั้นตอบ **500** และใน CloudWatch Logs จะเห็น `KeyError: 'XXX_TABLE'`

---

## 6. API Gateway — HTTP API

1. *Create API* → **HTTP API** → Build → ยังไม่ต้องเพิ่ม integration → ชื่อ `bookmybooth-<stage>`
2. **Stages** → ใช้ **`$default`** (Auto-deploy เปิด) — ⚠️ **ห้ามตั้งชื่อ stage อื่น** (เช่น `dev`) เพราะ path จะมี `/dev` นำหน้าและโค้ดหา route ไม่เจอ (404 ทุก route) ถ้าจำเป็นต้องใช้ชื่อ stage ดูข้อ 10.2
3. **CORS** → Configure:
   - Access-Control-Allow-Origin: `http://localhost:5173`, `https://<โดเมน Amplify>`
   - Allow-Methods: `GET, POST, PUT, DELETE, OPTIONS`
   - Allow-Headers: `authorization, content-type`
   - Max-Age: `600`
4. **Authorization → Manage authorizers → Create** → ชนิด **JWT**
   - Name: `cognito`
   - Identity source: `$request.header.Authorization`
   - Issuer URL: `https://cognito-idp.us-east-1.amazonaws.com/<User Pool ID>`
   - Audience: `<Client ID>`
5. **Integrations** → สร้าง Lambda integration 4 ตัว (events, bookings, admin, me) — Console จะเพิ่มสิทธิ์ให้ API เรียก Lambda เอง
6. **Routes** → สร้างทุก route ตามตาราง 6.1 แล้ว **Attach integration** ให้ตรง function และ **Attach authorizer `cognito`** ให้ทุก route ที่ไม่ใช่สาธารณะ
7. **Throttling** → Stage `$default` → Default route throttling: **Burst 10 / Rate 20** (ไม่ให้เกิน limit 10 concurrent ของ Lab)
8. จด **Invoke URL** (เช่น `https://abc123.execute-api.us-east-1.amazonaws.com`)

### 6.1 Routes ทั้งหมด (31 route)
ใน Console ใช้ `{eventId}` / `{bookingId}` / `{userId}` เป็นตัวแปร path (โค้ดอ่านจาก path จริง ไม่สนชื่อตัวแปร)

| # | Method | Path | Integration | Authorizer |
|---|---|---|---|---|
| 1 | GET | `/health` | events | ❌ สาธารณะ |
| 2 | GET | `/events` | events | ❌ สาธารณะ |
| 3 | GET | `/events/{eventId}` | events | ❌ สาธารณะ |
| 4 | GET | `/events/{eventId}/lots` | events | ❌ สาธารณะ |
| 5 | POST | `/events` | events | ✅ cognito |
| 6 | PUT | `/events/{eventId}` | events | ✅ cognito |
| 7 | POST | `/events/{eventId}/close` | events | ✅ cognito |
| 8 | PUT | `/events/{eventId}/lots` | events | ✅ cognito |
| 9 | GET | `/events/{eventId}/summary` | events | ✅ cognito |
| 10 | GET | `/organizer/events` | events | ✅ cognito |
| 11 | GET | `/events/{eventId}/bookings` | **bookings** ⚠️ | ✅ cognito |
| 12 | GET | `/organizer/vendors` | **bookings** ⚠️ | ✅ cognito |
| 13 | POST | `/bookings` | bookings | ✅ cognito |
| 14 | GET | `/bookings/me` | bookings | ✅ cognito |
| 15 | POST | `/bookings/{bookingId}/slip-url` | bookings | ✅ cognito |
| 16 | POST | `/bookings/{bookingId}/slip` | bookings | ✅ cognito |
| 17 | GET | `/bookings/{bookingId}/slip` | bookings | ✅ cognito |
| 18 | POST | `/bookings/{bookingId}/cancel` | bookings | ✅ cognito |
| 19 | POST | `/bookings/{bookingId}/approve` | bookings | ✅ cognito |
| 20 | POST | `/bookings/{bookingId}/reject` | bookings | ✅ cognito |
| 21 | POST | `/bookings/{bookingId}/check-in` | bookings | ✅ cognito |
| 22 | GET | `/admin/organizers` | admin | ✅ cognito |
| 23 | POST | `/admin/organizers/{userId}/approve` | admin | ✅ cognito |
| 24 | POST | `/admin/organizers/{userId}/reject` | admin | ✅ cognito |
| 25 | POST | `/admin/users/{userId}/suspend` | admin | ✅ cognito |
| 26 | POST | `/admin/users/{userId}/unsuspend` | admin | ✅ cognito |
| 27 | GET | `/admin/events` | admin | ✅ cognito |
| 28 | GET | `/me` | me | ✅ cognito |
| 29 | PUT | `/me` | me | ✅ cognito |
| 30 | GET | `/notifications` | me | ✅ cognito |
| 31 | POST | `/notifications/read` | me | ✅ cognito |

> `GET /bookings/me` (#14) กับ `GET /bookings/{bookingId}/slip` (#17) ไม่ชนกัน เพราะ path ยาวไม่เท่ากัน
> ถ้าลืมผูก authorizer ที่ route ไหน route นั้นจะตอบ **401 เสมอ** (โค้ดไม่เจอ claims) ไม่ได้เปิดให้ทุกคนเข้า — เป็นสัญญาณให้กลับไปผูก authorizer

---

## 7. EventBridge Scheduler

**ไม่ต้องสร้างอะไรเอง** — ตอนผู้ขายจอง function bookings จะสร้าง schedule ชื่อ `expire-<groupId>` แบบครั้งเดียว (`at(...)`, schedule group `default`, ลบตัวเองหลังทำงาน) ไปเรียก expire-booking เมื่อหมดเวลาแนบสลิป

**ต้องทดสอบตอนขึ้นจริง:** Lambda (รันด้วย LabRole) สร้าง schedule ที่ส่ง `RoleArn` = LabRole ได้ไหม (ต้องใช้ `iam:PassRole`)
- ดูได้จาก CloudWatch Logs ของ bookings หลังจอง ถ้าเจอ `Failed to create expiry schedule` + `AccessDenied` = ไม่ได้
- **ถ้าไม่ได้ ระบบยังใช้งานได้** — การจองไม่ล้ม และล็อกที่หมดเวลาจะถูกปล่อยเองตอนมีคนเปิดดูล็อก/จอง (fallback ข้อ 7.6 ใน PLAN)
- ถ้าอยากให้หมดเวลาตรงเวลาจริง: สร้าง schedule `rate(5 minutes)` ใน Console ให้เรียก expire-booking **โดยไม่ส่ง input** (โค้ดรองรับโหมดกวาดแล้ว ไม่ต้องแก้) — ⚠️ เป็น resource ใหม่ ต้องถามทีมก่อน

---

## 8. Frontend (Amplify Hosting)

Amplify → App → *Hosting* → *Environment variables*:

| Key | Value |
|---|---|
| `VITE_API_URL` | Invoke URL ข้อ 6 |
| `VITE_USER_POOL_ID` | User Pool ID ข้อ 4 |
| `VITE_USER_POOL_CLIENT_ID` | Client ID ข้อ 4 |
| `VITE_REGION` | `us-east-1` |

แล้วเพิ่มโดเมน Amplify เข้า CORS ของ **API Gateway (ข้อ 6.3)** และ **S3 (ข้อ 3.5)** · งานฝั่ง frontend ทั้งหมดอยู่ใน PLAN หัวข้อ 15 (F1–F30)

---

## 9. ข้อมูลเดโม

ต้องมี credentials ของ Lab (copy จาก *AWS Details* ทุก session) หรือรันใน CloudShell:
```bash
cd Backend
set SEED_PASSWORD=Demo1234          # PowerShell: $env:SEED_PASSWORD="Demo1234"
python scripts/seed.py --user-pool-id us-east-1_xxxxxxx --stage dev
```
ได้บัญชี `admin@`, `organizer@`, `seller@bookmybooth.test` (ACTIVE ทุกบัญชี) และงานเปิดรับจอง `demo-event` 12 ล็อก รันซ้ำได้

---

## 10. จุดในโค้ด Backend ที่เกี่ยวกับ AWS

### 10.1 แผนที่: ค่าใน AWS ↔ ไฟล์ในโค้ด
| ค่าใน AWS | ไฟล์ที่เกี่ยวข้อง | ต้องตรงกันอย่างไร |
|---|---|---|
| ชื่อตาราง | `src/shared/db.py` (`_TABLE_ENV`) | อ่านจาก env ไม่ hardcode — เปลี่ยนชื่อตารางได้โดยแก้แค่ env |
| key / GSI ของตาราง | `tests/tables.py`, `src/functions/*` (ชื่อ `IndexName`) | ชื่อ attribute และ index ต้องตรงทุกตัว |
| ชื่อ bucket | `src/shared/s3.py` | อ่านจาก env `FILES_BUCKET` |
| ขนาด/ชนิดสลิป | `src/domain/schemas.py` (`SLIP_TYPES`, `SLIP_MAX_BYTES`) | — |
| User Pool ID | `src/shared/cognito.py` | env `USER_POOL_ID` (post_confirmation ใช้ค่าจาก trigger event ไม่ต้องตั้ง) |
| ชื่อ group | `src/domain/users.py` (`GROUP_OF_ROLE`) | `Seller` / `Organizer` / `Admin` |
| `custom:role` | `src/functions/post_confirmation/app.py` (`_SIGNUP_ROLES`) | ค่าที่รับ: `seller`, `organizer` (อื่น ๆ ถือเป็นผู้ขาย) |
| claims จาก authorizer | `src/shared/auth.py` | อ่าน `sub` และ `cognito:groups` (รองรับทั้ง string และ list) |
| path ของ API | `src/shared/http.py` (`create_app`) + `@app.get(...)` ในแต่ละ function | ใช้ stage `$default` path ต้องไม่มี prefix |
| Scheduler | `src/shared/scheduler.py` | env `EXPIRE_FUNCTION_ARN`, `SCHEDULER_ROLE_ARN` |
| Powertools / pydantic | layer `:40` + `requirements-dev.txt` (pin เวอร์ชันเดียวกัน) | — |
| dependency ที่ใส่ใน zip | `src/requirements.txt` (`python-ulid`) | ห้ามใส่ powertools/pydantic/boto3 ซ้ำ |
| region | ไม่ได้ hardcode (Lambda ใส่ `AWS_REGION` ให้เอง) | `scripts/seed.py` ใช้ `--region` (default us-east-1) |

### 10.2 ถ้าเปลี่ยนแบบนี้ ต้องแก้โค้ดตรงไหน
| เปลี่ยนอะไร | แก้โค้ดไหม | แก้ที่ไหน |
|---|---|---|
| ชื่อตาราง / bucket / stage `dev`↔`prod` | ❌ ไม่ต้อง | แค่ env ของ Lambda |
| ใช้ API stage ชื่ออื่นที่ไม่ใช่ `$default` (เช่น `dev`) | ✅ 1 บรรทัด | `src/shared/http.py`: `APIGatewayHttpResolver(serializer=to_json, strip_prefixes=["/dev"])` |
| เพิ่ม/เปลี่ยน key หรือ GSI ของตาราง | ✅ | Console + `tests/tables.py` + query ใน function + PLAN หัวข้อ 4 |
| เปลี่ยนชื่อ group ใน Cognito | ✅ | `src/domain/users.py` `GROUP_OF_ROLE` |
| อัปเดต Powertools layer เป็นเวอร์ชันใหม่ | ✅ | ARN ใน Lambda ทุกตัว + pin ใน `requirements-dev.txt` แล้วรัน `pytest` |
| เพิ่ม route ใหม่ | ✅ | `@app.xxx` ใน function + สร้าง route ใน Console (ข้อ 6.1) + PLAN หัวข้อ 6 — ถามทีมก่อน |
| เพิ่ม env ใหม่ | ✅ | โค้ดที่อ่าน + ข้อ 5.3 ของเอกสารนี้ + PLAN 3.4 |
| ขยายขนาดสลิป | ✅ | `src/domain/schemas.py` `SLIP_MAX_BYTES` |
| Scheduler ใช้ไม่ได้ (PassRole) | ❌ ไม่ต้อง | สร้าง schedule `rate(5 minutes)` ใน Console (ถามก่อน) |

### 10.3 อัปเดตโค้ดหลังขึ้น AWS แล้ว
```bash
cd Backend
pytest && ruff check .
python scripts/build_zip.py
```
แล้วอัปโหลด `build/lambda.zip` ใหม่ — **ถ้าแก้ไฟล์ใน `shared/` หรือ `domain/` ต้องอัปโหลดให้ครบทั้ง 6 function** เพราะทุกตัวใช้โค้ดร่วมกัน ถ้าแก้แค่ `functions/<ชื่อ>/` อัปโหลดเฉพาะตัวนั้นได้

---

## 11. ตรวจหลังสร้างเสร็จ (smoke test)

| # | ทดสอบ | ผลที่ต้องได้ |
|---|---|---|
| 1 | เปิด `<Invoke URL>/health` ในเบราว์เซอร์ | `{"status":"ok"}` |
| 2 | เปิด `<Invoke URL>/events` | `{"items":[]}` (หรือมี `demo-event` ถ้า seed แล้ว) |
| 3 | เปิด `<Invoke URL>/me` โดยไม่มี token | 401 (authorizer ทำงาน) |
| 4 | สมัครผู้ขายจากหน้าเว็บ แล้วยืนยันอีเมล | ตาราง users มี item `SELLER#ACTIVE` และผู้ใช้อยู่ใน group `Seller` |
| 5 | สมัครผู้จัดงาน | users มี `ORGANIZER#PENDING` และ Admin ได้แจ้งเตือน |
| 6 | Admin อนุมัติ → ผู้จัดงาน refresh token → สร้างงาน | 201 |
| 7 | ผู้ขายจอง → ดู CloudWatch Logs ของ bookings | ไม่มี `Failed to create expiry schedule` (ถ้ามี ดูข้อ 7) และ EventBridge Scheduler มี `expire-<groupId>` |
| 8 | อัปโหลดสลิปจากหน้าเว็บ | ไม่มี error CORS, ไฟล์อยู่ใน bucket `slips/...` |
| 9 | ตั้ง `slipDeadlineMinutes: 2` จองแล้วรอ 3 นาที | Booking เป็น `EXPIRED` ล็อกกลับเป็นว่าง |
| 10 | `scripts/race_test.py` (สัปดาห์ 11) | 201 × 1, 409 × 4 |

## 12. อาการที่เจอบ่อย

| อาการ | สาเหตุที่น่าจะเป็น | แก้ |
|---|---|---|
| 404 `ROUTE_NOT_FOUND` ทุก route | ใช้ stage ชื่ออื่นที่ไม่ใช่ `$default` | ใช้ `$default` หรือแก้ `strip_prefixes` (10.2) |
| 404 ของ API Gateway (`{"message":"Not Found"}`) | ยังไม่ได้สร้าง route นั้น | ข้อ 6.1 |
| 401 ทั้งที่ล็อกอินแล้ว | ไม่ได้ส่ง header / issuer หรือ audience ผิด / route ลืมผูก authorizer | ตรวจ `Authorization: Bearer <accessToken>`, ข้อ 6.4 |
| 403 `ACCOUNT_NOT_FOUND` | ไม่มี item ใน users — PostConfirmation trigger ไม่ได้ตั้งหรือล้ม | ข้อ 4.9 แล้วดู Logs ของ post-confirmation |
| 403 `FORBIDDEN` หลัง Admin อนุมัติ | token เก่ายังไม่มี group `Organizer` | `fetchAuthSession({ forceRefresh: true })` หรือล็อกอินใหม่ |
| 500 + `KeyError` ใน Logs | ลืม env | ข้อ 5.3 |
| `Runtime.ImportModuleError: No module named 'aws_lambda_powertools'` | ลืมใส่ layer | ข้อ 5.2 ข้อ 3 |
| `Runtime.ImportModuleError: No module named 'functions'` | Handler ผิด หรือ zip โครงสร้างผิด | ใช้ zip จาก `build_zip.py` และ Handler ตามตาราง |
| `ResourceNotFoundException` ของ DynamoDB | ชื่อตารางใน env ไม่ตรง | ข้อ 5.3 |
| `ValidationException ... index` | ชื่อ GSI ไม่ตรง | ข้อ 2.6 |
| เบราว์เซอร์ฟ้อง CORS ตอนเรียก API | ไม่ได้เพิ่มโดเมนใน CORS ของ API | ข้อ 6.3 |
| เบราว์เซอร์ฟ้อง CORS ตอนอัปโหลดสลิป | CORS ของ bucket | ข้อ 3.5 |
| Lambda timeout / 503 ช่วงคนใช้เยอะ | เกิน 10 concurrent ของ Lab | throttling ข้อ 6.7 |

## 13. เมื่อบัญชี Lab ถูก reset
ทุกอย่างหายหมด ให้ทำข้อ 2 → 9 ใหม่ตามลำดับ แล้วอัปเดตค่าใน Amplify (ข้อ 8) และตาราง "Resource ที่สร้างจริง" ใน PROGRESS.md
