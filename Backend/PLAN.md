# BookMyBooth Backend — แผนการพัฒนา

> อ้างอิงจาก [BookMtBooth-scope.md](../BookMtBooth-scope.md)
> Stack: API Gateway (HTTP API) + AWS Lambda (**Python 3.13**) + DynamoDB + S3 + Cognito + EventBridge Scheduler
> การสร้าง resource: **สร้างเองผ่าน AWS Console** ตาม checklist หัวข้อ 3 (ไม่ใช้ SAM / CloudFormation) | สภาพแวดล้อม: AWS Academy Learner Lab (`us-east-1`, ใช้ `LabRole`)

---

## 1. หลักการออกแบบ

1. **สร้าง resource เองใน AWS Console ตาม checklist หัวข้อ 3** (ตัดสินใจ 2026-10-27 ไม่ใช้ SAM) ชื่อ resource, key ของตาราง และ env var ต้องตรงกับที่โค้ดใช้ทุกตัว ถ้าบัญชี Lab ถูก reset ให้สร้างใหม่ตาม checklist เดิม
2. **ไม่สร้าง IAM role เอง** ทุก Lambda, Scheduler และ Cognito trigger ใช้ `LabRole` ที่มีอยู่แล้ว (ใน Console เลือก *Use an existing role → LabRole* ห้ามกด *Create a new role*)
3. **Lambda น้อยตัว แยกตามกลุ่มงาน** (ประมาณ 6 ตัว) ใช้ router ภายในแทนการทำ 1 endpoint ต่อ 1 function ลดจำนวน cold start และช่วยให้อยู่ใต้ limit 10 concurrent ของ Lab
4. **สถานะทุกอย่างเปลี่ยนด้วย DynamoDB Transaction + Condition** กันการจองซ้ำและกัน race condition ระหว่างผู้ขาย ผู้จัดงาน และตัวหมดเวลา
5. **ตรวจสิทธิ์ 2 ชั้น** API Gateway ตรวจ JWT ส่วน Lambda ตรวจ group และความเป็นเจ้าของข้อมูลซ้ำ
6. **Lambda ทุกตัวใช้โค้ดชุดเดียวกัน** อัปโหลด zip ไฟล์เดียว (`build/lambda.zip` จาก `scripts/build_zip.py`) ให้ทุก function ต่างกันแค่ `Handler` ทำให้แชร์ `shared/` และ `domain/` ได้โดยไม่ต้องทำ Layer เอง
7. **เขียนโค้ดและทดสอบในเครื่องก่อน แล้วค่อยขึ้น AWS** (ตัดสินใจ 2026-10-27) แบ่งเป็น 2 ช่วง
   - **ช่วงที่ 1 — โค้ด (สัปดาห์ 1–10):** เขียนโค้ดทุกส่วน ทดสอบด้วย pytest + moto และ ruff เท่านั้น **ยังไม่สร้าง resource ใด ๆ บน AWS**
   - **ช่วงที่ 2 — ขึ้น AWS (สัปดาห์ 11–12):** สร้าง resource ชุด `dev` ใน Console ตามหัวข้อ 3 อัปโหลด zip ทดสอบเรื่องที่ moto จำลองไม่ได้ (ข้อ 10.2) เชื่อมกับ frontend จริง แล้วสร้างชุด `prod`
   - ความเสี่ยงที่ยอมรับ: ไม่มีเครื่องมือตรวจว่าตั้งค่าใน Console ตรงกับโค้ดไหม ต้องตั้งตาม checklist หัวข้อ 3 ทีละข้อ และให้ `pytest` + `ruff` ผ่านก่อน push ทุกครั้ง เผื่อเวลาแก้ไว้ในสัปดาห์ 11

---

## 2. โครงสร้างโฟลเดอร์

```
Backend/
├── PLAN.md                      ← ไฟล์นี้
├── PROGRESS.md                  ← ติดตามความคืบหน้า
├── pyproject.toml               ← ตั้งค่า pytest, ruff
├── requirements-dev.txt         ← pytest, moto, boto3, ruff, requests, powertools, pydantic (ใช้ในเครื่อง ไม่ขึ้น Lambda)
├── build/                       ← (ไม่ commit) lambda.zip ที่ได้จาก scripts/build_zip.py
├── src/
│   ├── requirements.txt         ← dependency ที่ขึ้น Lambda: python-ulid (pydantic มากับ Powertools layer แล้ว)
│   ├── functions/
│   │   ├── events/app.py        ← งาน ล็อก ภาพผัง สรุปงาน
│   │   ├── bookings/app.py      ← จอง สลิป อนุมัติ ปฏิเสธ ยกเลิก
│   │   ├── admin/app.py         ← อนุมัติผู้จัดงาน ระงับบัญชี
│   │   ├── me/app.py            ← โปรไฟล์ และการแจ้งเตือน
│   │   ├── post_confirmation/app.py ← Cognito trigger หลังยืนยันอีเมล
│   │   └── expire_booking/app.py    ← ถูกเรียกโดย EventBridge Scheduler
│   ├── shared/
│   │   ├── http.py              ← json response, แปลง Decimal, map AppError → HTTP status
│   │   ├── auth.py              ← อ่าน claims, require_group(), ตรวจสถานะบัญชี
│   │   ├── db.py                ← boto3 Table/client + ชื่อตารางจาก env
│   │   ├── s3.py                ← presigned POST / GET
│   │   ├── scheduler.py         ← สร้าง/ลบ schedule หมดเวลาจอง
│   │   ├── notify.py            ← เขียน Notification
│   │   └── errors.py            ← AppError(code, status, message)
│   └── domain/
│       ├── booking.py           ← state machine + สร้าง TransactItems ของการจอง
│       ├── lots.py              ← สร้างรหัสล็อกแบบช่วง เช่น A01–A20
│       ├── messages.py          ← ข้อความแจ้งเตือนภาษาไทย
│       └── schemas.py           ← pydantic model ของ request body
├── scripts/
│   ├── build_zip.py             ← สร้าง build/lambda.zip (src/ + python-ulid แบบ Linux x86_64) ไว้อัปโหลดใน Lambda Console
│   ├── seed.py                  ← สร้างบัญชีเดโม (admin/organizer/seller) และงานตัวอย่าง
│   └── race_test.py             ← ยิงจองล็อกเดียวกันพร้อมกัน ตรวจว่าสำเร็จแค่ 1
└── tests/                       ← pytest + moto
    ├── tables.py                ← โครงสร้างตาราง DynamoDB (ต้องตรงกับหัวข้อ 4 และที่สร้างใน Console)
    ├── apigw.py                 ← สร้าง event ของ HTTP API + JWT claims สำหรับเทสต์
    └── conftest.py              ← fixture `aws` สร้างตารางและ bucket ใน moto
```

### ไลบรารี
| ไลบรารี | ใช้ทำอะไร | ที่อยู่ |
|---|---|---|
| `boto3` | เรียก AWS ทุกบริการ | มีใน Lambda runtime อยู่แล้ว |
| **AWS Lambda Powertools for Python** | `APIGatewayHttpResolver` (router), `Logger`, `Tracer` | ใช้ **public Layer ของ AWS** `arn:aws:lambda:us-east-1:017000801446:layer:AWSLambdaPowertoolsPythonV3-python313-x86_64:40` (Powertools 3.37.0) ไม่ต้อง bundle เอง |
| `pydantic` v2 | validate request body | **มากับ Powertools layer แล้ว** (2.14.1) ห้ามใส่ใน `src/requirements.txt` ซ้ำ ส่วนในเครื่องให้ลงผ่าน `requirements-dev.txt` |
| `python-ulid` | สร้าง ID เรียงตามเวลา | `src/requirements.txt` |
| `pytest`, `moto` | unit test โดยจำลอง DynamoDB/S3 ในเครื่อง | `requirements-dev.txt` |
| `ruff` | lint + format | `requirements-dev.txt` |

> - ล็อกเลข version ของ layer ไว้ (`:40`) ให้ทุก function ใช้ตัวเดียวกัน ถ้าต้องการ version ใหม่ ดูจาก SSM parameter `/aws/service/powertools/python/x86_64/python3.13/latest` (`lambda:ListLayerVersions` ข้าม account ถูกปฏิเสธใน Lab)
> - dependency ที่ใส่ใน zip เองมีแค่ `python-ulid` (pure Python) `build_zip.py` ลง wheel แบบ Linux x86_64 ให้อยู่แล้ว จึง build บน Windows ได้เลย

---

## 3. Resource ที่ต้องสร้างใน AWS Console (สัปดาห์ 11)

ทุกอย่างอยู่ใน `us-east-1` ตั้งชื่อเป็น `bookmybooth-<stage>-<ชื่อ>` (`<stage>` = `dev` หรือ `prod`) สร้างตามลำดับด้านล่าง เพราะขั้นหลังต้องใช้ค่าจากขั้นก่อน

### 3.1 DynamoDB — 5 ตาราง
ทุกตาราง: **Capacity mode = On-demand**, key ทุกตัวเป็นชนิด **String**, GSI ใช้ **Projection = All** (รายละเอียดฟิลด์ดูหัวข้อ 4 ส่วนในเทสต์อยู่ที่ `tests/tables.py`)

| ชื่อตาราง | Partition key | Sort key | GSI (ชื่อ: PK, SK) |
|---|---|---|---|
| `bookmybooth-<stage>-users` | `userId` | — | `byRoleStatus`: `roleStatus`, `createdAt` |
| `bookmybooth-<stage>-events` | `eventId` | — | `byOrganizer`: `organizerId`, `createdAt` · `byPublishStatus`: `publishStatus`, `startDate` |
| `bookmybooth-<stage>-lots` | `eventId` | `lotId` | — |
| `bookmybooth-<stage>-bookings` | `bookingId` | — | `bySeller`: `sellerId`, `createdAt` · `byEventStatus`: `eventId`, `statusCreatedAt` |
| `bookmybooth-<stage>-notifications` | `userId` | `sk` | — · หลังสร้างให้เปิด **TTL** ที่ attribute `ttl` |

### 3.2 S3 — bucket เก็บสลิปและภาพผัง
- ชื่อ `bookmybooth-<stage>-files-<account id>` (ชื่อ bucket ต้องไม่ซ้ำทั้งโลก)
- **Block all public access** = เปิด, Object Ownership = *Bucket owner enforced*, Encryption = SSE-S3
- Permissions → CORS:
  ```json
  [{ "AllowedMethods": ["GET", "POST"], "AllowedOrigins": ["http://localhost:5173", "https://<โดเมน Amplify>"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3000 }]
  ```

### 3.3 Cognito — User Pool
- ชื่อ `bookmybooth-<stage>` · Sign-in ด้วย **Email** · ยืนยันอีเมลอัตโนมัติ · ส่งอีเมลด้วย *Send email with Cognito* · ลืมรหัสผ่านผ่านอีเมล
- Password policy: ยาวอย่างน้อย 8, ต้องมีตัวพิมพ์เล็กและตัวเลข
- Custom attribute: `role` (String, mutable, ยาว 1–20) → frontend ส่งเป็น `custom:role`
- App client: ชนิด **Public client / SPA** (ไม่มี client secret), auth flow `ALLOW_USER_SRP_AUTH` + `ALLOW_REFRESH_TOKEN_AUTH`, access/ID token อายุ 1 ชม., refresh token 30 วัน, เปิด *Prevent user existence errors*
- Groups: `Seller`, `Organizer`, `Admin` (ตัวพิมพ์ต้องตรง เพราะโค้ดเช็กชื่อนี้)
- **PostConfirmation trigger** ตั้งหลังสร้าง Lambda `post_confirmation` แล้ว (User pool → Extensions → Add Lambda trigger) Console จะเพิ่มสิทธิ์ให้ Cognito เรียก Lambda เอง

### 3.4 Lambda — 6 function
สร้างด้วยค่าเดียวกันทุกตัว แล้วอัปโหลด `build/lambda.zip` ไฟล์เดียวกัน (*Upload from → .zip file*)

| ตั้งค่า | ค่า |
|---|---|
| Runtime / Architecture | Python 3.13 / x86_64 |
| Execution role | *Use an existing role* → `LabRole` |
| Layer | *Specify an ARN* → `arn:aws:lambda:us-east-1:017000801446:layer:AWSLambdaPowertoolsPythonV3-python313-x86_64:40` |
| Timeout / Memory | 10 วินาที / 256 MB |

| Function | Handler | ถูกเรียกโดย |
|---|---|---|
| `bookmybooth-<stage>-events` | `functions.events.app.lambda_handler` | API Gateway |
| `bookmybooth-<stage>-bookings` | `functions.bookings.app.lambda_handler` | API Gateway |
| `bookmybooth-<stage>-admin` | `functions.admin.app.lambda_handler` | API Gateway |
| `bookmybooth-<stage>-me` | `functions.me.app.lambda_handler` | API Gateway |
| `bookmybooth-<stage>-post-confirmation` | `functions.post_confirmation.app.lambda_handler` | Cognito trigger |
| `bookmybooth-<stage>-expire-booking` | `functions.expire_booking.app.lambda_handler` | EventBridge Scheduler |

**Environment variables** ใส่ชุดนี้ทุก function (copy ทีละตัวใน Configuration → Environment variables):

| Key | Value |
|---|---|
| `USERS_TABLE` / `EVENTS_TABLE` / `LOTS_TABLE` / `BOOKINGS_TABLE` / `NOTIFICATIONS_TABLE` | ชื่อตารางจาก 3.1 |
| `FILES_BUCKET` | ชื่อ bucket จาก 3.2 |
| `POWERTOOLS_SERVICE_NAME` | `bookmybooth` |
| `POWERTOOLS_LOG_LEVEL` | `INFO` |

เพิ่มเฉพาะบางตัว:
| Function | Key | Value |
|---|---|---|
| admin | `USER_POOL_ID` | User Pool ID จาก 3.3 (ใช้ `admin_add_user_to_group`, `admin_disable_user`) |
| bookings | `EXPIRE_FUNCTION_ARN` | ARN ของ `bookmybooth-<stage>-expire-booking` |
| bookings | `SCHEDULER_ROLE_ARN` | ARN ของ `LabRole` (`arn:aws:iam::<account id>:role/LabRole`) |

> โค้ดอ่าน env ผ่าน `shared/db.py` และ module อื่นใน `shared/` ถ้าเพิ่ม env ใหม่ในโค้ด ต้องเพิ่มตารางนี้ด้วย

### 3.5 API Gateway — HTTP API
1. *Create API → HTTP API* ชื่อ `bookmybooth-<stage>` ใช้ stage `$default` (auto-deploy)
2. **CORS:** Allow origins = `http://localhost:5173` + โดเมน Amplify · Allow methods = `GET, POST, PUT, DELETE, OPTIONS` · Allow headers = `authorization, content-type` · Max age = 600
3. **Authorizer:** ชนิด JWT ชื่อ `cognito` · Identity source `$request.header.Authorization` · Issuer `https://cognito-idp.us-east-1.amazonaws.com/<UserPoolId>` · Audience = App client ID
4. **Routes:** สร้างทุก route ตามตารางหัวข้อ 6 แล้วผูก integration กับ Lambda ตามคอลัมน์ Function (Console เพิ่มสิทธิ์ให้ API Gateway เรียก Lambda เอง)
   - route ที่ช่องสิทธิ์เขียนว่า **สาธารณะ** ไม่ต้องผูก authorizer ที่เหลือ **ต้องผูก authorizer `cognito` ทุก route**
   - ระวัง `GET /events/{id}/bookings` ผูกกับ function **bookings** ไม่ใช่ events
   - ชั้นที่ 2 กันพลาด: `shared/auth.py` คืน 401 เมื่อไม่มี claims ดังนั้นถ้าลืมผูก authorizer ที่ route ไหน route นั้นจะใช้ไม่ได้ (ไม่ใช่เปิดให้ทุกคนใช้)
5. **Throttling:** stage `$default` → default route throttling burst **10** / rate **20** เพื่อไม่ให้เกิน limit 10 concurrent ของ Lab

### 3.6 EventBridge Scheduler
ไม่ต้องสร้างเอง function bookings สร้าง schedule `expire-<groupId>` ให้ทีละชุดตอนจอง (ข้อ 7.1) โดยใช้ schedule group `default` และ `SCHEDULER_ROLE_ARN` เป็น role ที่เรียก Lambda

### 3.7 ค่าที่ส่งให้ Frontend (Amplify → Environment variables)
| Key | เอามาจาก |
|---|---|
| `VITE_API_URL` | Invoke URL ของ HTTP API (3.5) |
| `VITE_USER_POOL_ID` | User Pool ID (3.3) |
| `VITE_USER_POOL_CLIENT_ID` | App client ID (3.3) |
| `VITE_REGION` | `us-east-1` |

> ทุกครั้งที่สร้างเสร็จ ให้จดชื่อ/ID ที่ได้จริงลง PROGRESS.md (หัวข้อสัปดาห์ 11) จะได้สร้างซ้ำได้ตรงกันถ้าบัญชีถูก reset

---

## 4. การออกแบบ DynamoDB

ใช้หลายตารางตาม scope (เข้าใจง่ายกว่า single-table สำหรับทีม) ID ทั้งหมดเป็น ULID เวลาเก็บเป็น ISO-8601 UTC

> boto3 คืนตัวเลขจาก DynamoDB เป็น `Decimal` และไม่รับ `float` ตอนเขียน ให้ `shared/http.py` แปลง `Decimal` → `int/float` ตอนส่ง JSON และเก็บราคาเป็นจำนวนเต็ม (บาท) เท่านั้น

### 4.1 Users
| Key | ค่า |
|---|---|
| PK `userId` | Cognito `sub` |
| GSI `byRoleStatus` | PK `roleStatus` เช่น `ORGANIZER#PENDING`, SK `createdAt` |

ฟิลด์: `email`, `role` (SELLER/ORGANIZER/ADMIN), `status` (ACTIVE/PENDING/REJECTED/SUSPENDED), `statusReason`, `displayName`, `phone`, `shopName`, `category`, `orgName`, `createdAt`, `updatedAt`

### 4.2 Events
| Key | ค่า |
|---|---|
| PK `eventId` | |
| GSI `byOrganizer` | PK `organizerId`, SK `createdAt` |
| GSI `byPublishStatus` | PK `publishStatus` (DRAFT/OPEN/CLOSED), SK `startDate` — ใช้กับ `GET /events` |

ฟิลด์: `title`, `type`, `description`, `venue`, `hours`, `startDate`, `endDate`, `bookingOpensAt`, `bookingClosesAt`, `payment {bank, accountName, accountNo}`, `maxLotsPerSeller` (default 1), `slipDeadlineHours` (default 24), `floorPlanKey`, `zones [{id, name, size, price, amenities}]`

### 4.3 Lots
| Key | ค่า |
|---|---|
| PK `eventId` | |
| SK `lotId` | รหัสล็อก เช่น `A01` |

ฟิลด์: `zoneId`, `size`, `price`, `status` (AVAILABLE/HELD/BOOKED/DISABLED), `bookingId` (การจองที่ถือล็อกอยู่)

**Item โควตาในตารางเดียวกัน:** SK `QUOTA#<sellerId>` ฟิลด์ `count` ใช้จำกัดจำนวนล็อกต่อผู้ขายต่องาน (อยู่ partition เดียวกับล็อกจึงอยู่ใน transaction เดียวกันได้ง่าย) ตอน query ล็อกให้กรอง item ที่ขึ้นต้นด้วย `QUOTA#` ออก

### 4.4 Bookings
| Key | ค่า |
|---|---|
| PK `bookingId` | |
| GSI `bySeller` | PK `sellerId`, SK `createdAt` |
| GSI `byEventStatus` | PK `eventId`, SK `statusCreatedAt` เช่น `PENDING_REVIEW#2026-11-01T...` (กรองตามสถานะด้วย `begins_with`) |

ฟิลด์: `eventId`, `lotId`, `sellerId`, `status`, `shopName`, `productDescription`, `amount`, `slipKey`, `slipUploadedAt`, `expiresAt`, `scheduleName`, `reason`, `moves [{from, to, at, by}]`, `decidedBy`, `decidedAt`, `createdAt`, `updatedAt`

### 4.5 Notifications
| Key | ค่า |
|---|---|
| PK `userId` | |
| SK `sk` = `createdAt#notificationId` | เรียงเวลาใหม่สุดด้วย `ScanIndexForward=False` |

ฟิลด์: `type`, `message`, `bookingId?`, `eventId?`, `link?`, `read` และ `ttl` (ลบอัตโนมัติหลัง 90 วัน ใช้ DynamoDB TTL ได้ เพราะไม่ต้องตรงเวลา)

---

## 5. Cognito และการยืนยันตัวตน

### 5.1 สมัครสมาชิก
1. หน้าเว็บเรียก `signUp` ของ `aws-amplify/auth` พร้อม `custom:role` = `seller` หรือ `organizer` และข้อมูลโปรไฟล์
2. ผู้ใช้กรอก OTP จากอีเมล (`confirmSignUp`)
3. Trigger **PostConfirmation** (`functions/post_confirmation/app.py`) ทำงาน
   - สร้าง item ใน Users
   - `seller` → `cognito_idp.admin_add_user_to_group(GroupName="Seller")` และ `status = ACTIVE`
   - `organizer` → ไม่ใส่ group, `status = PENDING` และสร้าง Notification ให้ Admin ทุกคน (query Users `ADMIN#ACTIVE`)
   - ใช้ `event["userPoolId"]` จาก trigger event จึงไม่ต้องตั้ง env `USER_POOL_ID` ให้ function นี้
   - ต้อง `return event` กลับให้ Cognito เสมอ

### 5.2 การตรวจสิทธิ์ต่อ request
- API Gateway JWT authorizer ตรวจ access token แล้วส่ง claims ให้ Lambda ที่ `event["requestContext"]["authorizer"]["jwt"]["claims"]`
- `shared/auth.py`
  - ไม่มี claims (route ไม่ได้ผูก authorizer) → 401 เสมอ
  - `get_user(app)` อ่าน `sub` และ `cognito:groups` (HTTP API ส่ง groups มาเป็น string เช่น `"[Seller]"` ต้อง parse เอง)
  - `require_group("Organizer")` ถ้าไม่มี → 403
  - โหลด Users item แล้วเช็ก `status == "ACTIVE"` เพื่อกันบัญชีที่ถูกระงับซึ่ง token ยังไม่หมดอายุ (ไม่เกิน 1 ชม.)
- ตรวจความเป็นเจ้าของ: ผู้จัดงาน → `event["organizerId"] == sub`, ผู้ขาย → `booking["sellerId"] == sub`

### 5.3 หลัง Admin อนุมัติผู้จัดงาน
- token เดิมยังไม่มี group `Organizer` หน้าเว็บต้องเรียก `fetchAuthSession({ forceRefresh: true })` (หรือให้ล็อกอินใหม่) หลังได้รับแจ้งเตือน

### 5.4 บัญชี Admin
- สร้างด้วย `scripts/seed.py` (`admin_create_user` + `admin_set_user_password(Permanent=True)` + ใส่ group `Admin`) รหัสผ่านอ่านจาก env ไม่เขียนลงไฟล์

---

## 6. รายการ Lambda และ API

แต่ละ function ใช้ `APIGatewayHttpResolver` ของ Powertools เป็น router:

```python
app = APIGatewayHttpResolver()


@app.post("/bookings")
def create_booking():
    user = require_group(app, "Seller")
    body = CreateBookingInput.model_validate(app.current_event.json_body)
    ...


def lambda_handler(event, context):
    return app.resolve(event, context)
```

| Function | Route | สิทธิ์ |
|---|---|---|
| **events** | `GET /health` (ไว้ตรวจหลัง deploy) · `GET /events` · `GET /events/{id}` · `GET /events/{id}/lots` | สาธารณะ (ไม่มี authorizer) |
| | `POST /events` · `PUT /events/{id}` · `POST /events/{id}/close` | Organizer (เจ้าของ) |
| | `POST /events/{id}/floorplan-url` · `GET /events/{id}/floorplan` | Organizer / สาธารณะ |
| | `POST /events/{id}/lots` (รับช่วง เช่น `{zoneId, prefix:"A", from:1, to:20}`) · `PUT /events/{id}/lots/{lotId}` | Organizer (เจ้าของ) |
| | `GET /events/{id}/summary` | Organizer (เจ้าของ) |
| **bookings** | `POST /bookings` · `GET /bookings/me` | Seller |
| | `POST /bookings/{id}/slip-url` · `POST /bookings/{id}/slip` | Seller (เจ้าของ) |
| | `GET /bookings/{id}/slip` (คืน presigned GET อายุ 5 นาที) | เจ้าของการจอง / ผู้จัดงานของงาน |
| | `POST /bookings/{id}/cancel` | Seller (ก่อนอนุมัติ) / Organizer (หลังอนุมัติ ต้องมีเหตุผล) |
| | `GET /events/{id}/bookings?status=` · `POST /bookings/{id}/approve` · `POST /bookings/{id}/reject` | Organizer (เจ้าของงาน) |
| **admin** | `GET /admin/organizers?status=PENDING` · `POST /admin/organizers/{userId}/approve` · `POST /admin/organizers/{userId}/reject` · `POST /admin/users/{userId}/suspend` · `GET /admin/events` | Admin |
| **me** | `GET /me` · `PUT /me` | ทุกบทบาท |
| | `GET /notifications` (คืนรายการ + `unreadCount`) · `POST /notifications/read` (`{ids}` หรือ `{all:true}`) | ทุกบทบาท |
| **post_confirmation** | Cognito trigger | — |
| **expire_booking** | EventBridge Scheduler | — |

> เพิ่มจาก scope: `GET/PUT /me` (แก้โปรไฟล์ตามหัวข้อ 3.1), `GET /bookings/{id}/slip` (ดูสลิป), `floorplan-url` (อัปโหลดภาพผัง), `POST /events/{id}/close`, `GET /admin/events`
>
> route `GET /events/{id}/bookings` อยู่ใน function **bookings** ไม่ใช่ events ต้องผูก route นี้ให้ถูก function ใน API Gateway Console (ข้อ 3.5)

### รูปแบบ response
- สำเร็จ: `200/201` พร้อม JSON ของข้อมูลตรง ๆ
- ผิดพลาด: `{ "error": { "code": "LOT_NOT_AVAILABLE", "message": "ล็อกนี้มีผู้จองแล้ว" } }`
  - `400` validation (`pydantic.ValidationError`) · `401` ไม่มี token · `403` ไม่มีสิทธิ์/บัญชีถูกระงับ · `404` ไม่พบ · `409` สถานะชน (จองซ้ำ, สถานะเปลี่ยนไปแล้ว)
- ลงทะเบียน `@app.exception_handler(AppError)` และ `@app.exception_handler(ValidationError)` ไว้ใน `shared/http.py` ใช้ร่วมกันทุก function
- `ConditionalCheckFailedException` / `TransactionCanceledException` (จาก `botocore.exceptions.ClientError`) แปลงเป็น `409` พร้อม code ตาม condition ที่ล้มเหลว (ดูจาก `CancellationReasons`)

---

## 7. Booking flow (หัวใจของระบบ)

ทุกการเปลี่ยนสถานะอยู่ใน `domain/booking.py` เป็นฟังก์ชันที่คืน list ของ `TransactItems` (ใช้กับ `dynamodb_client.transact_write_items`) เพื่อ unit test ได้โดยไม่ต้องต่อ AWS

> `transact_write_items` ต้องใช้ **low-level client** (ค่าในรูป `{"S": "..."}`) ให้ใช้ `boto3.dynamodb.types.TypeSerializer` แปลงค่าใน `domain/booking.py`

### 7.1 ส่งคำขอจอง `POST /bookings`
Body: `{ eventId, lotIds: ["A01", "A02"], shopName, productDescription }` จองได้หลายล็อกในคำขอเดียวแบบ **all-or-nothing** (D2) แต่ละล็อกได้ Booking ของตัวเอง ผูกกันด้วย `groupId` (ULID เดียวกันทั้งชุด) จองแบบ **ทั้งงาน** ไม่แยกรายวัน (D1)

ตรวจก่อน: งาน `OPEN` และเวลาปัจจุบันอยู่ระหว่าง `bookingOpensAt`–`bookingClosesAt`, บัญชี ACTIVE, `lotIds` ไม่ซ้ำกัน และ `1 ≤ len(lotIds) ≤ maxLotsPerSeller`

`TransactItems` (N = จำนวนล็อก รวม 2N + 1 item):
1. **Update Lot** × N `status → HELD`, `bookingId = :id` — condition `#status = :available`
2. **Put Booking** × N `status = PENDING_PAYMENT`, `groupId`, `amount` = ราคาของล็อกนั้น, `expiresAt = now + slipDeadlineHours` — condition `attribute_not_exists(bookingId)`
3. **Update Quota** `QUOTA#<sellerId>` `count + N` — condition `attribute_not_exists(#count) OR #count <= :maxMinusN` (`:maxMinusN = maxLotsPerSeller − N`)

ล็อกใดล็อกหนึ่งไม่ว่าง → ทั้ง transaction ล้ม คืน `409 LOT_NOT_AVAILABLE` พร้อม `lotIds` ที่ไม่ว่าง (ดูจากตำแหน่งใน `CancellationReasons`)

Response `201`: `{ groupId, bookings: [...] }`

หลังจากนั้นแต่ละ Booking เดินสถานะของตัวเอง (อนุมัติ ย้าย ปฏิเสธ ยกเลิก ทีละล็อก และโควตา −1 ต่อล็อก) `groupId` ใช้แค่จัดกลุ่มแสดงผล

หลัง transaction สำเร็จ:
- สร้าง schedule `expire-<groupId>` ชุดละ 1 ตัว ด้วย `scheduler.create_schedule(ScheduleExpression="at(yyyy-mm-ddThh:mm:ss)", Target={Arn: expire_booking, RoleArn: LabRole, Input: {"bookingIds": [...]}}, ActionAfterCompletion="DELETE", FlexibleTimeWindow={"Mode": "OFF"})` แล้ว expire_booking วนรัน transaction หมดเวลาทีละ Booking
- แจ้งเตือนผู้จัดงาน "มีคำขอจองใหม่"
- ถ้าสร้าง schedule ไม่สำเร็จ ให้ log error แต่ไม่ล้มคำขอ (มี fallback ในข้อ 7.6)

### 7.2 อัปโหลดสลิป
1. `POST /bookings/{id}/slip-url` → `s3.generate_presigned_post` (ไม่ใช่ PUT) เพราะกำหนด `["content-length-range", 1, 5242880]` และ `Content-Type` (jpg/png/pdf) ได้ คีย์ `slips/<eventId>/<bookingId>/<ulid>.<ext>` อายุ 5 นาที
2. หน้าเว็บอัปโหลดตรงไป S3 ด้วย `FormData`
3. `POST /bookings/{id}/slip` `{key}` → `head_object` ตรวจว่ามีไฟล์จริงและ key ขึ้นต้นด้วย prefix ของ booking นี้ แล้ว update Booking `status → PENDING_REVIEW` condition `#status = :pending_payment AND expiresAt > :now`
4. ลบ schedule หมดเวลา (ถ้าลบไม่ได้ก็ไม่เป็นไร เพราะ expire_booking มี condition กันอยู่) และแจ้งเตือนผู้จัดงาน

### 7.3 อนุมัติ `POST /bookings/{id}/approve`
- ไม่ย้ายล็อก: Booking `PENDING_REVIEW → APPROVED` + Lot `HELD → BOOKED` (condition `bookingId = :id`)
- ย้ายล็อก (`newLotId`):
  1. Booking `→ APPROVED`, `lotId = newLotId`, append `moves` ด้วย `list_append`
  2. ล็อกเดิม `HELD → AVAILABLE`, `REMOVE bookingId` — condition `bookingId = :id`
  3. ล็อกใหม่ `AVAILABLE → BOOKED` — condition `#status = :available`
  4. `amount` ใช้ราคาเดิมที่ผู้ขายโอนมา (ไม่คิดส่วนต่าง)
- แจ้งเตือนผู้ขาย (approved / moved)

### 7.4 ปฏิเสธ / ยกเลิก
| การกระทำ | สถานะต้นทาง | Booking | Lot | Quota |
|---|---|---|---|---|
| ผู้ขายยกเลิก | PENDING_PAYMENT, PENDING_REVIEW | → CANCELLED | HELD → AVAILABLE | −1 |
| ผู้จัดงานปฏิเสธ (ต้องมีเหตุผล) | PENDING_REVIEW | → REJECTED | HELD → AVAILABLE | −1 |
| ผู้จัดงานยกเลิก (ต้องมีเหตุผล) | APPROVED | → CANCELLED | BOOKED → AVAILABLE | −1 |
| หมดเวลา (ระบบ) | PENDING_PAYMENT | → EXPIRED | HELD → AVAILABLE | −1 |

ทุกแถวเป็น transaction เดียว โดย condition ที่ Booking คือสถานะต้นทาง และที่ Lot คือ `bookingId = :id`

### 7.5 expire_booking
รับ `{"bookingIds": [...]}` จาก Scheduler แล้วรัน transaction "หมดเวลา" ด้านบนทีละ Booking ถ้า condition ล้มเหลว (ผู้ขายอัปโหลดสลิปหรือยกเลิกไปแล้ว) ให้จบเงียบ ๆ ถ้าสำเร็จแจ้งเตือนผู้ขาย

### 7.6 Fallback กรณี schedule ไม่ทำงาน
`GET /events/{id}/lots` และ `POST /bookings` ถือว่าล็อก HELD ที่ Booking เป็น `PENDING_PAYMENT` และเลย `expiresAt` แล้วเป็นล็อกว่าง โดยเรียก transaction หมดเวลาก่อนทำงานต่อ

---

## 8. การแจ้งเตือน

`shared/notify.py` มีฟังก์ชันเดียว `notify(user_id, type, message, **refs)` ข้อความภาษาไทยอยู่ใน `domain/messages.py` ใช้ถ้อยคำชุดเดียวกับ `Frontend/src/data/notifications.ts`

| เหตุการณ์ | ผู้รับ |
|---|---|
| คำขอจองใหม่, อัปโหลดสลิป, ผู้ขายยกเลิก | ผู้จัดงานของงาน |
| อนุมัติ, ย้ายล็อก, ปฏิเสธ, ยกเลิกโดยผู้จัดงาน, หมดเวลา | ผู้ขาย |
| มีผู้สมัครผู้จัดงาน | Admin ทุกคน |
| อนุมัติ/ปฏิเสธผู้จัดงาน, ระงับบัญชี | ผู้ใช้คนนั้น |

เขียน notification **หลัง** transaction หลักสำเร็จ (ไม่อยู่ใน transaction เดียวกัน) ถ้าเขียนไม่สำเร็จแค่ log ไว้ หน้าเว็บ poll `GET /notifications` ทุก 30–60 วินาที

---

## 9. Admin

- **อนุมัติผู้จัดงาน**: `admin_add_user_to_group(GroupName="Organizer")` แล้ว Users `PENDING → ACTIVE` (condition `#status = :pending`) แจ้งเตือนผู้ใช้
- **ปฏิเสธ**: Users `→ REJECTED` + `statusReason` แจ้งเตือน (บัญชียังล็อกอินได้แต่เข้าเมนูผู้จัดงานไม่ได้)
- **ระงับ**: `admin_disable_user` + `admin_user_global_sign_out` แล้ว Users `→ SUSPENDED` (middleware ในข้อ 5.2 กัน token ที่ยังไม่หมดอายุ)

---

## 10. การทดสอบ

### 10.1 ช่วงที่ 1 — ในเครื่อง (ทุกฟีเจอร์ต้องมีเทสต์ระดับนี้ก่อน merge)
| ระดับ | เครื่องมือ | ทดสอบอะไร |
|---|---|---|
| Unit | pytest | state machine และ TransactItems ใน `domain/booking.py`, สร้างรหัสล็อกเป็นช่วง, pydantic schema, auth helper |
| Handler + AWS จำลอง | pytest + **moto** (`mock_aws`) | เรียก `lambda_handler` ด้วย event ของ HTTP API (`tests/apigw.py`) กับ DynamoDB/S3 จำลอง รวมถึง conditional write และ transaction ที่ต้องล้มเหลว |
| Flow ครบในเครื่อง | pytest + moto | สร้างงาน → จอง → สลิป → อนุมัติ/ย้าย/ปฏิเสธ/ยกเลิก โดยเรียก handler ต่อกันในเทสต์เดียว |
| จองซ้ำ | pytest + moto | จองล็อกเดียวกัน 2 ครั้ง ครั้งที่ 2 ต้องได้ `409` และจองหลายล็อกที่มีล็อกไม่ว่างต้องล้มทั้งชุด (ทดสอบ condition ไม่ใช่ความพร้อมกันจริง) |
| หมดเวลา | pytest + moto | เรียก handler ของ `expire_booking` ตรง ๆ โดยส่งเวลาปัจจุบันเข้าไป (ห้ามเรียก `datetime.now()` ใน domain ให้รับ `now` เป็นพารามิเตอร์) |
| Cognito / Scheduler | pytest + moto (`cognito-idp`, `scheduler`) | โค้ดเรียก API ถูกตัว ถูกพารามิเตอร์ เช่น `admin_add_user_to_group`, `create_schedule` · ตรวจสิทธิ์ของ LabRole ไม่ได้ |

### 10.2 ช่วงที่ 2 — บน AWS (สัปดาห์ 11)
| เรื่อง | ทำไมต้องทดสอบบน AWS |
|---|---|
| Integration test ด้วย `requests` กับ resource ชุด `dev` | flow ครบผ่าน API Gateway + JWT จริง และตรวจว่าตั้งค่าใน Console ตรงกับโค้ด (ชื่อตาราง, env, route, authorizer) |
| `scripts/race_test.py` ยิง `POST /bookings` ล็อกเดียวกันพร้อมกัน **5 request** | ความพร้อมกันจริงของ DynamoDB ต้องได้ `201` × 1, `409` × 4 |
| Lambda เรียก `scheduler.create_schedule` ด้วย LabRole | ต้องใช้ `iam:PassRole` ยังไม่เคยทดสอบ (ข้อ 13) |
| หมดเวลาจริงด้วย `slipDeadlineHours` สั้น (เช่น 2 นาที) | Scheduler ยิงจริงแล้ว Booking เป็น EXPIRED |
| PostConfirmation trigger และรูปแบบ `cognito:groups` ใน claims | moto ไม่เรียก trigger และรูปแบบ claims ของ HTTP API ต้องดูของจริง |
| อัปโหลดสลิปจากเบราว์เซอร์ตรงไป S3 | CORS ของ bucket |

โครงของเทสต์ (`tests/`):
- fixture `aws` ใน `conftest.py` สร้างตารางใน moto จาก `tests/tables.py` ถ้าแก้ key หรือ GSI ต้องแก้ 3 ที่ให้ตรงกัน: หัวข้อ 4, `tests/tables.py` และตารางใน Console (ข้อ 3.1)
- `apigw.py` มี `http_event(method, path, body, claims)` สร้าง event ของ HTTP API พร้อม JWT claims และ `FakeLambdaContext`

---

## 11. การพัฒนาในเครื่อง และการ Deploy ใน Learner Lab

### 11.1 ในเครื่อง (ช่วงที่ 1 ใช้แค่ส่วนนี้)
ต้องมี Python 3.13 เท่านั้น

> ใช้ Python **3.13** ทำ venv เท่านั้น เวอร์ชันใหม่กว่า (เช่น 3.15) ยังไม่มี wheel ของ pyyaml / pydantic-core ทำให้ `pip install` ล้มบน Windows · ติดตั้งได้ด้วย `py install 3.13` แล้วสร้าง venv ด้วย `py -V:3.13 -m venv .venv`

```bash
cd Backend
py -V:3.13 -m venv .venv         # macOS/Linux: python3.13 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

# ต้องผ่านทั้ง 2 อย่างก่อน push ทุกครั้ง
pytest
ruff check . && ruff format --check .
```

### 11.2 ขึ้น AWS (ช่วงที่ 2 สัปดาห์ 11–12 — ยังไม่ทำตอนนี้)
1. สร้าง zip ในเครื่อง: `python scripts/build_zip.py` → ได้ `build/lambda.zip`
2. สร้าง resource ใน Console ตามหัวข้อ 3 ตามลำดับ 3.1 → 3.5
3. อัปโหลด `build/lambda.zip` ให้ Lambda ทั้ง 6 ตัว
4. เปิด `<Invoke URL>/health` ต้องได้ `{"status":"ok"}`
5. ใส่ค่าในข้อ 3.7 ให้ Amplify แล้วรัน `scripts/seed.py` เพื่อสร้างบัญชีเดโม

**อัปเดตโค้ดครั้งต่อไป:** รัน `build_zip.py` ใหม่ แล้วอัปโหลด zip ให้ทุก function ที่โค้ดเปลี่ยน (ถ้าแก้ `shared/` หรือ `domain/` ต้องอัปโหลดทุกตัว)

- ชุด `prod` สร้างในบัญชีหลัก ส่วนสมาชิกคนอื่นสร้างชุด `dev` ในบัญชีตัวเอง (ชื่อมี stage อยู่ ถ้าใช้บัญชีเดียวกันต้องใช้ stage ต่างกัน)
- `scripts/seed.py` ต้องใช้ credentials ของ Lab: copy จาก **AWS Details** ทุก session หรือรันใน CloudShell

---

## 12. แผนงานรายสัปดาห์

สัปดาห์ 1–10 เป็นงานโค้ดล้วน ("เสร็จ" = โค้ด + เทสต์ในเครื่องผ่าน + เพิ่ม route/env ที่ต้องใช้ลงหัวข้อ 3 แล้ว) ยังไม่สร้างอะไรบน AWS

| สัปดาห์ | ช่วง | งาน backend | ผู้รับผิดชอบหลัก |
|---|---|---|---|
| 1–2 | โค้ด | ตั้งโปรเจกต์ Python + pytest/moto, `tests/tables.py`, `shared/`, `scripts/build_zip.py` ✅ · spike ใน Lab ✅ | กิตติพิชญ์ |
| 3–4 | โค้ด | post_confirmation, `shared/auth.py`, `/me`, Admin API, `scripts/seed.py` (เขียนไว้ก่อน รันจริงสัปดาห์ 11) | กิตติพิชญ์, สรวิชญ์ |
| 5–6 | โค้ด | Events/Lots API, สร้างล็อกเป็นช่วง, อัปโหลดภาพผัง (presigned POST ทดสอบด้วย moto) | สรวิชญ์ |
| 7–8 | โค้ด | `POST /bookings` (transaction + quota), สลิป, `shared/scheduler.py` + expire_booking, fallback 7.6 | ปณวัฒน์ |
| 9 | โค้ด | approve / move / reject / cancel, summary | ปณวัฒน์ |
| 10 | โค้ด | Notifications API และเติม notify ให้ครบทุกเหตุการณ์ · เทสต์ flow ครบในเครื่อง | สรวิชญ์ |
| 11 | AWS | **สร้าง resource ชุด `dev` ใน Console** (หัวข้อ 3) + อัปโหลด zip, ทดสอบเรื่องในข้อ 10.2, race test, เชื่อม frontend, แก้บั๊ก | ทุกคน |
| 12 | AWS | สร้างชุด `prod`, seed ข้อมูลเดโม, เอกสาร API | กิตติพิชญ์ |

---

## 13. ความเสี่ยงที่ต้องทดสอบตั้งแต่สัปดาห์แรก (spike) — ✅ ผ่านทั้ง 4 ข้อ (2026-10-27, us-east-1)

1. ✅ **EventBridge Scheduler ใช้ `LabRole` เรียก Lambda ได้** — LabRole มี `scheduler.amazonaws.com` ใน trust policy อยู่แล้ว ทดสอบด้วย `AWS::Scheduler::Schedule` แบบ `rate(1 minutes)` ที่สร้างผ่าน CloudFormation
   - ⚠️ ยังไม่ได้ทดสอบกรณีที่ **Lambda (รันด้วย LabRole) เป็นคนเรียก `scheduler.create_schedule`** แบบ `at(...)` และส่ง `RoleArn` = LabRole ซึ่งต้องใช้สิทธิ์ `scheduler:CreateSchedule` และ `iam:PassRole` บน LabRole จะได้ทดสอบตอน deploy สัปดาห์ 11 ระหว่างนี้โค้ดต้องไม่พึ่ง Scheduler อย่างเดียว: ทำ fallback ข้อ 7.6 ให้ใช้ได้จริงตั้งแต่สัปดาห์ 7 ถ้าสัปดาห์ 11 พบว่าสร้าง schedule ไม่ได้ ให้สร้าง EventBridge Scheduler แบบ `rate(5 minutes)` ใน Console (role = LabRole) เรียก expire_booking ให้กวาดหา Booking ที่หมดเวลา
2. ✅ **Cognito PostConfirmation + `admin_add_user_to_group` ผ่าน `LabRole`** — ผู้ใช้ถูกใส่ group อัตโนมัติหลัง confirm
3. ✅ **`sam deploy` ไม่สร้าง IAM resource** — ทดสอบตอนยังวางแผนใช้ SAM ตอนนี้ไม่ใช้ SAM แล้ว ข้อที่ยังใช้ได้คือ Lambda ใช้ LabRole เป็น execution role ได้
4. ✅ **Powertools layer `:40` + pydantic import ได้** — pydantic 2.14.1 มากับ layer ไม่ต้อง bundle เอง

โค้ดทดสอบอยู่ที่ `~/spike` ใน CloudShell

---

## 14. จุดที่ spec กับ Frontend ปัจจุบันยังไม่ตรงกัน (ต้องตัดสินใจก่อนเริ่ม)

Frontend ใน `Frontend/src/types.ts` มีความสามารถมากกว่า scope บางส่วน ควรตกลงกันก่อนเริ่ม Booking API

| เรื่อง | Scope | Frontend ตอนนี้ | ข้อเสนอ |
|---|---|---|---|
| จองรายวัน | 1 การจอง = 1 ล็อกตลอดงาน | `days[]` + ค่าธรรมเนียมรายวัน, สถานะล็อกแยกต่อวัน | ✅ **ตัดสินแล้ว (2026-10-27): จองทั้งงานตาม scope** Lots SK เป็น `lotId` frontend ต้องซ่อนการเลือกวันและ surcharge และใช้ `lotState` ชุดเดียว |
| จองหลายล็อกพร้อมกัน | ไม่ระบุ | `BookingDraft.lots[]`, `groupId` | ✅ **ตัดสินแล้ว (2026-10-27): ได้ แบบ all-or-nothing** ดูข้อ 7.1 |
| ขั้นตอนสลิป | PENDING_PAYMENT → อัปโหลดภายใน 24 ชม. | แนบสลิปพร้อมส่งคำขอเลย | backend รองรับทั้งสองแบบได้: หน้าเว็บเรียก `slip-url` + `slip` ต่อทันทีหลังสร้าง |
| ผังล็อก | ตาราง/รายการ + รูปภาพผัง | ตัววาดผังแบบกริด (`layout`, `cols`, `rows`) | เก็บ `layout` เป็นฟิลด์ใน Events ได้ แต่ scope ระบุว่าผังคลิกเลือกอยู่นอกขอบเขต |
| อนุมัติอัตโนมัติ, เช็กอิน QR, ไฟฟ้า/จำนวนคน | ไม่มี | `autoApprove`, `checkedIn`, `power`, `staff` | นอก scope ตอนนี้ เพิ่มภายหลังได้ถ้ามีเวลา |
| ชื่อสถานะ | `PENDING_PAYMENT`, `PENDING_REVIEW`, ... | `pending`, `approved`, ... | backend ใช้ชื่อตาม scope แล้วให้ frontend map เอง |
| ชื่อฟิลด์ | — | camelCase | backend ส่ง JSON เป็น **camelCase** ให้ตรง frontend (ภายใน Python ใช้ snake_case ได้ ใช้ `alias_generator=to_camel` ของ pydantic) |
