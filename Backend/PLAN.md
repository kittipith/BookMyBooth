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
│   │   ├── events/app.py        ← งาน ผังกริด ล็อก สรุปงาน
│   │   ├── bookings/app.py      ← จอง สลิป อนุมัติ ปฏิเสธ ยกเลิก
│   │   ├── admin/app.py         ← อนุมัติผู้จัดงาน ระงับบัญชี
│   │   ├── me/app.py            ← โปรไฟล์ และการแจ้งเตือน
│   │   ├── post_confirmation/app.py ← Cognito trigger หลังยืนยันอีเมล
│   │   └── expire_booking/app.py    ← ถูกเรียกโดย EventBridge Scheduler
│   ├── shared/
│   │   ├── http.py              ← json response, แปลง Decimal, map AppError → HTTP status
│   │   ├── auth.py              ← อ่าน claims, require_group(), ตรวจสถานะบัญชี
│   │   ├── db.py                ← boto3 Table/client + ชื่อตารางจาก env, query_all/scan_all
│   │   ├── cognito.py           ← cognito-idp client + USER_POOL_ID
│   │   ├── clock.py             ← now() / iso() เวลา UTC (domain รับ `now` เป็นพารามิเตอร์)
│   │   ├── ids.py               ← new_id() เป็น ULID
│   │   ├── s3.py                ← presigned POST / GET
│   │   ├── scheduler.py         ← สร้าง/ลบ schedule หมดเวลาจอง (ชื่อ expire-<groupId>)
│   │   ├── booking_ops.py       ← งานจองที่ใช้ DB ร่วมกันหลาย function: expire(), expire_stale_lots()
│   │   ├── notify.py            ← เขียน Notification
│   │   └── errors.py            ← AppError(code, status, message)
│   └── domain/
│       ├── booking.py           ← state machine + สร้าง TransactItems ของการจอง
│       ├── events.py            ← publishStatus, คำนวณ status (SCHEDULED/OPEN/CLOSED/ENDED), view
│       ├── lots.py              ← รหัสล็อกจากผังกริด, เทียบรายการล็อกเพื่อ sync (plan_sync), view
│       ├── users.py             ← role/status, roleStatus, ฟิลด์ที่แก้ได้ต่อ role, สร้าง Users item
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

> คู่มือทีละขั้นแบบละเอียด (ปุ่มใน Console, routes ครบ 32 ตัว, smoke test, อาการที่เจอบ่อย, จุดในโค้ดที่เกี่ยวข้อง) อยู่ที่ [AWS-SETUP.md](../AWS-SETUP.md) ที่ root ของ repo ถ้าแก้หัวข้อนี้ต้องแก้ไฟล์นั้นด้วย

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

### 3.2 S3 — bucket เก็บสลิป
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

ฟิลด์: `email`, `username` (Cognito), `role` (SELLER/ORGANIZER/ADMIN), `status` (ACTIVE/PENDING/REJECTED/SUSPENDED), `statusReason`, `statusChangedBy`, `displayName`, `phone`, `shopName`, `category`, `line`, `bio`, `power` (ผู้ขาย), `orgName`, `payment` (ผู้จัดงาน `{bank, accountName, accountNo}`), `createdAt`, `updatedAt`

- ฟิลด์โปรไฟล์ที่แก้เองได้ (`PUT /me`): ผู้ขาย `displayName, phone, shopName, category, line, bio, power` (D5f) · ผู้จัดงาน `displayName, phone, orgName, payment` (บัญชีรับเงินตั้งต้น ตรวจด้วย `PaymentInput` เหมือนในงาน — I3) · Admin `displayName, phone` (อยู่ใน `domain/users.py`)
- `roleStatus` และ `username` ไม่ส่งออกไปหน้าเว็บ

### 4.2 Events
| Key | ค่า |
|---|---|
| PK `eventId` | |
| GSI `byOrganizer` | PK `organizerId`, SK `createdAt` |
| GSI `byPublishStatus` | PK `publishStatus` (DRAFT/OPEN/CLOSED), SK `startDate` — ใช้กับ `GET /events` |

ฟิลด์ที่ผู้จัดงานกรอก (ตรวจด้วย `EventInput` ใน `domain/schemas.py`):
| ฟิลด์ | รูปแบบ |
|---|---|
| `title`, `round?`, `description`, `venue`, `hours` | ข้อความ (`round` คือรอบ/ครั้งที่ เช่น "ครั้งที่ 3") |
| `type` | `ตลาดนัด` / `งานแฟร์` / `งานมหาวิทยาลัย` |
| `startDate`, `endDate` | `YYYY-MM-DD` (วันตามเวลาไทย) |
| `bookingOpensAt`, `bookingClosesAt` | ISO-8601 ที่มี timezone เก็บเป็น UTC `...Z` |
| `payment` | `{bank, accountName, accountNo}` |
| `maxLotsPerSeller` | 1–50 หรือ `null` = ไม่จำกัด (default 1) |
| `slipDeadlineMinutes` | นาทีที่ให้อัปโหลดสลิปหลังจอง 2–10080 (default 1440 = 24 ชม.) ใช้นาทีเพื่อทดสอบหมดเวลาแบบสั้นได้ |
| `zones` | `[{id, name, size, price, amenities}]` 1–20 โซน `id` เช่น `A` ไม่ซ้ำกัน `price` เป็นบาทจำนวนเต็ม |
| `cols`, `rows`, `layout`, `disabledCells`, `lotSizes` | **ผังกริดจาก frontend เก็บตามที่ส่งมา** backend ไม่ใช้คำนวณ (D4) ตรวจแค่ `len(layout) = cols × rows` |

ฟิลด์ที่ระบบตั้ง: `eventId`, `organizerId`, `organizerName` (ชื่อองค์กรตอนสร้างงาน), `publishStatus` (DRAFT/OPEN/CLOSED), `publishedAt`, `createdAt`, `updatedAt`

ตอนส่งออกเพิ่ม `status` ที่คำนวณจากเวลา: `DRAFT` · `SCHEDULED` (ยังไม่ถึงเวลาเปิดจอง) · `OPEN` · `CLOSED` (ปิดเอง หรือเลยเวลาปิดจอง) · `ENDED` (เลยวันสุดท้ายของงาน)

### 4.3 Lots
| Key | ค่า |
|---|---|
| PK `eventId` | |
| SK `lotId` | รหัสล็อก เช่น `A01` |

ฟิลด์: `zoneId`, `size?` (ขนาดเฉพาะล็อก ถ้าไม่มีใช้ขนาดของโซน), `status` (AVAILABLE/HELD/BOOKED/DISABLED), `bookingId` (การจองที่ถือล็อกอยู่), `holdExpiresAt` (สำเนา `expiresAt` ของการจองที่ยังรอสลิป ใช้หาล็อกที่หมดเวลาในข้อ 7.6 ลบออกเมื่อแนบสลิป), `createdAt`, `updatedAt`

- **ราคาไม่เก็บในล็อก** ใช้ `price` ของโซนเสมอ (แก้ราคาโซนแล้วล็อกตามทันที) ตอนจองค่อยคัดลอกราคาไปเก็บใน Booking `amount`
- รหัสล็อกมาจากผังกริด: รหัสโซน + ลำดับ 2 หลักนับตามช่อง เช่น `A01`, `A02` (`domain/lots.lot_codes` ตรงกับ `lotCodes` ใน frontend)
- **sync ล็อก** (`PUT /events/{id}/lots`): frontend ส่งรายการล็อกทั้งหมด `[{lotId, zoneId, size?, disabled?}]` backend เทียบกับของเดิมแล้วสร้าง/แก้/ลบ ล็อกที่ HELD/BOOKED ห้ามย้ายโซน เปลี่ยนขนาด ปิด หรือลบ (→ 409 `LOT_IN_USE` พร้อม `lotIds` และไม่เขียนอะไรเลย) การเขียนใช้ transaction ที่มี condition ว่าล็อกยังว่างอยู่ กันชนกับผู้ขายที่จองเข้ามาพร้อมกัน

**Item โควตาในตารางเดียวกัน:** SK `QUOTA#<sellerId>` ฟิลด์ `count` ใช้จำกัดจำนวนล็อกต่อผู้ขายต่องาน (อยู่ partition เดียวกับล็อกจึงอยู่ใน transaction เดียวกันได้ง่าย) ตอน query ล็อกให้กรอง item ที่ขึ้นต้นด้วย `QUOTA#` ออก

### 4.4 Bookings
| Key | ค่า |
|---|---|
| PK `bookingId` | |
| GSI `bySeller` | PK `sellerId`, SK `createdAt` |
| GSI `byEventStatus` | PK `eventId`, SK `statusCreatedAt` เช่น `PENDING_REVIEW#2026-11-01T...` (กรองตามสถานะด้วย `begins_with`) |

ฟิลด์: `groupId` (การจองที่ส่งมาพร้อมกัน), `eventId`, `eventTitle`, `organizerId` (คัดลอกจากงาน ใช้ตรวจสิทธิ์และแจ้งเตือน), `lotId`, `sellerId`, `status` (PENDING_PAYMENT/PENDING_REVIEW/APPROVED/REJECTED/CANCELLED/EXPIRED), `shopName`, `productDescription`, `amount` (ราคาโซนตอนจอง), `slipKey`, `slipUploadedAt`, `expiresAt`, `reason`, `moves [{from, to, at, by}]`, `decidedBy`, `decidedAt`, `createdAt`, `updatedAt`

- ข้อมูลร้านเสริม (D5c, ไม่บังคับ): `category`, `staff` (ข้อความ เช่น "2 คน"), `power` (bool ต้องใช้ไฟ), `note`
- เช็กอิน (D5b): `checkedIn`, `checkedInAt`, `checkedInBy`
- ชื่อ schedule ไม่ต้องเก็บ ใช้ `expire-<groupId>` เสมอ
- `statusCreatedAt` อัปเดตทุกครั้งที่เปลี่ยนสถานะ (ใช้ `createdAt` เดิม) และไม่ส่งออกไปหน้าเว็บ

### 4.5 Notifications
| Key | ค่า |
|---|---|
| PK `userId` | |
| SK `sk` = `createdAt#notificationId` | เรียงเวลาใหม่สุดด้วย `ScanIndexForward=False` |

ฟิลด์: `type`, `message`, `bookingId?`, `eventId?`, `link?`, `read` และ `ttl` (ลบอัตโนมัติหลัง 90 วัน ใช้ DynamoDB TTL ได้ เพราะไม่ต้องตรงเวลา)

---

## 5. Cognito และการยืนยันตัวตน

### 5.1 สมัครสมาชิก
โปรไฟล์ **เก็บใน DynamoDB (ตาราง Users) เท่านั้น** ไม่เพิ่ม attribute ใน Cognito (ตัดสินใจ 2026-10-27) Cognito มีแค่ `email` และ `custom:role`

1. หน้าเว็บเรียก `signUp` ของ `aws-amplify/auth` พร้อม `custom:role` = `seller` หรือ `organizer`
2. ผู้ใช้กรอก OTP จากอีเมล แล้วหน้าเว็บเรียก `confirmSignUp` โดยส่งโปรไฟล์จากฟอร์มสมัครไปใน **`options.clientMetadata`** (ค่าทุกตัวเป็น string ไม่ถูกเก็บใน Cognito ส่งผ่านไปถึง trigger อย่างเดียว):
   ```ts
   await confirmSignUp({ username: email, confirmationCode, options: {
     clientMetadata: { name, phone, orgName, category } } })   // orgName = ชื่อร้าน (ผู้ขาย) หรือชื่อองค์กร (ผู้จัดงาน)
   ```
   หน้าเว็บควรเก็บค่าฟอร์มไว้ใน `sessionStorage` ระหว่างรอ OTP ถ้าหายไป (เช่น ปิดแท็บ) ผู้ใช้กรอกเพิ่มทีหลังได้ด้วย `PUT /me`
3. Trigger **PostConfirmation** (`functions/post_confirmation/app.py`) ทำงาน
   - ทำเฉพาะ `triggerSource = PostConfirmation_ConfirmSignUp` (ยืนยันรีเซ็ตรหัสผ่านก็เรียก trigger นี้ ต้องข้าม)
   - สร้าง item ใน Users ด้วย condition `attribute_not_exists(userId)` ถ้า Cognito เรียกซ้ำจะไม่สร้างซ้ำและไม่แจ้งเตือนซ้ำ
   - ตรวจ clientMetadata ด้วย `SignupProfile` ถ้าไม่ถูกต้องให้ข้ามโปรไฟล์ (ไม่ทำให้ยืนยันอีเมลไม่ผ่าน) `orgName` เก็บเป็น `shopName` สำหรับผู้ขาย และ `orgName` สำหรับผู้จัดงาน
   - `custom:role` ที่ไม่ใช่ `seller`/`organizer` (เช่น `admin`) ถือเป็นผู้ขาย สมัครเป็น Admin เองไม่ได้
   - `seller` → `admin_add_user_to_group(GroupName="Seller")` (ทำทุกครั้ง เรียกซ้ำได้) และ `status = ACTIVE`
   - `organizer` → ไม่ใส่ group, `status = PENDING` และสร้าง Notification ให้ Admin ทุกคน (query Users `ADMIN#ACTIVE`)
   - เก็บ `username` ของ Cognito (`event["userName"]`) ไว้ใน Users ให้ Admin API ใช้เรียก Cognito
   - ใช้ `event["userPoolId"]` จาก trigger event จึงไม่ต้องตั้ง env `USER_POOL_ID` ให้ function นี้
   - ต้อง `return event` กลับให้ Cognito เสมอ

### 5.2 การตรวจสิทธิ์ต่อ request
- API Gateway JWT authorizer ตรวจ access token แล้วส่ง claims ให้ Lambda ที่ `event["requestContext"]["authorizer"]["jwt"]["claims"]`
- `shared/auth.py`
  - ไม่มี claims (route ไม่ได้ผูก authorizer) → 401 เสมอ
  - `get_user(app)` อ่าน `sub` และ `cognito:groups` (HTTP API ส่ง groups มาเป็น string เช่น `"[Seller]"` ต้อง parse เอง)
  - `require_group(app, "Organizer")` ถ้าไม่มี group → 403 `FORBIDDEN` แล้วต้องเป็น `ACTIVE`
  - `current_user(app, allow_inactive=True)` ใช้กับ `/me` ให้ผู้จัดงานที่ PENDING/REJECTED ดูและแก้โปรไฟล์ได้
  - โหลด Users item ทุก request: ไม่พบ → 403 `ACCOUNT_NOT_FOUND`, `SUSPENDED` → 403 `ACCOUNT_SUSPENDED` เสมอ (กัน token ที่ยังไม่หมดอายุ ไม่เกิน 1 ชม.), ไม่ ACTIVE → 403 `ACCOUNT_NOT_ACTIVE`
- ตรวจความเป็นเจ้าของ: ผู้จัดงาน → `event["organizerId"] == sub`, ผู้ขาย → `booking["sellerId"] == sub`

### 5.3 หลัง Admin อนุมัติผู้จัดงาน
- token เดิมยังไม่มี group `Organizer` หน้าเว็บต้องเรียก `fetchAuthSession({ forceRefresh: true })` (หรือให้ล็อกอินใหม่) หลังได้รับแจ้งเตือน

### 5.4 บัญชี Admin
- สร้างด้วย `scripts/seed.py` (`admin_create_user` + `admin_set_user_password(Permanent=True)` + ใส่ group `Admin`) รหัสผ่านอ่านจาก env `SEED_PASSWORD` ไม่เขียนลงไฟล์
- สคริปต์สร้างบัญชีเดโม 3 บัญชี (`admin@`, `organizer@`, `seller@bookmybooth.test`) เป็น ACTIVE ทั้งหมด และเขียน Users เอง (trigger ไม่ทำงานกับ `admin_create_user`) รันซ้ำได้
- รัน: `SEED_PASSWORD='...' python scripts/seed.py --user-pool-id <id> --stage dev`

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
| **events** | `GET /health` (ไว้ตรวจหลัง deploy) · `GET /events?status=OPEN\|CLOSED` · `GET /events/{id}` · `GET /events/{id}/lots` (งาน DRAFT → 404) | สาธารณะ (ไม่มี authorizer) |
| | `GET /organizer/events` (งานของตัวเองทุกสถานะ รวมผังกริด ใหม่สุดก่อน) | Organizer |
| | `POST /events` (สร้างเป็น DRAFT) · `PUT /events/{id}` (แก้บางฟิลด์ ส่ง `publishStatus:"OPEN"` เพื่อเผยแพร่ ต้องมีล็อกแล้ว) · `POST /events/{id}/close` (OPEN → CLOSED) | Organizer (เจ้าของ) |
| | `PUT /events/{id}/lots` (`{lots:[{lotId, zoneId, size?, disabled?}]}` sync ทั้งชุด) | Organizer (เจ้าของ) |
| | `GET /events/{id}/summary` (จำนวนล็อกตามสถานะ, จำนวนการจองตามสถานะ, รายได้จากการจองที่อนุมัติ) | Organizer (เจ้าของ) |
| **bookings** | `POST /bookings` · `GET /bookings/me` | Seller |
| | `POST /bookings/{id}/slip-url` · `POST /bookings/{id}/slip` | Seller (เจ้าของ) |
| | `GET /bookings/{id}/slip` (คืน presigned GET อายุ 5 นาที) | เจ้าของการจอง / ผู้จัดงานของงาน |
| | `POST /bookings/{id}/cancel` | Seller (ก่อนอนุมัติ) / Organizer (หลังอนุมัติ ต้องมีเหตุผล) |
| | `GET /events/{id}/bookings?status=` · `POST /bookings/{id}/approve` · `POST /bookings/{id}/reject` · `POST /bookings/{id}/check-in` | Organizer (เจ้าของงาน) |
| | `GET /organizer/vendors` (สถิติร้านในงานของตัวเอง) | Organizer |
| **admin** | `GET /admin/organizers?status=PENDING` · `POST /admin/organizers/{userId}/approve` · `POST /admin/organizers/{userId}/reject` · `POST /admin/users/{userId}/suspend` · `POST /admin/users/{userId}/unsuspend` · `GET /admin/events` (+ `status`, `bookingCount`, `revenue` ต่องาน) · `GET /admin/users?role=` (route ใหม่ อนุมัติ 2026-10-28) | Admin |
| **me** | `GET /me` · `PUT /me` | ทุกบทบาท |
| | `GET /notifications` (คืนรายการ + `unreadCount`) · `POST /notifications/read` (`{ids}` หรือ `{all:true}`) | ทุกบทบาท |
| **post_confirmation** | Cognito trigger | — |
| **expire_booking** | EventBridge Scheduler | — |

> เพิ่มจาก scope: `GET/PUT /me` (แก้โปรไฟล์ตามหัวข้อ 3.1), `GET /bookings/{id}/slip` (ดูสลิป), `POST /events/{id}/close`, `GET /admin/events`, `GET /organizer/events` · ตามข้อ 14 (D5): `POST /bookings/{id}/check-in`, `GET /organizer/vendors`, `POST /admin/users/{userId}/unsuspend` (เพิ่ม 2026-10-27 ต้องสร้าง route ใน Console ด้วย)
>
> ตัดออก (D4 ใช้ผังกริดแทนรูปผัง 2026-10-27): `POST /events/{id}/floorplan-url`, `GET /events/{id}/floorplan`, การสร้างล็อกแบบช่วง และ `PUT /events/{id}/lots/{lotId}` (ใช้ sync ทั้งชุดแทน)
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

ตรวจก่อน (ตามลำดับ):
- Seller ที่ ACTIVE · งานไม่ใช่ DRAFT และ `status` เป็น `OPEN` (ไม่งั้น `409 BOOKING_CLOSED`)
- `lotIds` 1–20 ล็อก ไม่ซ้ำ (จำกัด 20 ให้ transaction 2N + 1 ไม่เกิน 100 item) · มากกว่า `maxLotsPerSeller` → `409 QUOTA_EXCEEDED`
- ทุกล็อกต้องมีในงาน (ไม่งั้น `400 UNKNOWN_LOT`) · เรียก fallback ข้อ 7.6 กับล็อกที่ขอ แล้วถ้ายังมีล็อกไม่ว่าง → `409 LOT_NOT_AVAILABLE` พร้อม `lotIds`

`TransactItems` (`domain/booking.create_items`, N = จำนวนล็อก รวม 2N + 1 item):
1. **Update Lot** × N `status → HELD`, `bookingId = :id`, `holdExpiresAt = expiresAt` — condition `#status = :available`
2. **Put Booking** × N `status = PENDING_PAYMENT`, `groupId`, `amount` = ราคาโซนของล็อกนั้น ณ ตอนจอง, `expiresAt = now + slipDeadlineMinutes` — condition `attribute_not_exists(bookingId)`
3. **Update Quota** `QUOTA#<sellerId>` `ADD count N` — condition `attribute_not_exists(#count) OR #count <= :limit` (`:limit = maxLotsPerSeller − N`, ไม่ใส่ condition ถ้า `maxLotsPerSeller = null`)

transaction ล้ม → ดูตำแหน่งใน `CancellationReasons`: ตำแหน่ง 0..N−1 = ล็อกนั้นถูกจองไปพร้อมกัน → `409 LOT_NOT_AVAILABLE` `{lotIds}` · ตำแหน่ง 2N = โควตาเต็ม (รวมที่จองไว้ก่อน) → `409 QUOTA_EXCEEDED`

Response `201`: `{ groupId, bookings: [...] }`

หลังจากนั้น **ตัดสินทั้งชุด** (D7 2026-10-28): อนุมัติ ปฏิเสธ ยกเลิก และเช็กอิน รับ `bookingId` ใดก็ได้ในชุด แล้วทำกับทุก Booking ในชุดที่ยังไม่จบ (ไม่ใช่ REJECTED/CANCELLED/EXPIRED) ใน transaction เดียว หาสมาชิกชุดจาก GSI `bySeller` + `groupId` (ไม่ต้องมี GSI ใหม่) · ทุกสมาชิกต้องอยู่ในสถานะต้นทางที่ถูกต้อง ไม่งั้น `409 INVALID_STATUS` · ตอบ `{ groupId, bookings }` · แจ้งเตือนข้อความเดียวต่อชุด · Booking ยังเก็บล็อกละ record (ใช้ตอนย้ายล็อก แสดงสถานะบนผัง และนับโควตา) ส่วนหมดเวลาก็ทำทั้งชุด (ข้อ 7.5)

หลัง transaction สำเร็จ:
- สร้าง schedule `expire-<groupId>` ชุดละ 1 ตัว ด้วย `scheduler.create_schedule(ScheduleExpression="at(yyyy-mm-ddThh:mm:ss)", ScheduleExpressionTimezone="UTC", Target={Arn: EXPIRE_FUNCTION_ARN, RoleArn: SCHEDULER_ROLE_ARN, Input: {"bookingIds": [...]}}, ActionAfterCompletion="DELETE", FlexibleTimeWindow={"Mode": "OFF"})` แล้ว expire_booking วนรัน transaction หมดเวลาทีละ Booking
- แจ้งเตือนผู้จัดงาน `booking_new` (ข้อความเดียวต่อชุด ระบุทุกล็อก)
- ถ้าสร้าง schedule ไม่สำเร็จ ให้ log error แต่ไม่ล้มคำขอ (มี fallback ในข้อ 7.6)

### 7.2 อัปโหลดสลิป — สลิปเดียวต่อชุด (D3 ตัดสิน 2026-10-27)
ผู้ขายโอนยอดรวมครั้งเดียว สลิปที่แนบผ่าน booking ใดก็ได้ในชุดจะติดให้ **ทุก booking ในชุดที่ยัง PENDING_PAYMENT**
1. `POST /bookings/{id}/slip-url` `{contentType}` (`image/jpeg` / `image/png` / `application/pdf`) → `s3.generate_presigned_post` (ไม่ใช่ PUT) เพราะกำหนด `["content-length-range", 1, 5242880]` และ `Content-Type` ได้ คีย์ `slips/<eventId>/<groupId>/<ulid>.<ext>` อายุ 5 นาที → `{url, fields, key}` · ถ้าหมดเวลาแล้วจะเปลี่ยนเป็น EXPIRED และคืน `409 BOOKING_EXPIRED`
2. หน้าเว็บอัปโหลดตรงไป S3 ด้วย `FormData` (ใส่ทุกค่าใน `fields` ก่อน แล้วใส่ `file` เป็นช่องสุดท้าย)
3. `POST /bookings/{id}/slip` `{key}` → ตรวจ key ขึ้นต้นด้วย `slips/<eventId>/<groupId>/` (`400 INVALID_SLIP_KEY`), `head_object` ว่ามีไฟล์จริงและไม่เกิน 5 MB (`400 SLIP_NOT_UPLOADED` / `SLIP_TOO_LARGE`) แล้ว transaction เดียว (`domain/booking.slip_items`): ทุก booking ในชุด `PENDING_PAYMENT → PENDING_REVIEW` condition `#status = :payment AND expiresAt > :now` + ล็อก `REMOVE holdExpiresAt` condition `bookingId = :id`
4. ลบ schedule `expire-<groupId>` (ลบไม่ได้ก็ไม่เป็นไร เพราะ expire_booking มี condition กันอยู่) และแจ้งเตือนผู้จัดงาน `booking_slip_uploaded`
5. ดูสลิป `GET /bookings/{id}/slip` → `{url}` presigned GET อายุ 5 นาที ให้เจ้าของการจอง หรือผู้จัดงาน (`organizerId`) เท่านั้น

### 7.3 อนุมัติทั้งชุด `POST /bookings/{id}/approve` `{ moves?: {ล็อกเดิม: ล็อกใหม่} }`
ต้องเป็นผู้จัดงานของงานนั้น (`booking.organizerId`) และทุก Booking ในชุดต้อง `PENDING_REVIEW` (ยังไม่แนบสลิป → `409 INVALID_STATUS`) TransactItems อยู่ใน `domain/booking.approve_items` (≤ 3 item ต่อล็อก รวม ≤ 60)
- ล็อกที่ไม่ย้าย (ไม่อยู่ใน `moves` หรือย้ายไปล็อกเดิม): Booking `PENDING_REVIEW → APPROVED` + `decidedBy`, `decidedAt` · Lot `HELD → BOOKED` (condition `bookingId = :id`)
- ล็อกที่ย้าย (ล็อกใหม่ในงานเดียวกัน): ล็อกเดิมไม่อยู่ในชุด หรือไม่พบล็อกปลายทาง → `400 UNKNOWN_LOT` · ย้ายหลายล็อกไปล็อกเดียวกัน → `400 DUPLICATE_LOT` · เรียก fallback 7.6 กับล็อกปลายทาง แล้วถ้ายังไม่ว่าง → `409 LOT_NOT_AVAILABLE`
  1. Booking `→ APPROVED`, `lotId = ล็อกใหม่`, append `moves` `{from, to, at, by}` ด้วย `list_append(if_not_exists(moves, []), ...)` — condition `#status = :review`
  2. ล็อกเดิม `HELD → AVAILABLE`, `REMOVE bookingId, holdExpiresAt` — condition `bookingId = :id`
  3. ล็อกใหม่ `AVAILABLE → BOOKED`, `bookingId = :id` — condition `#status = :available`
  4. `amount` ใช้ราคาเดิมที่ผู้ขายโอนมา (ไม่คิดส่วนต่าง) โควตาไม่เปลี่ยน
- แจ้งเตือนผู้ขายครั้งเดียวต่อชุด `booking_approved` (ระบุทุกล็อก) หรือ `booking_moved` (ระบุล็อกที่ย้าย)

### 7.3.1 รายการการจองของงาน `GET /events/{id}/bookings?status=`
ผู้จัดงานเจ้าของงาน · query GSI `byEventStatus` (`begins_with(statusCreatedAt, "<STATUS>#")` เมื่อระบุ status) · Booking ที่เลยเวลาแล้วเปลี่ยนเป็น EXPIRED ก่อนตอบ · เรียงใหม่สุดก่อน → `{ items }`

### 7.4 ปฏิเสธ / ยกเลิก
| การกระทำ | สถานะต้นทาง | Booking | Lot | Quota |
|---|---|---|---|---|
| ผู้ขายยกเลิก | PENDING_PAYMENT, PENDING_REVIEW | → CANCELLED | HELD → AVAILABLE | −1 |
| ผู้จัดงานปฏิเสธ (ต้องมีเหตุผล) | PENDING_REVIEW | → REJECTED | HELD → AVAILABLE | −1 |
| ผู้จัดงานยกเลิก (ต้องมีเหตุผล) | APPROVED | → CANCELLED | BOOKED → AVAILABLE | −1 |
| หมดเวลา (ระบบ) | PENDING_PAYMENT | → EXPIRED | HELD → AVAILABLE | −1 |

ทุกแถวเป็น transaction เดียว (`domain/booking.release_items` รับหลาย Booking ในชุด) โดย condition ที่ Booking คือสถานะต้นทาง (หมดเวลาเพิ่ม `expiresAt <= :now`) และที่ Lot คือ `bookingId = :id` ล็อกถูก `REMOVE bookingId, holdExpiresAt` · โควตารวมเป็น update เดียว `−N` (transaction แตะ item ซ้ำไม่ได้) · ปฏิเสธ ยกเลิก และหมดเวลาทำ**ทั้งชุด** (D7)

- ปฏิเสธ `POST /bookings/{id}/reject` `{reason}` (บังคับ) เก็บ `reason`, `decidedBy`, `decidedAt` แจ้งเตือนผู้ขาย `booking_rejected`
- ยกเลิก `POST /bookings/{id}/cancel` route เดียวใช้ทั้งสองฝ่าย ดูจากผู้เรียก: เจ้าของการจอง (Seller) → ยกเลิกก่อนอนุมัติ ไม่ต้องมีเหตุผล แจ้งเตือนผู้จัดงาน · ผู้จัดงานของงาน (Organizer) → ยกเลิกได้เฉพาะ APPROVED ต้องมี `{reason}` แจ้งเตือนผู้ขาย (`booking_cancelled` ทั้งสองแบบ ข้อความต่างกัน) · การจองที่รอตรวจให้ผู้จัดงานใช้ปฏิเสธแทน (`409 INVALID_STATUS`)

### 7.5 expire_booking
- รับ `{"bookingIds": [...]}` จาก Scheduler แล้วเรียก `shared/booking_ops.expire` ทีละ Booking ซึ่งหมดเวลา**ทุกล็อกในชุด**ที่เลยเวลาแล้วใน transaction เดียว (โควตา −N) และแจ้งเตือนผู้ขาย `booking_expired` ครั้งเดียวต่อชุด (D7) · Booking ที่ถูกหมดเวลาไปพร้อมล็อกอื่นในชุดแล้วนับว่าหมดเวลาด้วย · ถ้า condition ล้มเหลว (ผู้ขายอัปโหลดสลิปหรือยกเลิกไปแล้ว หรือยังไม่ถึงเวลา) ให้จบเงียบ ๆ คืน `{"expired": [...]}`
- **โหมดกวาด:** ถ้า input ไม่มี `bookingIds` จะ scan หา Booking `PENDING_PAYMENT` ที่ `expiresAt <= now` ทั้งหมด ใช้กับ schedule `rate(5 minutes)` ได้เลยโดยไม่ต้องแก้โค้ด ถ้าสัปดาห์ 11 พบว่า Lambda สร้าง schedule เองไม่ได้ (ข้อ 13)

### 7.7 เช็กอิน `POST /bookings/{id}/check-in` (D5b)
- QR ในตั๋วของผู้ขาย = `bookingId` ของล็อกแรกในชุด ผู้จัดงานสแกนแล้วเรียก route นี้ เช็กอิน**ทั้งชุด**ครั้งเดียว (D7)
- ต้องเป็นผู้จัดงานของงาน, ทุก Booking ในชุด `APPROVED` และวันนี้ (เวลาไทย) อยู่ระหว่าง `startDate`–`endDate` (ไม่งั้น `409 NOT_EVENT_DAY`)
- SET `checkedIn = true`, `checkedInAt`, `checkedInBy` ทุกล็อกที่ยังไม่เช็กอินใน transaction เดียว (`domain/booking.check_in_items`) condition `#status = :approved AND attribute_not_exists(checkedInAt)` · เช็กอินแล้วเรียกซ้ำคืนผลเดิม (ไม่เปลี่ยนเวลา)

### 7.8 สถิติร้าน `GET /organizer/vendors` (D5e)
- รวม Booking `APPROVED` ทุกงานของผู้จัดคนนั้น จัดกลุ่มตาม `sellerId` → `{ items: [{ shop: <โปรไฟล์ผู้ขาย>, approved, total, pastCount, showRate, flagged }] }` เรียงตาม `approved` มากสุดก่อน
- นับครั้งตามชุด (`groupId`) ไม่ใช่ตามล็อก (D7): `approved` = จำนวนชุด, `total` = ยอดรวมทุกล็อก
- คำนวณแบบเดียวกับ `sellerStats` ใน frontend (`domain/vendors.py`): `pastCount` = ชุดในงานที่ `ENDED` แล้ว · ชุดที่เช็กอินล็อกใดก็ได้ถือว่ามา · `showRate` = % ที่เช็กอินในงานที่จบแล้ว (`null` ถ้ายังไม่มี) · `flagged` = `pastCount ≥ 2` และ `showRate < 60`

### 7.6 Fallback กรณี schedule ไม่ทำงาน
`shared/booking_ops.expire_stale_lots`: ล็อก `HELD` ที่ `holdExpiresAt <= now` → โหลด Booking แล้วรัน transaction หมดเวลา จากนั้นถือว่าล็อกว่าง ใช้ใน
- `GET /events/{id}/lots` ก่อนส่งสถานะล็อก
- `POST /bookings` กับล็อกที่ขอจอง
- `GET /bookings/me` และ `slip-url` / `slip` ก็ตรวจ Booking ที่เลยเวลาแล้วเปลี่ยนเป็น EXPIRED ก่อนตอบ

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

`type` ที่ทำแล้ว: `booking_new`, `booking_slip_uploaded` (ใหม่), `booking_approved`, `booking_moved`, `booking_rejected`, `booking_cancelled`, `booking_expired` (ใหม่), `organizer_pending`, `organizer_approved`, `organizer_rejected`, `account_suspended`, `account_unsuspended` (ใหม่) · ข้อความ `booking_new` เปลี่ยนเป็น "…รอผู้ขายแนบสลิป" เพราะ D3 แนบสลิปทีหลัง (frontend เดิมเขียนว่า "พร้อมแนบสลิปแล้ว") · `booking_approved` ไม่มี "ดู QR เช็กอินได้เลย" (frontend แสดงปุ่ม QR เองจากสถานะ APPROVED)

**API (สัปดาห์ 10, function `me`)** ทุกบทบาทรวมผู้จัดงานที่ PENDING/REJECTED (บัญชีที่ถูกระงับเรียกไม่ได้)
- `GET /notifications` → `{ items: [{ id, type, message, read, createdAt, link?, bookingId?, eventId? }], unreadCount }` ใหม่สุดก่อน 50 รายการ `unreadCount` นับทั้งหมด
- `POST /notifications/read` `{ ids: [...] }` (≤ 100) หรือ `{ all: true }` → `{ updated, unreadCount }` แก้ได้เฉพาะของตัวเอง
- ทุก notification มี `ttl` = 90 วัน (เปิด TTL ที่ตารางใน Console ข้อ 3.1)

---

## 9. Admin

ทุกการเปลี่ยนสถานะอัปเดต `status`, `roleStatus`, `statusChangedBy`, `updatedAt` พร้อม condition ถ้าสถานะเปลี่ยนไปแล้ว → 409 `INVALID_STATUS` · ทุก response คืนโปรไฟล์ล่าสุดของผู้ใช้คนนั้น

- **รายชื่อ**: `GET /admin/organizers?status=PENDING` (ค่าเริ่มต้น PENDING) → `{ items: [...] }` เรียงตาม `createdAt`
- **อนุมัติผู้จัดงาน**: ต้องเป็น ORGANIZER ที่ PENDING (ไม่ใช่ → 404 / 409) → `admin_add_user_to_group(GroupName="Organizer")` **ก่อน** (เรียกซ้ำได้ ถ้าขั้นต่อไปล้มก็กดอนุมัติซ้ำได้) แล้ว Users `PENDING → ACTIVE` แจ้งเตือนผู้ใช้
- **ปฏิเสธ**: body `{ reason }` (บังคับ) Users `PENDING → REJECTED` + `statusReason` แจ้งเตือน (บัญชียังล็อกอินได้แต่เข้าเมนูผู้จัดงานไม่ได้)
- **ระงับ**: body `{ reason }` ระงับ Admin ไม่ได้ (409) Users `→ SUSPENDED` **ก่อน** (ข้อ 5.2 กันทุก request ทันที) แล้วค่อย `admin_disable_user` + `admin_user_global_sign_out` ถ้า Cognito ล้มแค่ log ไว้
- **ยกเลิกการระงับ** (D5d): `POST /admin/users/{userId}/unsuspend` ต้อง SUSPENDED อยู่ (ไม่งั้น 409) → `admin_enable_user` + ใส่ group ตาม role **ก่อน** (เรียกซ้ำได้) แล้ว Users `SUSPENDED → ACTIVE` ล้าง `statusReason` แจ้งเตือน `account_unsuspended` · ผู้จัดงานที่ถูกระงับตอนยังรออนุมัติจะกลายเป็น ACTIVE (ถือว่าอนุมัติไปด้วย ตรงกับ frontend)
- **งานทั้งหมด**: `GET /admin/events` scan ตาราง Events (รวมฉบับร่าง) เรียงใหม่สุดก่อน ทุกงานเพิ่ม `status` (คำนวณเหมือน `/events`), `bookingCount` = จำนวน Booking ที่ยังถือล็อก (`PENDING_PAYMENT` ที่ยังไม่เลยเวลา, `PENDING_REVIEW`, `APPROVED`) และ `revenue` = ผลรวม `amount` ที่ `APPROVED` (เท่ากับ `/events/{id}/summary`) — scan ตาราง Bookings ครั้งเดียว (I5)
- **ผู้ใช้ทั้งหมด**: `GET /admin/users?role=SELLER|ORGANIZER|ADMIN` (ไม่ส่ง = ทุกบทบาท) → `{ items: [...] }` โปรไฟล์แบบเดียวกับ `/me` เรียงตาม `createdAt` · มี role → query GSI `byRoleStatus` ทีละสถานะ ไม่มี → scan · role ผิด → `400 INVALID_ROLE` (route ใหม่ I5)
- เรียก Cognito ด้วย `username` ที่เก็บใน Users (ไม่มีก็ใช้ `userId`) และ `USER_POOL_ID` จาก env (ข้อ 3.4)

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
| API จำลองในเครื่อง | pytest + `requests` (`tests/test_local_api.py`) | เปิด `scripts/local_api.py` เป็น process แยก (moto server mode) แล้วเรียกผ่าน HTTP: route สาธารณะ, 401/404/CORS แบบ API Gateway, `/_dev/*`, จอง + อัปโหลดสลิปตรงไป moto (INTEGRATION-PLAN หัวข้อ 4) |
| Cognito / Scheduler | pytest + moto (`cognito-idp`, `scheduler`) | โค้ดเรียก API ถูกตัว ถูกพารามิเตอร์ เช่น `admin_add_user_to_group`, `create_schedule` · ตรวจสิทธิ์ของ LabRole ไม่ได้ |

### 10.2 ช่วงที่ 2 — บน AWS (สัปดาห์ 11)
| เรื่อง | ทำไมต้องทดสอบบน AWS |
|---|---|
| Integration test ด้วย `requests` กับ resource ชุด `dev` | flow ครบผ่าน API Gateway + JWT จริง และตรวจว่าตั้งค่าใน Console ตรงกับโค้ด (ชื่อตาราง, env, route, authorizer) |
| `scripts/race_test.py` ยิง `POST /bookings` ล็อกเดียวกันพร้อมกัน **5 request** | ความพร้อมกันจริงของ DynamoDB ต้องได้ `201` × 1, `409` × 4 |
| Lambda เรียก `scheduler.create_schedule` ด้วย LabRole | ต้องใช้ `iam:PassRole` ยังไม่เคยทดสอบ (ข้อ 13) |
| หมดเวลาจริงด้วย `slipDeadlineMinutes` สั้น (เช่น 2 นาที) | Scheduler ยิงจริงแล้ว Booking เป็น EXPIRED |
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
| 3–4 | โค้ด | post_confirmation, `shared/auth.py`, `/me`, Admin API, `scripts/seed.py` (เขียนไว้ก่อน รันจริงสัปดาห์ 11) ✅ | กิตติพิชญ์, สรวิชญ์ |
| 5–6 | โค้ด | Events/Lots API, เก็บผังกริด + sync ล็อก, `GET /organizer/events`, summary, งานตัวอย่างใน seed ✅ | สรวิชญ์ |
| 7–8 | โค้ด | `POST /bookings` (transaction + quota), สลิป, `shared/scheduler.py` + expire_booking, fallback 7.6, ผู้ขายยกเลิก ✅ | ปณวัฒน์ |
| 9 | โค้ด | approve / move / reject / cancel, รายการการจองของงาน (summary ทำแล้วในสัปดาห์ 5–6) ✅ | ปณวัฒน์ |
| 10 | โค้ด | Notifications API และเติม notify ให้ครบทุกเหตุการณ์ · ฟีเจอร์ตามข้อ 14 (เช็กอิน, สถิติร้าน, ยกเลิกระงับ, ข้อมูลเสริม) ✅ | สรวิชญ์ |
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

## 14. จุดที่ spec กับ Frontend ปัจจุบันไม่ตรงกัน — ✅ ตัดสินครบแล้ว (2026-10-27)

Frontend ใน `Frontend/src/types.ts` มีความสามารถมากกว่า scope บางส่วน ทุกข้อด้านล่างตัดสินแล้ว (D5 แยกเป็น D5a–D5f)

| เรื่อง | Scope | Frontend ตอนนี้ | ข้อเสนอ |
|---|---|---|---|
| จองรายวัน | 1 การจอง = 1 ล็อกตลอดงาน | `days[]` + ค่าธรรมเนียมรายวัน, สถานะล็อกแยกต่อวัน | ✅ **ตัดสินแล้ว (2026-10-27): จองทั้งงานตาม scope** Lots SK เป็น `lotId` frontend ต้องซ่อนการเลือกวันและ surcharge และใช้ `lotState` ชุดเดียว |
| จองหลายล็อกพร้อมกัน | ไม่ระบุ | `BookingDraft.lots[]`, `groupId` | ✅ **ตัดสินแล้ว (2026-10-27): ได้ แบบ all-or-nothing** ดูข้อ 7.1 |
| ขั้นตอนสลิป | PENDING_PAYMENT → อัปโหลดภายใน 24 ชม. | แนบสลิปพร้อมส่งคำขอเลย | ✅ **ตัดสินแล้ว (2026-10-27): จองก่อน แนบสลิปทีหลังภายใน `slipDeadlineMinutes` ตาม scope และใช้สลิปเดียวต่อชุด** frontend ที่อยากแนบตอนส่งคำขอให้เรียก `slip-url` + `slip` ต่อทันทีหลังจอง (ข้อ 7.2) |
| ผังล็อก | ตาราง/รายการ + รูปภาพผัง | ตัววาดผังแบบกริด (`layout`, `cols`, `rows`) | ✅ **ตัดสินแล้ว (2026-10-27): ใช้ผังกริดตาม frontend** เก็บฟิลด์ผังใน Events และ sync ล็อกด้วย `PUT /events/{id}/lots` ไม่มีอัปโหลดรูปผัง (ข้อ 4.2, 4.3) |
| อนุมัติอัตโนมัติ (D5a) | ไม่มี | `autoApprove` ต่องาน | ✅ **ตัดสินแล้ว (2026-10-27): ไม่ทำ** ผู้จัดงานตรวจสลิปทุกครั้ง frontend ซ่อนสวิตช์ |
| เช็กอิน QR (D5b) | ไม่มี | QR ในตั๋ว, `checkedIn` | ✅ **ตัดสินแล้ว: ทำ** QR = `bookingId` ผู้จัดงานเรียก `POST /bookings/{id}/check-in` ได้เฉพาะการจอง APPROVED และเฉพาะวันงาน (`startDate`–`endDate` เวลาไทย) เรียกซ้ำได้ผลเดิม (ข้อ 7.7) |
| ข้อมูลร้านตอนจอง (D5c) | `shopName`, `productDescription` | `category`, `staff`, `power`, `note` | ✅ **ตัดสินแล้ว: เก็บเป็นฟิลด์เสริม** ใน Booking (ไม่บังคับ) |
| ยกเลิกการระงับ (D5d) | ไม่มี | ปุ่มยกเลิกระงับใน Admin | ✅ **ตัดสินแล้ว: ทำ** `POST /admin/users/{userId}/unsuspend` → ACTIVE (ข้อ 9) |
| สถิติร้านของผู้จัดงาน (D5e) | ไม่มี | `VendorsPage`: approved, total, showRate, flagged | ✅ **ตัดสินแล้ว: ทำ** `GET /organizer/vendors` คำนวณจากงานทั้งหมดของผู้จัดคนนั้น (ข้อ 7.8) |
| โปรไฟล์ร้าน (D5f) | ชื่อร้าน, ประเภท, เบอร์ | `line`, `bio`, `power` | ✅ **ตัดสินแล้ว: เก็บใน Users** ผู้ขายแก้ได้ผ่าน `PUT /me` |
| ชื่อสถานะ | `PENDING_PAYMENT`, `PENDING_REVIEW`, ... | `pending`, `approved`, ... | ✅ **ตัดสินแล้ว: ใช้ชื่อตาม scope ตัวพิมพ์ใหญ่** frontend map เอง (F4) |
| ชื่อฟิลด์ | — | camelCase | ✅ backend ส่ง JSON เป็น **camelCase** ให้ตรง frontend (ภายใน Python ใช้ snake_case ได้ ใช้ `alias_generator=to_camel` ของ pydantic) |

---

## 15. งานที่ฝั่ง Frontend ต้องแก้

รายการนี้รวมทุกอย่างที่ frontend (`Frontend/src`) ต้องเปลี่ยนเพื่อใช้กับ backend จริง ทุกครั้งที่ backend เพิ่มหรือเปลี่ยน API ให้เพิ่มแถวที่นี่ด้วย (สถานะติดตามใน PROGRESS.md หัวข้อ "งานฝั่ง Frontend")

> ลำดับการทำ (เฟส 0–9), โครงไฟล์ใหม่ (`src/api`, `src/auth`, `src/queries`) และ API จำลองในเครื่อง อยู่ใน [INTEGRATION-PLAN.md](../INTEGRATION-PLAN.md)

### 15.1 ทั่วไป
| # | เรื่อง | ต้องแก้อะไร | อ้างอิง |
|---|---|---|---|
| F1 | เชื่อม Cognito แทนบัญชีจำลอง | ใช้ `aws-amplify/auth` (`signUp`, `confirmSignUp`, `signIn`, `signOut`, `fetchAuthSession`) แทนการเก็บ `passwordHash` ใน `AppProvider` อ่านค่า `VITE_API_URL`, `VITE_USER_POOL_ID`, `VITE_USER_POOL_CLIENT_ID`, `VITE_REGION` | 3.7, 5.1 |
| F2 | แนบ token | ทุก route ที่ไม่ใช่สาธารณะส่ง header `Authorization: Bearer <accessToken>` (จาก `fetchAuthSession().tokens.accessToken`) | 5.2 |
| F3 | รูปแบบ error | ทุก error เป็น `{ error: { code, message, details? } }` แสดง `message` ให้ผู้ใช้ได้เลย · `401` → พาไปหน้าเข้าสู่ระบบ · `403 ACCOUNT_SUSPENDED` → แจ้งว่าบัญชีถูกระงับ · `400 VALIDATION_ERROR` มี `details: [{field, message}]` | 6 |
| F4 | ค่าสถานะเป็นตัวพิมพ์ใหญ่ | map เป็นค่าของ frontend เอง: role `SELLER/ORGANIZER/ADMIN` · บัญชี `ACTIVE/PENDING/REJECTED/SUSPENDED` · งาน `publishStatus` `DRAFT/OPEN/CLOSED` และ `status` `DRAFT/SCHEDULED/OPEN/CLOSED/ENDED` · ล็อก `AVAILABLE→free`, `HELD→pending`, `BOOKED→booked`, `DISABLED→disabled` | 4, 14 |
| F5 | id ของผู้ใช้ | ใช้ `userId` (= Cognito `sub`) แทน `accountId` / `shopId` / `organizerId` แยกกัน | 4.1 |

### 15.2 สมัครสมาชิกและบัญชี
| # | เรื่อง | ต้องแก้อะไร | อ้างอิง |
|---|---|---|---|
| F6 | สมัคร | `signUp` ส่ง `custom:role` = `seller`/`organizer` · `confirmSignUp` ส่งโปรไฟล์ใน `options.clientMetadata: { name, phone, orgName, category }` (string ทั้งหมด) · เก็บค่าฟอร์มใน `sessionStorage` ระหว่างรอ OTP | 5.1 |
| F7 | หลังผู้จัดงานได้รับอนุมัติ | เรียก `fetchAuthSession({ forceRefresh: true })` (หรือให้ล็อกอินใหม่) ถึงจะได้ group `Organizer` ใน token | 5.3 |
| F8 | หน้าโปรไฟล์ | `GET /me` · `PUT /me` แก้ได้เฉพาะฟิลด์ของ role ตัวเอง (ผู้ขาย `displayName, phone, shopName, category, line, bio, power` · ผู้จัดงาน `displayName, phone, orgName, payment`) ผู้จัดงานที่ PENDING/REJECTED เรียกได้ ใช้แสดงสถานะรออนุมัติ | 4.1 |
| F9 | หน้า Admin | `GET /admin/organizers?status=PENDING` · `POST /admin/organizers/{userId}/approve` · `POST .../reject` `{reason}` · `POST /admin/users/{userId}/suspend` `{reason}` · `POST /admin/users/{userId}/unsuspend` (ปุ่มยกเลิกระงับใช้ route นี้) · `GET /admin/events` · `GET /admin/users?role=` (F33) | 9 |

### 15.3 งานและล็อก
| # | เรื่อง | ต้องแก้อะไร | อ้างอิง |
|---|---|---|---|
| F10 | ฟอร์มงาน | ส่งไป `POST /events` / `PUT /events/{id}` เปลี่ยนชื่อฟิลด์: `bookingOpens→bookingOpensAt`, `bookingCloses→bookingClosesAt` (ISO ที่มี timezone เช่น `2026-11-01T09:00:00+07:00`) · `status→publishStatus` · ใช้ `startDate`/`endDate` แทน `days` · เพิ่ม `slipDeadlineMinutes` · `maxLotsPerSeller: null` = ไม่จำกัด · ส่ง `cols, rows, layout, disabledCells, lotSizes` ไปด้วย | 4.2 |
| F11 | ตัดการจองรายวัน | เอาตัวเลือกวัน, `days`, ค่าธรรมเนียมรายวัน (`surcharge`) และ `lotState` แยกรายวันออก ราคาล็อก = ราคาโซน | D1 |
| F12 | บันทึกล็อก | หลังบันทึกผัง เรียก `PUT /events/{id}/lots` ด้วย `{ lots: [{ lotId, zoneId, size?, disabled }] }` สร้างจาก `lotsOf(layout)` + `lotSizes` (ขนาดเฉพาะล็อก) + `disabledCells` · รับมือ `409 LOT_IN_USE` (ล็อกที่มีคนจองแก้/ลบไม่ได้) และ `400 UNKNOWN_ZONE` | 4.3 |
| F13 | เผยแพร่ / ปิดงาน | เผยแพร่ = `PUT /events/{id}` `{ publishStatus: "OPEN" }` (ต้อง sync ล็อกก่อน ไม่งั้น `409 NO_LOTS`) · ปิดรับจอง = `POST /events/{id}/close` | 6 |
| F14 | หน้ารายการงาน | สาธารณะ `GET /events` (ไม่มี `payment` และผังกริด) → หน้ารายละเอียด `GET /events/{id}` + `GET /events/{id}/lots` · ผู้จัดงาน `GET /organizer/events` (มีงานฉบับร่างและผังกริดครบ) | 6 |
| F15 | สรุปงาน | `GET /events/{id}/summary` → `{ lots: {total, AVAILABLE, HELD, BOOKED, DISABLED}, bookings: {สถานะ: จำนวน}, revenue }` | 6 |
| F16 | อนุมัติอัตโนมัติ | ไม่ทำ (D5a) ซ่อนสวิตช์ `autoApprove` และไม่ต้องส่ง | D5a |

### 15.4 การจองและแจ้งเตือน (เติมเมื่อทำ backend สัปดาห์ 7–10)
| # | เรื่อง | ต้องแก้อะไร | อ้างอิง |
|---|---|---|---|
| F17 | จองหลายล็อก | `POST /bookings` `{ eventId, lotIds: [...] (≤ 20), shopName, productDescription? }` ได้ทั้งชุดหรือ `409` ทั้งชุด → `201 { groupId, bookings }` · error ที่ต้องรับมือ: `LOT_NOT_AVAILABLE` (`details.lotIds` = ล็อกที่ถูกจองไป ให้เลือกใหม่), `QUOTA_EXCEEDED`, `BOOKING_CLOSED`, `UNKNOWN_LOT` · ส่งข้อมูลจาก `BookingDraft.shop` ไปด้วยได้: `category`, `staff` (ข้อความ), `power` (bool), `note` (D5c) | 7.1, D2, D5c |
| F19 | แนบสลิปทีหลัง (D3) | หลังจองได้ `PENDING_PAYMENT` แสดงเวลาที่เหลือจาก `expiresAt` · ขั้นแนบสลิป: `POST /bookings/{id}/slip-url {contentType}` → สร้าง `FormData` ใส่ทุกค่าใน `fields` แล้ว `file` เป็นช่องสุดท้าย → `POST` ไปที่ `url` → `POST /bookings/{id}/slip {key}` · **สลิปเดียวต่อชุด** แนบครั้งเดียวทุกล็อกในชุดเป็น `PENDING_REVIEW` · ถ้าอยากแนบพร้อมส่งคำขอเหมือนเดิม ให้เรียก 3 ขั้นนี้ต่อทันทีหลัง `POST /bookings` · รับ jpg/png/pdf ไม่เกิน 5 MB · `409 BOOKING_EXPIRED` = หมดเวลา ต้องจองใหม่ · เอา `slipAmount`, `slipName` ออก | 7.2, D3 |
| F20 | ดูสลิป | `GET /bookings/{id}/slip` → `{ url }` อายุ 5 นาที (ผู้ขายเจ้าของ / ผู้จัดงาน) ขอใหม่ทุกครั้งที่เปิดดู | 7.2 |
| F21 | การจองของฉัน | `GET /bookings/me` (ใหม่สุดก่อน) · สถานะ `PENDING_PAYMENT` (รอแนบสลิป), `PENDING_REVIEW` (รอตรวจ), `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED` — frontend มีแค่ `pending/approved/rejected/cancelled` ต้องเพิ่ม 2 สถานะ (รอสลิป, หมดเวลา) · จัดกลุ่มตาม `groupId` ได้ · ใช้ `lotId` แทน `lot` และ `createdAt` แทน `submittedAt` | 4.4, 7 |
| F22 | ผู้ขายยกเลิก | `POST /bookings/{id}/cancel` ได้เฉพาะ `PENDING_PAYMENT` / `PENDING_REVIEW` ยกเลิกทั้งชุด (D7, F35) | 7.4 |
| F24 | หน้าตรวจการจองของผู้จัดงาน | `GET /events/{id}/bookings?status=PENDING_REVIEW` (กรองตามสถานะได้) แทนการอ่าน bookings ทั้งหมดใน store · ปุ่มดูสลิปใช้ F20 | 7.3.1 |
| F25 | อนุมัติ / ย้ายล็อก | `POST /bookings/{id}/approve` `{}` หรือ `{ moves: {ล็อกเดิม: ล็อกใหม่} }` อนุมัติทั้งชุด (D7, F35) · อนุมัติได้เฉพาะ `PENDING_REVIEW` · ย้ายล็อกไม่คิดส่วนต่างราคา (`amount` คงเดิม) · `409 LOT_NOT_AVAILABLE` = ล็อกปลายทางไม่ว่าง · `moves[]` มี `by` เพิ่ม | 7.3 |
| F26 | ปฏิเสธ / ยกเลิกหลังอนุมัติ | `POST /bookings/{id}/reject {reason}` · `POST /bookings/{id}/cancel {reason}` (ผู้จัดงาน, เฉพาะ APPROVED) · ต้องกรอกเหตุผลทั้งสองแบบ | 7.4 |
| F27 | เช็กอิน QR | ตั๋วของผู้ขายสร้าง QR จาก `bookingId` (เฉพาะ APPROVED) · ผู้จัดงานสแกนแล้วเรียก `POST /bookings/{id}/check-in` ได้เฉพาะวันงาน (`409 NOT_EVENT_DAY`) เรียกซ้ำได้ · ใช้ `checkedIn` / `checkedInAt` จาก Booking · ข้อความ `booking_approved` จาก backend ไม่มีคำว่า QR แล้ว ถ้าอยากบอกให้แสดงในหน้าตั๋วเอง | 7.7, D5b |
| F28 | หน้ารายชื่อร้าน (VendorsPage) | `GET /organizer/vendors` แทน `vendorStats()` ในเครื่อง ได้ `shop` (โปรไฟล์ผู้ขาย ใช้ `userId`, `shopName`, `displayName` แทน `Shop.id/name/owner`), `approved`, `total`, `pastCount`, `showRate`, `flagged` | 7.8, D5e |
| F29 | โปรไฟล์ร้าน | `PUT /me` ผู้ขายแก้ `line`, `bio`, `power` (ข้อความ) ได้ · หน้า ShopProfilePage อ่านจาก `GET /me` แทน `Shop` | 4.1, D5f |
| F30 | แจ้งเตือนยกเลิกระงับ | เพิ่ม type `account_unsuspended` | 8 |
| F31 | ยอดเงิน = ราคาโซนอย่างเดียว | ตัดค่าไฟ (`FEES.power` 50 บาท/วัน) และค่าธรรมเนียมระบบ (`FEES.service` 20 บาท) ออกจาก `utils/pricing.ts`, `BookingSummary` · ใช้ `amount` จาก backend · `power` ยังส่งเป็นข้อมูล (I2) | INTEGRATION-PLAN I2 |
| F32 | บัญชีรับเงินตั้งต้นของผู้จัดงาน | `OrganizerProfilePage` แก้ `payment {bank, accountName, accountNo}` ผ่าน `PUT /me` (ส่งครบ 3 ฟิลด์ ขาดตัวไหน → `400 VALIDATION_ERROR` · ผู้ขายส่งมา → `400 FIELD_NOT_ALLOWED`) · `GET /me` ของผู้จัดงานมี `payment` เมื่อเคยบันทึก · ฟอร์มงานใหม่เติมค่าจาก `me.payment` (backend พร้อมแล้ว B2) | INTEGRATION-PLAN I3 |
| F33 | หน้า Admin ผู้ใช้/สรุป | `UserPage` → `GET /admin/users?role=SELLER\|ORGANIZER\|ADMIN` (ไม่ส่ง role = ทุกคน) ได้ `{ items }` โปรไฟล์แบบ `/me` · ตัวเลขใน `OrganizerApprovalsPage` และรายได้ใน `AllEventsPage` จาก `GET /admin/events` ที่ทุกงานมี `status`, `bookingCount` (การจองที่ยังถือล็อก) และ `revenue` (ยอดที่อนุมัติแล้ว) — รวมงานฉบับร่างด้วย (backend พร้อมแล้ว B3) | INTEGRATION-PLAN I5 |
| F23 | ประเภทแจ้งเตือนใหม่ | เพิ่ม `booking_slip_uploaded` และ `booking_expired` ใน `NotificationType` + ไอคอนใน `data/options.ts` · ข้อความมาจาก backend แล้ว ไม่ต้องสร้างเองใน `data/notifications.ts` | 8 |
| F35 | 1 การจอง = 1 ชุด (D7) | รวมการจองตาม `groupId` เป็นการ์ด/แถวเดียว (`services/bookings.groupBookings`, type `BookingGroup`) · approve ส่ง `{moves}` แทน `{newLotId}` · approve/reject/cancel/check-in ตอบ `{groupId, bookings}` และทำทั้งชุด · ผู้ขายยกเลิกทั้งชุด · QR = `bookingId` ของล็อกแรก · สถิติร้านนับตามชุด | 7.1, 7.3, 7.4, 7.7, 7.8 |
| F36 | ไอคอนแจ้งเตือน | เปลี่ยนอิโมจิใน `NOTIFICATION_ICON` (`data/options.ts`) เป็นไอคอน SVG ของ `lucide-react` พร้อมโทนสีต่อประเภท | 8 |
| F34 | กระดิ่งแจ้งเตือนของผู้ขาย | `UserLayout` ยังไม่มี `NotificationBell` (มีแค่ `DashboardLayout`) ผู้ขายจึงมองไม่เห็น `booking_approved/moved/rejected/cancelled/expired`, `account_*` ที่ backend สร้างให้ · เพิ่มกระดิ่งใน header ฝั่งผู้ขาย (พบตอนทดสอบ 2026-10-28) | 8 |
| F18 | แจ้งเตือน | poll `GET /notifications` ทุก 30–60 วินาที → `{ items, unreadCount }` (ใช้ `id` ของ item แทน `AppNotification.id`, ไม่มี `accountId`) · อ่านแล้ว `POST /notifications/read` `{ ids }` หรือ `{ all: true }` · ไม่ต้องสร้างแจ้งเตือนเองใน `AppProvider` อีก backend สร้างให้หมด | 8 |
