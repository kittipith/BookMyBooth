# BookMyBooth Backend — แผนการพัฒนา

> อ้างอิงจาก [BookMtBooth-scope.md](../BookMtBooth-scope.md)
> Stack: API Gateway (HTTP API) + AWS Lambda (**Python 3.13**) + DynamoDB + S3 + Cognito + EventBridge Scheduler
> IaC: AWS SAM | สภาพแวดล้อม: AWS Academy Learner Lab (`us-east-1`, ใช้ `LabRole`)

---

## 1. หลักการออกแบบ

1. **ทุก resource อยู่ใน SAM template เดียว** สั่ง `sam deploy` ครั้งเดียวได้ backend ครบ เพื่อให้สร้างใหม่ได้ทันทีถ้าบัญชี Lab ถูก reset
2. **ไม่สร้าง IAM role เอง** ทุก Lambda, Scheduler และ Cognito trigger ใช้ `LabRole` ที่รับเข้ามาเป็น parameter
3. **Lambda น้อยตัว แยกตามกลุ่มงาน** (ประมาณ 6 ตัว) ใช้ router ภายในแทนการทำ 1 endpoint ต่อ 1 function ลดจำนวน cold start และช่วยให้อยู่ใต้ limit 10 concurrent ของ Lab
4. **สถานะทุกอย่างเปลี่ยนด้วย DynamoDB Transaction + Condition** กันการจองซ้ำและกัน race condition ระหว่างผู้ขาย ผู้จัดงาน และตัวหมดเวลา
5. **ตรวจสิทธิ์ 2 ชั้น** API Gateway ตรวจ JWT ส่วน Lambda ตรวจ group และความเป็นเจ้าของข้อมูลซ้ำ
6. **Lambda ทุกตัวใช้โค้ดชุดเดียวกัน** (`CodeUri: src/`) ต่างกันแค่ `Handler` ทำให้แชร์ `shared/` และ `domain/` ได้โดยไม่ต้องทำ Layer เอง

---

## 2. โครงสร้างโฟลเดอร์

```
Backend/
├── PLAN.md                      ← ไฟล์นี้
├── template.yaml                ← SAM template (ทุก resource)
├── samconfig.toml               ← ค่าตั้งต้นของ sam deploy (stack name, region, parameters)
├── pyproject.toml               ← ตั้งค่า pytest, ruff
├── requirements-dev.txt         ← pytest, moto, boto3, ruff, requests (ใช้ในเครื่อง ไม่ขึ้น Lambda)
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
│   ├── seed.py                  ← สร้างบัญชีเดโม (admin/organizer/seller) และงานตัวอย่าง
│   └── race_test.py             ← ยิงจองล็อกเดียวกันพร้อมกัน ตรวจว่าสำเร็จแค่ 1
├── events/                      ← ตัวอย่าง event JSON สำหรับ sam local invoke
└── tests/                       ← pytest + moto
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

> - ล็อกเลข version ของ layer ไว้ (`:40`) เพื่อให้ deploy ซ้ำได้ผลเหมือนเดิม ถ้าต้องการ version ใหม่ ดูจาก SSM parameter `/aws/service/powertools/python/x86_64/python3.13/latest` (`lambda:ListLayerVersions` ข้าม account ถูกปฏิเสธใน Lab)
> - dependency ที่ bundle เองเหลือแค่ `python-ulid` ซึ่งเป็น pure Python จึงรัน `sam build` บน Windows ได้โดยไม่ต้องใช้ Docker หรือ CloudShell

---

## 3. Resource ใน SAM template

| Resource | ชนิด | ตั้งค่าสำคัญ |
|---|---|---|
| `LabRoleName` | Parameter | default `LabRole` แล้วสร้าง ARN ด้วย `!Sub arn:${AWS::Partition}:iam::${AWS::AccountId}:role/${LabRoleName}` จึง deploy ได้ทุกบัญชี Lab โดยไม่ต้องกรอก account id |
| `Stage` | Parameter | `dev` / `prod` ใช้ต่อท้ายชื่อ resource |
| `AllowedOrigins` | Parameter (CommaDelimitedList) | default `http://localhost:5173` ใส่โดเมน Amplify เพิ่มตอน deploy ใช้กับ CORS ของ HttpApi และ bucket |
| `Globals.Function` | | `Runtime: python3.13`, `Architectures: [x86_64]`, `CodeUri: src/`, `Layers: [Powertools]`, `Timeout: 10`, `MemorySize: 256`, env = ชื่อตาราง/bucket/ARN (**ไม่มี `Role`** เพราะ SAM ไม่รองรับ `Role` ใน Globals) |
| `UserPool` | `AWS::Cognito::UserPool` | ล็อกอินด้วยอีเมล, auto-verify email, ส่งอีเมลแบบ `COGNITO_DEFAULT`, custom attribute `custom:role` (seller/organizer), trigger `PostConfirmation` |
| `UserPoolClient` | `AWS::Cognito::UserPoolClient` | ไม่มี secret (ใช้จาก SPA), flow `USER_SRP_AUTH` + refresh token |
| `SellerGroup` / `OrganizerGroup` / `AdminGroup` | `AWS::Cognito::UserPoolGroup` | |
| `HttpApi` | `AWS::Serverless::HttpApi` | JWT authorizer เป็น `DefaultAuthorizer` (issuer = User Pool, audience = Client ID), CORS ตาม `AllowedOrigins`, **throttling burst 10 / rate 20** เพื่อไม่ให้เกิน concurrency ของ Lab · route สาธารณะต้องใส่ `Auth: { Authorizer: NONE }` |
| ตาราง DynamoDB 5 ตาราง | `AWS::DynamoDB::Table` | On-demand, ดูหัวข้อ 4 |
| `FilesBucket` | `AWS::S3::Bucket` | private, block public access, CORS ให้ POST/GET จากหน้าเว็บ |
| Lambda 6 ตัว | `AWS::Serverless::Function` | `Handler: functions.bookings.app.lambda_handler` เป็นต้น และใส่ `Role: !Sub ...role/${LabRoleName}` **ทีละตัว** |
| `PostConfirmationPermission` | `AWS::Lambda::Permission` | ให้ Cognito เรียก Lambda ได้ |
| Outputs | | `ApiUrl`, `UserPoolId`, `UserPoolClientId`, `Region`, `BucketName` → ใส่เป็น env `VITE_*` ใน Amplify |

> หมายเหตุ: ห้ามใช้ `Policies:` ใน Lambda ของ SAM เพราะจะทำให้ SAM สร้าง role ใหม่ ให้ใช้ `Role:` อย่างเดียว ตรวจหลัง deploy ว่า stack ไม่มี resource `AWS::IAM::*` (`CAPABILITY_IAM` ที่ `sam deploy` ใส่ให้เองไม่มีผลถ้า template ไม่สร้าง IAM)

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
   - ใช้ `event["userPoolId"]` จาก trigger event แทนการอ้าง User Pool ใน env เพื่อเลี่ยง circular dependency ใน template
   - ต้อง `return event` กลับให้ Cognito เสมอ

### 5.2 การตรวจสิทธิ์ต่อ request
- API Gateway JWT authorizer ตรวจ access token แล้วส่ง claims ให้ Lambda ที่ `event["requestContext"]["authorizer"]["jwt"]["claims"]`
- `shared/auth.py`
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
> route `GET /events/{id}/bookings` อยู่ใน function **bookings** ไม่ใช่ events ต้องผูก route นี้ให้ถูก function ใน template

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

| ระดับ | เครื่องมือ | ทดสอบอะไร |
|---|---|---|
| Unit | pytest | state machine และ TransactItems ใน `domain/booking.py`, สร้างรหัสล็อกเป็นช่วง, pydantic schema, auth helper |
| Unit + AWS จำลอง | pytest + **moto** (`@mock_aws`) | handler ทั้งตัวกับ DynamoDB/S3 จำลอง รวมถึง conditional write และ transaction ที่ต้องล้มเหลว |
| Integration | pytest + `requests` กับ stack `dev` ที่ deploy แล้ว | flow ครบ: สมัคร → สร้างงาน → จอง → สลิป → อนุมัติ/ย้าย/ปฏิเสธ/หมดเวลา |
| Race | `scripts/race_test.py` (`concurrent.futures.ThreadPoolExecutor`) | ยิง `POST /bookings` ล็อกเดียวกันพร้อมกัน **5 request** (ไม่เกิน limit ของ Lab) ต้องได้ `201` หนึ่งครั้ง และ `409` ที่เหลือ |
| หมดเวลา | ตั้ง `slipDeadlineHours` ของงานทดสอบให้สั้น (เช่น 2 นาที) | ตรวจว่า Booking เป็น EXPIRED และล็อกกลับเป็น AVAILABLE |

moto จำลอง Cognito และ Scheduler ได้บางส่วนเท่านั้น ส่วนนี้ให้ทดสอบกับ stack `dev` จริง

โครงของเทสต์ (`tests/`):
- fixture `aws` ใน `conftest.py` **สร้างตารางใน moto จาก `template.yaml` โดยตรง** (key + GSI) แก้ตารางที่ template ที่เดียว เทสต์ก็ตามไปเอง
- `apigw.py` มี `http_event(method, path, body, claims)` สร้าง event ของ HTTP API พร้อม JWT claims และ `FakeLambdaContext`
- `test_template.py` กันไม่ให้ template หลุดกฎของ Lab (ไม่มี `AWS::IAM::*`, ทุก Function ใช้ LabRole, ไม่มี `Policies`, ไม่มี `Role` ใน Globals)

---

## 11. การ Deploy ใน Learner Lab

ต้องมี Python 3.13, AWS CLI, SAM CLI (ไม่ต้องใช้ Docker เพราะ dependency ที่ bundle เองเป็น pure Python)

> ใช้ Python **3.13** ทำ venv เท่านั้น เวอร์ชันใหม่กว่า (เช่น 3.15) ยังไม่มี wheel ของ pyyaml / pydantic-core ทำให้ `pip install` ล้มบน Windows · ติดตั้งได้ด้วย `py install 3.13` แล้วสร้าง venv ด้วย `py -V:3.13 -m venv .venv`

```bash
# ครั้งแรกในแต่ละบัญชี (หรือหลัง reset)
cd Backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest
ruff check . && ruff format --check .
cfn-lint template.yaml           # หรือ sam validate --lint

sam build
sam deploy                       # ค่าอยู่ใน samconfig.toml แล้ว (stack bookmybooth-dev, us-east-1, Stage=dev)
curl <ApiUrl>/health             # ต้องได้ {"status":"ok"}

# ครั้งต่อไป
sam build && sam deploy

# prod / เพิ่มโดเมน Amplify
sam build && sam deploy --config-env prod --parameter-overrides "Stage=prod AllowedOrigins=http://localhost:5173,https://main.xxxx.amplifyapp.com"

# สร้างบัญชีเดโมและข้อมูลตัวอย่าง
python scripts/seed.py --stack bookmybooth-dev
```

- ทุก session ต้อง copy credentials ใหม่จาก **AWS Details** หรือรันใน CloudShell
- หลัง deploy เอาค่าจาก Outputs ไปใส่ใน Amplify Hosting → Environment variables: `VITE_API_URL`, `VITE_USER_POOL_ID`, `VITE_USER_POOL_CLIENT_ID`, `VITE_REGION`
- บัญชีหลัก (prod) ใช้ stack `bookmybooth-prod` สมาชิกคนอื่น deploy `bookmybooth-dev` ลงบัญชีตัวเอง
- เพิ่ม `.venv/` และ `.aws-sam/` ใน `.gitignore`

---

## 12. แผนงานรายสัปดาห์

| สัปดาห์ | งาน backend | ผู้รับผิดชอบหลัก |
|---|---|---|
| 1–2 | ตั้งโปรเจกต์ Python + SAM + pytest/moto, ตาราง DynamoDB, bucket, HttpApi + authorizer, **spike ทดสอบ 4 เรื่องที่เสี่ยงใน Lab** (ข้อ 13) | กิตติพิชญ์ |
| 3–4 | Cognito + post_confirmation, `shared/auth.py`, `/me`, Admin API, seed script | กิตติพิชญ์, สรวิชญ์ |
| 5–6 | Events/Lots API, สร้างล็อกเป็นช่วง, อัปโหลดภาพผัง | สรวิชญ์ |
| 7–8 | `POST /bookings` (transaction + quota), สลิป, Scheduler + expire_booking, fallback | ปณวัฒน์ |
| 9 | approve / move / reject / cancel, summary | ปณวัฒน์ |
| 10 | Notifications API และเติม notify ให้ครบทุกเหตุการณ์ | สรวิชญ์ |
| 11 | Integration test, race test, แก้บั๊ก | ทุกคน |
| 12 | Deploy stack prod, seed ข้อมูลเดโม, เอกสาร API | กิตติพิชญ์ |

---

## 13. ความเสี่ยงที่ต้องทดสอบตั้งแต่สัปดาห์แรก (spike) — ✅ ผ่านทั้ง 4 ข้อ (2026-10-27, us-east-1)

1. ✅ **EventBridge Scheduler ใช้ `LabRole` เรียก Lambda ได้** — LabRole มี `scheduler.amazonaws.com` ใน trust policy อยู่แล้ว ทดสอบด้วย `AWS::Scheduler::Schedule` แบบ `rate(1 minutes)` ที่สร้างผ่าน CloudFormation
   - ⚠️ ยังไม่ได้ทดสอบกรณีที่ **Lambda (รันด้วย LabRole) เป็นคนเรียก `scheduler.create_schedule`** แบบ `at(...)` และส่ง `RoleArn` = LabRole ซึ่งต้องใช้สิทธิ์ `scheduler:CreateSchedule` และ `iam:PassRole` บน LabRole ทดสอบตอนทำ `shared/scheduler.py` สัปดาห์ 7 ถ้าไม่ได้ ใช้ EventBridge rule `rate(5 minutes)` ใน template กวาดหา Booking ที่หมดเวลา ร่วมกับ fallback ข้อ 7.6
2. ✅ **Cognito PostConfirmation + `admin_add_user_to_group` ผ่าน `LabRole`** — ผู้ใช้ถูกใส่ group อัตโนมัติหลัง confirm
3. ✅ **`sam deploy` ไม่สร้าง IAM resource** — ต้องใส่ `Role:` ที่ Function ทีละตัว (ใส่ใน `Globals` ไม่ได้)
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
