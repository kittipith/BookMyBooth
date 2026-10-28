# BookMyBooth — คู่มือสร้าง AWS ทีละขั้น และจุดที่เชื่อมกับโค้ด Backend

> ใช้ตอนสัปดาห์ 11–12 (ขึ้น AWS) · สร้างทุกอย่างเองผ่าน **AWS Console** ใน AWS Academy Learner Lab ไม่ใช้ SAM / CloudFormation
> แผนละเอียดอยู่ที่ [Backend/PLAN.md](Backend/PLAN.md) หัวข้อ 3 · จดชื่อ/ID ที่สร้างจริงไว้ใน [Backend/PROGRESS.md](Backend/PROGRESS.md) ตาราง "Resource ที่สร้างจริง"
> ⚠️ ทีมตกลงกันว่า **ถ้ามีอะไรต้องสร้างเพิ่มนอกเหนือจากเอกสารนี้ ให้ถามก่อน**
> ก่อนขึ้น AWS ใช้ API จำลองในเครื่อง ([INTEGRATION-PLAN.md](INTEGRATION-PLAN.md)) — ตอนสลับมา AWS ดูหัวข้อ 14
> ชื่อเมนูใน Console อาจต่างจากในเอกสารเล็กน้อยเมื่อ AWS ปรับหน้าตา ให้ดูจากชื่อช่อง/ค่าที่ต้องกรอกเป็นหลัก

---

## 0. ก่อนเริ่ม

### 0.1 ภาพรวมระบบ

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

**ลำดับการสร้าง** (ขั้นหลังต้องใช้ค่าจากขั้นก่อน ทำตามลำดับนี้เท่านั้น):

| # | สร้าง | ใช้เวลาโดยประมาณ | ได้ค่าอะไรไปใช้ต่อ |
|---|---|---|---|
| 1 | DynamoDB 5 ตาราง (ข้อ 2) | 15 นาที | ชื่อตาราง → env ของ Lambda |
| 2 | S3 bucket (ข้อ 3) | 5 นาที | ชื่อ bucket → env `FILES_BUCKET` |
| 3 | Cognito User Pool + App client + Groups (ข้อ 4) | 15 นาที | User Pool ID, Client ID → env `USER_POOL_ID`, authorizer, frontend |
| 4 | build zip + Lambda 6 ตัว (ข้อ 5) | 30 นาที | ARN ของ expire-booking → env `EXPIRE_FUNCTION_ARN` |
| 5 | PostConfirmation trigger (ข้อ 4 ขั้น 9) | 2 นาที | — |
| 6 | API Gateway HTTP API (ข้อ 6) | 40 นาที | Invoke URL → frontend |
| 7 | seed ข้อมูลเดโม (ข้อ 9) | 5 นาที | บัญชีเดโม |
| 8 | Frontend บน Amplify Hosting (ข้อ 8) | 20 นาที | โดเมน Amplify → กลับไปเพิ่มใน CORS ข้อ 3 และ 6 |
| 9 | smoke test (ข้อ 11) | 20 นาที | — |

ทุกอย่างอยู่ region **us-east-1 (N. Virginia)** — ดูมุมขวาบนของ Console ทุกครั้งก่อนสร้าง ถ้าเป็น region อื่นจะหา resource ไม่เจอ
ตั้งชื่อเป็น `bookmybooth-<stage>-<ชื่อ>` (`<stage>` = `dev` หรือ `prod`) ตัวอย่างในเอกสารใช้ `dev`

### 0.2 ไม่ต้องตั้ง VPN / VPC / network ใด ๆ
ทุกบริการในระบบนี้ (DynamoDB, S3, Cognito, API Gateway, Lambda, EventBridge Scheduler, Amplify) เป็นบริการ managed ที่เรียกผ่าน endpoint สาธารณะของ AWS และตรวจสิทธิ์ด้วย IAM (`LabRole`) กับ JWT ของ Cognito
- **ไม่ต้อง** สร้าง VPC, subnet, Security Group, NAT Gateway, VPN หรือตั้ง IP whitelist
- ⚠️ **ตอนสร้าง Lambda ห้ามเปิด VPC** (ส่วน *Advanced settings → Enable VPC* ปล่อยไม่ติ๊ก) ถ้าผูก VPC แล้ว Lambda จะเรียก DynamoDB / S3 / Cognito ไม่ได้ (timeout) เพราะต้องมี NAT Gateway หรือ VPC endpoint ซึ่งเสียเงินและอยู่นอกแผน
- เข้า Console จากเครื่องไหน เน็ตไหนก็ได้ ขอแค่เปิด Learner Lab ไว้

### 0.3 สิ่งที่ต้องมีในเครื่อง

| เครื่องมือ | ใช้ทำอะไร | ตรวจ |
|---|---|---|
| Python **3.13** + venv ของ Backend | build zip, seed, race test | `py -V:3.13 --version` |
| Node.js **22** ขึ้นไป | build frontend (Vite 8 ต้องใช้ Node ≥ 20.19) | `node -v` |
| Git + โค้ดล่าสุดของ repo | — | `git pull` |
| เบราว์เซอร์ | Console + ทดสอบหน้าเว็บ | — |

เตรียม venv ครั้งแรก (PowerShell):
```powershell
cd Backend
py -V:3.13 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
```
Git Bash: ใช้ `source .venv/Scripts/activate` แทนบรรทัด Activate · ทุกคำสั่ง Python ในเอกสารนี้รันใน venv นี้

### 0.4 เปิด Learner Lab
1. เข้า AWS Academy → คอร์ส → **Learner Lab** → กด **Start Lab** รอจนจุดหน้า "AWS" เป็นสีเขียว
2. กด **AWS** (จุดเขียว) เพื่อเปิด Console ในแท็บใหม่
3. จด **Account ID** (12 หลัก) จากเมนูชื่อบัญชีมุมขวาบน — ใช้ในชื่อ bucket และ ARN ของ LabRole
4. session มีอายุประมาณ 4 ชั่วโมง หมดแล้วกด Start Lab ใหม่ได้ **resource ที่สร้างไว้ยังอยู่** แต่ credentials สำหรับรันสคริปต์ในเครื่อง (ข้อ 9.1) เปลี่ยนทุก session

### 0.5 ใบจดค่า (กรอกระหว่างทำ แล้วคัดลอกไป PROGRESS.md)

| ค่า | ได้จากข้อ | ค่าที่ได้ |
|---|---|---|
| Account ID | 0.4 | |
| ARN ของ LabRole `arn:aws:iam::<Account ID>:role/LabRole` | 0.4 | |
| ชื่อ bucket | 3 | |
| User Pool ID (`us-east-1_xxxxxxxxx`) | 4 | |
| App client ID | 4 | |
| ARN ของ `bookmybooth-dev-expire-booking` | 5 | |
| Invoke URL ของ API | 6 | |
| โดเมน Amplify (`https://main.xxxx.amplifyapp.com`) | 8 | |

---

## 1. Role และสิทธิ์

### 1.1 IAM Role — ใช้ `LabRole` อย่างเดียว
Learner Lab **ห้ามสร้าง IAM role/policy เอง** ทุกจุดที่ AWS ถาม role ให้เลือก `LabRole` ที่มีอยู่แล้ว

| ที่ไหน | ตั้งค่า | หมายเหตุ |
|---|---|---|
| Lambda ทั้ง 6 ตัว → Execution role | *Use an existing role* → `LabRole` | **ห้ามเลือก Create a new role** (สร้างไม่ได้ / error) |
| EventBridge Scheduler → Target role | โค้ดส่ง `SCHEDULER_ROLE_ARN` = ARN ของ LabRole ให้เอง | LabRole มี `scheduler.amazonaws.com` ใน trust policy แล้ว (spike ผ่าน) |
| Cognito → Lambda trigger | ไม่ต้องตั้ง role | Console เพิ่ม resource policy ให้ Cognito เรียก Lambda เอง |
| API Gateway → Lambda integration | ไม่ต้องตั้ง role | Console เพิ่ม resource policy ให้ API Gateway เรียก Lambda เอง |
| Amplify Hosting | ไม่ต้องใช้ service role (หน้าเว็บเป็น static SPA) | ถ้า Console บังคับให้สร้าง role ให้ใช้วิธี deploy แบบไม่เชื่อม Git (ข้อ 8.2 ทาง B) |

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

ค้นหา **DynamoDB** ในช่องค้นหาด้านบนของ Console → เมนูซ้าย **Tables** → **Create table**

### 2.0 ขั้นตอนที่ใช้กับทุกตาราง
1. **Table name**: ตามหัวข้อย่อยด้านล่าง
2. **Partition key**: ชื่อ attribute ตามตาราง ชนิด **String**
3. **Sort key**: ใส่เฉพาะตารางที่มี (lots, notifications) ชนิด **String**
4. **Table settings** → เลือก **Customize settings**
5. **Table class** = DynamoDB Standard · **Read/write capacity settings** → **On-demand**
6. **Secondary indexes** → **Create global index** (ทำซ้ำตามจำนวน GSI ของตารางนั้น):
   - Partition key / Sort key ตามตาราง ชนิด String
   - **Index name** ตามตาราง (ตัวพิมพ์ต้องตรง)
   - **Attribute projections** = **All**
7. ส่วนอื่นปล่อยค่าเริ่มต้น (Encryption = Owned by Amazon DynamoDB) → **Create table**
8. รอสถานะเป็น **Active** (ประมาณ 10–30 วินาที) ก่อนสร้างตารางถัดไปก็ได้ หรือสร้างต่อเลยก็ได้

### 2.1 `bookmybooth-dev-users`
| | ชื่อ attribute | ชนิด |
|---|---|---|
| Partition key | `userId` | String (= Cognito `sub`) |
| GSI `byRoleStatus` | PK `roleStatus` · SK `createdAt` | String · String |

ตัวอย่างค่า `roleStatus`: `ORGANIZER#PENDING`, `ADMIN#ACTIVE` (ใช้หาผู้สมัครที่รออนุมัติ และหา Admin เพื่อแจ้งเตือน)

### 2.2 `bookmybooth-dev-events`
| | ชื่อ attribute | ชนิด |
|---|---|---|
| Partition key | `eventId` | String |
| GSI `byOrganizer` | PK `organizerId` · SK `createdAt` | String · String |
| GSI `byPublishStatus` | PK `publishStatus` · SK `startDate` | String · String |

### 2.3 `bookmybooth-dev-lots`
| | ชื่อ attribute | ชนิด |
|---|---|---|
| Partition key | `eventId` | String |
| Sort key | `lotId` | String |

ไม่มี GSI · ตารางนี้มี item 2 แบบ: ล็อก (`lotId` = `A01`) และโควตาต่อผู้ขาย (`lotId` = `QUOTA#<sellerId>`)

### 2.4 `bookmybooth-dev-bookings`
| | ชื่อ attribute | ชนิด |
|---|---|---|
| Partition key | `bookingId` | String |
| GSI `bySeller` | PK `sellerId` · SK `createdAt` | String · String |
| GSI `byEventStatus` | PK `eventId` · SK `statusCreatedAt` | String · String |

ตัวอย่าง `statusCreatedAt`: `PENDING_REVIEW#2026-11-01T03:00:00.000Z` · GSI `bySeller` ใช้หาล็อกทั้งหมดในชุดการจองด้วย (D7)

### 2.5 `bookmybooth-dev-notifications`
| | ชื่อ attribute | ชนิด |
|---|---|---|
| Partition key | `userId` | String |
| Sort key | `sk` | String (= `createdAt#notificationId`) |

**หลังสร้างเสร็จ เปิด TTL:** คลิกชื่อตาราง → แท็บ **Additional settings** → ส่วน **Time to Live (TTL)** → **Turn on** → TTL attribute name = **`ttl`** → **Turn on TTL** (ลบแจ้งเตือนเก่าอัตโนมัติหลัง 90 วัน)

### 2.6 ตรวจหลังสร้าง
- หน้า **Tables** ต้องมี 5 ตาราง สถานะ Active ทุกตาราง
- คลิกแต่ละตาราง → แท็บ **Indexes** ชื่อ index ต้องตรงตัวพิมพ์: `byRoleStatus`, `byOrganizer`, `byPublishStatus`, `bySeller`, `byEventStatus` และสถานะ Active
- ชื่อ key ต้องตรงตัวพิมพ์ (camelCase) ถ้าพิมพ์ผิด เช่น `userID` โค้ดจะ error ทันที — **แก้ key ทีหลังไม่ได้ ต้องลบตารางแล้วสร้างใหม่**
- ต้นฉบับโครงสร้างในโค้ด: [Backend/tests/tables.py](Backend/tests/tables.py) (ใช้สร้างตารางใน moto ตอนเทสต์ ถ้า Console ไม่ตรงไฟล์นี้ แปลว่าสร้างผิด)

---

## 3. S3 — bucket เก็บสลิป

ค้นหา **S3** → **Create bucket**

1. **Bucket type** = General purpose
2. **Bucket name** = `bookmybooth-dev-files-<Account ID>` เช่น `bookmybooth-dev-files-123456789012` (ชื่อ bucket ต้องไม่ซ้ำทั้งโลก ตัวเล็กทั้งหมด)
3. **Object Ownership** = **ACLs disabled (recommended)**
4. **Block Public Access settings** = ติ๊ก **Block all public access** (ค่าเริ่มต้น) — สลิปเป็นข้อมูลส่วนตัว เปิดดูผ่านลิงก์ชั่วคราว 5 นาทีเท่านั้น
5. **Bucket Versioning** = Disable · **Default encryption** = **SSE-S3** (ค่าเริ่มต้น)
6. **Create bucket** → จดชื่อ bucket ลงใบจดค่า
7. ตั้ง CORS: คลิกชื่อ bucket → แท็บ **Permissions** → เลื่อนลงไป **Cross-origin resource sharing (CORS)** → **Edit** → วาง JSON นี้ → **Save changes**
   ```json
   [
     {
       "AllowedMethods": ["GET", "POST"],
       "AllowedOrigins": ["http://localhost:5173"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
   - ตอนนี้ยังไม่มีโดเมน Amplify ใส่แค่ `localhost` ก่อน **หลังทำข้อ 8 เสร็จต้องกลับมาเพิ่ม** `"https://main.xxxx.amplifyapp.com"` ใน `AllowedOrigins` (ไม่มี `/` ท้าย)
   - ถ้าไม่ตั้ง CORS หน้าเว็บจะอัปโหลดสลิปไม่ได้ (error CORS ใน console ของเบราว์เซอร์)

ไฟล์ที่เก็บ: `slips/<eventId>/<groupId>/<ulid>.<jpg|png|pdf>` ไม่เกิน 5 MB (โค้ดกำหนดใน presigned POST) · ไม่ต้องสร้างโฟลเดอร์เอง

---

## 4. Cognito — User Pool

ค้นหา **Cognito** → **User pools** → **Create user pool**

1. **Define your application**
   - Application type = **Single-page application (SPA)**
   - Name your application = `bookmybooth-dev-web` (ชื่อ App client)
2. **Configure options**
   - Options for sign-in identifiers = ติ๊ก **Email** อย่างเดียว
   - Self-registration = **Enable self-registration**
   - Required attributes for sign-up = **email** (ค่าเริ่มต้น ไม่ต้องเพิ่ม)
   - Return URL = เว้นว่าง (ไม่ใช้ Hosted UI)
3. **Create user directory** → ได้ user pool ชื่ออัตโนมัติ ให้เปลี่ยนชื่อเป็น `bookmybooth-dev` ภายหลังได้ที่ **Overview → Rename** (ไม่บังคับ)
4. **Password policy**: เมนูซ้าย **Authentication → Authentication methods** → **Password policy → Edit** → Custom
   - Minimum length = **8** · ติ๊ก **Contains at least 1 lowercase letter** และ **Contains at least 1 number** · ไม่ติ๊กตัวใหญ่/สัญลักษณ์
   - ต้องตรงกับกฎในหน้าเว็บ ถ้าเข้มกว่านี้ผู้ใช้จะสมัครไม่ได้โดยไม่รู้สาเหตุ
5. **Email**: เมนู **Authentication → Email** ต้องเป็น **Send email with Cognito** (ค่าเริ่มต้น ฟรีวันละ 50 ฉบับ พอสำหรับเดโม)
6. **Custom attribute**: เมนู **Authentication → Sign-up** → ส่วน **Custom attributes** → **Add custom attributes**
   - Name = `role` · Type = String · Min = 1 · Max = 20 · ติ๊ก **Mutable** → Save
   - หน้าเว็บส่งเป็น `custom:role` = `seller` หรือ `organizer`
   - ⚠️ custom attribute **เพิ่มทีหลังได้ แต่ลบ/แก้ไม่ได้** ตั้งให้ถูกตั้งแต่แรก
   - โปรไฟล์อื่น (ชื่อ เบอร์ ชื่อร้าน ประเภท) **ไม่เก็บใน Cognito** ส่งผ่าน `clientMetadata` ไปเก็บใน DynamoDB
7. **App client**: เมนู **Applications → App clients** → คลิก `bookmybooth-dev-web` → **Edit**
   - Client secret = **ไม่มี** (SPA สร้างแบบไม่มี secret อยู่แล้ว ถ้าเห็นว่ามี secret ให้สร้าง app client ใหม่แบบ Public/SPA)
   - Authentication flows = ติ๊ก **ALLOW_USER_SRP_AUTH** และ **ALLOW_REFRESH_TOKEN_AUTH** (อันอื่นไม่ติ๊กก็ได้)
   - Access token / ID token expiration = **1 hour** · Refresh token = **30 days**
   - **Prevent user existence errors** = Enabled → Save changes
   - แท็บ **Attribute permissions** (ถ้ามี): ตรวจว่า `custom:role` อยู่ใน Write ไม่งั้นหน้าเว็บส่งค่าตอนสมัครไม่ได้
8. **Groups**: เมนู **User management → Groups** → **Create group** สร้าง 3 กลุ่ม (ไม่ต้องเลือก IAM role):
   | Group name | Precedence |
   |---|---|
   | `Seller` | 30 |
   | `Organizer` | 20 |
   | `Admin` | 10 |
9. จดค่าลงใบจดค่า: **User pool ID** (หน้า Overview รูปแบบ `us-east-1_xxxxxxxxx`) และ **Client ID** (หน้า App clients)
10. **PostConfirmation trigger** — ⏸ **ข้ามไปก่อน ทำหลังสร้าง Lambda ในข้อ 5 แล้ว**: เมนู **Authentication → Extensions** → **Add Lambda trigger** → Trigger type **Sign-up** → **Post confirmation trigger** → Lambda function = `bookmybooth-dev-post-confirmation` → **Add Lambda trigger**

---

## 5. Lambda — 6 function

### 5.1 เตรียม zip (ในเครื่อง)
PowerShell ใน venv (ข้อ 0.3):
```powershell
cd Backend
pytest                          # ต้องผ่านทุกข้อก่อนเสมอ
ruff check .
python scripts/build_zip.py     # ได้ Backend\build\lambda.zip
```
zip นี้ใช้ **ไฟล์เดียวกันทุก function** (ข้างในมี `functions/`, `shared/`, `domain/`, `ulid/`) ต่างกันแค่ Handler · ขนาดเล็กกว่า 10 MB จึงอัปโหลดผ่าน Console ได้ตรง ๆ ไม่ต้องผ่าน S3

### 5.2 สร้างทีละตัว (ทำซ้ำ 6 ครั้ง)
ค้นหา **Lambda** → **Create function** → **Author from scratch**

| ตั้งค่า | ค่า |
|---|---|
| Function name | ตามตารางด้านล่าง |
| Runtime | **Python 3.13** |
| Architecture | **x86_64** |
| Permissions → *Change default execution role* | **Use an existing role** → **LabRole** |
| Advanced settings | **ไม่ติ๊กอะไรเลย** โดยเฉพาะ **Enable VPC** (ข้อ 0.2) |

กด **Create function** แล้วในหน้า function ทำต่อ:
1. แท็บ **Code** → **Upload from** → **.zip file** → เลือก `Backend/build/lambda.zip` → **Save** (โค้ดตัวอย่าง `lambda_function.py` จะหายไป เป็นเรื่องปกติ)
2. แท็บ **Code** เลื่อนลงไป **Runtime settings** → **Edit** → **Handler** ตามตารางข้างล่าง → Save
3. แท็บ **Code** เลื่อนลงล่างสุด **Layers** → **Add a layer** → **Specify an ARN** → วาง
   `arn:aws:lambda:us-east-1:017000801446:layer:AWSLambdaPowertoolsPythonV3-python313-x86_64:40` → **Verify** → **Add**
   (layer นี้มี Powertools 3.37.0 และ pydantic 2.14.1 — โค้ด import ไม่ได้ถ้าลืมใส่)
4. แท็บ **Configuration → General configuration** → **Edit** → Memory **256 MB**, Timeout **0 min 10 sec** → Save
5. แท็บ **Configuration → Environment variables** → **Edit** → **Add environment variable** ตามข้อ 5.3 → Save

| ชื่อ function | Handler | ถูกเรียกโดย |
|---|---|---|
| `bookmybooth-dev-events` | `functions.events.app.lambda_handler` | API Gateway |
| `bookmybooth-dev-bookings` | `functions.bookings.app.lambda_handler` | API Gateway |
| `bookmybooth-dev-admin` | `functions.admin.app.lambda_handler` | API Gateway |
| `bookmybooth-dev-me` | `functions.me.app.lambda_handler` | API Gateway |
| `bookmybooth-dev-post-confirmation` | `functions.post_confirmation.app.lambda_handler` | Cognito trigger |
| `bookmybooth-dev-expire-booking` | `functions.expire_booking.app.lambda_handler` | EventBridge Scheduler |

แนะนำให้สร้าง **expire-booking ก่อน bookings** จะได้มี ARN ไปใส่ env ของ bookings ทันที (ARN อยู่มุมขวาบนของหน้า function → ปุ่ม copy) จดลงใบจดค่า

### 5.3 Environment variables
**ใส่ชุดนี้ทุก function** (ทั้ง 6 ตัว ใส่เหมือนกันหมดง่ายสุด ไม่มีผลเสีย):

| Key | Value | โค้ดที่อ่าน |
|---|---|---|
| `USERS_TABLE` | `bookmybooth-dev-users` | `shared/db.py` |
| `EVENTS_TABLE` | `bookmybooth-dev-events` | `shared/db.py` |
| `LOTS_TABLE` | `bookmybooth-dev-lots` | `shared/db.py` |
| `BOOKINGS_TABLE` | `bookmybooth-dev-bookings` | `shared/db.py` |
| `NOTIFICATIONS_TABLE` | `bookmybooth-dev-notifications` | `shared/db.py` |
| `FILES_BUCKET` | ชื่อ bucket ข้อ 3 | `shared/s3.py` |
| `POWERTOOLS_SERVICE_NAME` | `bookmybooth` | Powertools Logger |
| `POWERTOOLS_LOG_LEVEL` | `INFO` | Powertools Logger |

**เพิ่มเฉพาะบางตัว** (ใส่ทุกตัวก็ได้เหมือนกัน):

| Function | Key | Value | โค้ดที่อ่าน |
|---|---|---|---|
| admin | `USER_POOL_ID` | User Pool ID ข้อ 4 | `shared/cognito.py` |
| bookings | `EXPIRE_FUNCTION_ARN` | ARN ของ `bookmybooth-dev-expire-booking` | `shared/scheduler.py` |
| bookings | `SCHEDULER_ROLE_ARN` | `arn:aws:iam::<Account ID>:role/LabRole` | `shared/scheduler.py` |

- ⚠️ **ห้ามใส่ `AWS_ENDPOINT_URL`** (ใช้เฉพาะ API จำลองในเครื่อง) ไม่งั้น boto3 จะไปหา localhost
- ถ้าลืม env ตัวไหน → function นั้นตอบ **500** และใน CloudWatch Logs จะเห็น `KeyError: 'XXX_TABLE'`

### 5.4 ทดสอบ Lambda ก่อนต่อ API (ไม่บังคับ แต่ช่วยหาปัญหาเร็ว)
หน้า function `bookmybooth-dev-expire-booking` → แท็บ **Test** → Create new event → Event JSON = `{}` → **Test**
- ผ่าน = Execution result: succeeded และ response `{"expired": []}`
- ถ้าเห็น `ImportModuleError` → ลืม layer หรือ Handler ผิด (ข้อ 12) · `KeyError` → ลืม env · `AccessDenied` → role ไม่ใช่ LabRole

ดู log ทุก function ได้ที่แท็บ **Monitor → View CloudWatch logs**

### 5.5 กลับไปตั้ง PostConfirmation trigger
ทำข้อ 4 ขั้น 10 ตอนนี้

---

## 6. API Gateway — HTTP API

ค้นหา **API Gateway** → **Create API** → การ์ด **HTTP API** → **Build**

### 6.0 สร้าง API
1. **Create and configure integrations**: ยังไม่ต้องเพิ่ม → API name = `bookmybooth-dev` → IP address type = IPv4 → **Next**
2. **Configure routes**: ข้ามไปก่อน → **Next**
3. **Define stages**: ใช้ **`$default`** และเปิด **Auto-deploy** (ค่าเริ่มต้น) → **Next** → **Create**
   - ⚠️ **ห้ามตั้งชื่อ stage อื่น** (เช่น `dev`) เพราะ path จะมี `/dev` นำหน้าและโค้ดหา route ไม่เจอ (404 ทุก route) ถ้าจำเป็นต้องใช้ชื่อ stage ดูข้อ 10.2
4. จด **Invoke URL** จากหน้า API (เช่น `https://abc123.execute-api.us-east-1.amazonaws.com`) ลงใบจดค่า

### 6.1 Routes ทั้งหมด (32 route)
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
| 28 | GET | `/admin/users` | admin | ✅ cognito |
| 29 | GET | `/me` | me | ✅ cognito |
| 30 | PUT | `/me` | me | ✅ cognito |
| 31 | GET | `/notifications` | me | ✅ cognito |
| 32 | POST | `/notifications/read` | me | ✅ cognito |

> - `GET /bookings/me` (#14) กับ `GET /bookings/{bookingId}/slip` (#17) ไม่ชนกัน เพราะ path ยาวไม่เท่ากัน
> - route #18–#21 รับ `bookingId` ของล็อกใดก็ได้ในชุด แล้วทำทั้งชุด (D7) ไม่ต้องตั้งอะไรเพิ่มใน Console
> - **ไม่ต้องสร้าง route `OPTIONS`** — CORS ในข้อ 6.2 ตอบ preflight ให้เอง
> - ถ้าลืมผูก authorizer ที่ route ไหน route นั้นจะตอบ **401 เสมอ** (โค้ดไม่เจอ claims) ไม่ได้เปิดให้ทุกคนเข้า — เป็นสัญญาณให้กลับไปผูก authorizer

### 6.2 CORS
เมนูซ้าย **Develop → CORS** → **Configure**:
| ช่อง | ค่า |
|---|---|
| Access-Control-Allow-Origin | `http://localhost:5173` (กด Add แล้วเพิ่มโดเมน Amplify ทีหลังหลังข้อ 8) |
| Access-Control-Allow-Headers | `authorization`, `content-type` |
| Access-Control-Allow-Methods | `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS` |
| Access-Control-Max-Age | `600` |
| Access-Control-Allow-Credentials | ไม่ติ๊ก (ส่ง token ใน header ไม่ใช้ cookie) |

→ **Save**

### 6.3 JWT authorizer
เมนู **Develop → Authorization** → แท็บ **Manage authorizers** → **Create**
| ช่อง | ค่า |
|---|---|
| Authorizer type | **JWT** |
| Name | `cognito` |
| Identity source | `$request.header.Authorization` |
| Issuer URL | `https://cognito-idp.us-east-1.amazonaws.com/<User Pool ID>` (ไม่มี `/` ท้าย) |
| Audience | `<Client ID>` |

→ **Create** · หน้าเว็บส่ง **access token** ซึ่งไม่มี claim `aud` แต่มี `client_id` — HTTP API ตรวจ `client_id` กับ Audience ให้เอง ใช้ได้

### 6.4 Integrations (4 ตัว)
เมนู **Develop → Integrations** → แท็บ **Manage integrations** → **Create** ทำ 4 ครั้งสำหรับ events, bookings, admin, me:
| ช่อง | ค่า |
|---|---|
| Attach this integration to a route | เว้นว่าง (ผูกทีหลังในข้อ 6.5) |
| Integration type | **Lambda function** |
| AWS Region | us-east-1 |
| Lambda function | `bookmybooth-dev-<ชื่อ>` |
| Payload format version | **2.0** (ค่าเริ่มต้น — ⚠️ โค้ดใช้รูปแบบ 2.0 ห้ามเปลี่ยนเป็น 1.0) |
| Grant API Gateway permission to invoke your Lambda function | เปิด (ค่าเริ่มต้น) |

### 6.5 สร้าง route และผูก integration
เมนู **Develop → Routes** → **Create** ทีละ route ตามตาราง 6.1:
1. เลือก Method → พิมพ์ path เช่น `/events/{eventId}/lots` → **Create**
2. คลิก route ที่เพิ่งสร้าง → **Attach integration** → เลือก integration ตามคอลัมน์ Integration → **Attach integration**
3. ทำจนครบ 32 route · ระวัง #11 และ #12 ผูกกับ **bookings** ไม่ใช่ events

### 6.6 ผูก authorizer
เมนู **Develop → Authorization** → แท็บ **Attach authorizers to routes** → คลิกทีละ route ที่ตาราง 6.1 เขียน ✅ → เลือก `cognito` → **Attach authorizer**
- route #1–#4 (✅ ไม่มี) **ห้ามผูก** ไม่งั้นคนที่ยังไม่ล็อกอินดูงานไม่ได้
- ตรวจ: route ที่ผูกแล้วจะมีป้าย **JWT Auth** ในหน้า Routes

### 6.7 Throttling
เมนู **Deploy → Stages** → `$default` → ส่วน **Throttling** (หรือ **Route settings → Default route settings**) → **Edit** → Burst limit **10**, Rate limit **20** → Save (กันไม่ให้เกิน limit 10 concurrent ของ Lab)

### 6.8 ทดสอบทันที
เปิดในเบราว์เซอร์: `<Invoke URL>/health` → ต้องได้ `{"status":"ok"}` · `<Invoke URL>/me` → ต้องได้ 401 `{"message":"Unauthorized"}`

---

## 7. EventBridge Scheduler

**ไม่ต้องสร้างอะไรเอง** — ตอนผู้ขายจอง function bookings จะสร้าง schedule ชื่อ `expire-<groupId>` แบบครั้งเดียว (`at(...)`, schedule group `default`, ลบตัวเองหลังทำงาน) ไปเรียก expire-booking เมื่อหมดเวลาแนบสลิป · หมดเวลาทั้งชุดและแจ้งเตือนครั้งเดียว

**ต้องทดสอบตอนขึ้นจริง:** Lambda (รันด้วย LabRole) สร้าง schedule ที่ส่ง `RoleArn` = LabRole ได้ไหม (ต้องใช้ `iam:PassRole`)
- วิธีดู: จองจากหน้าเว็บ แล้วเปิด Console **EventBridge → Scheduler → Schedules** ต้องเห็น `expire-<groupId>` · หรือดู CloudWatch Logs ของ bookings ถ้าเจอ `Failed to create expiry schedule` + `AccessDenied` = ไม่ได้
- **ถ้าไม่ได้ ระบบยังใช้งานได้** — การจองไม่ล้ม และล็อกที่หมดเวลาจะถูกปล่อยเองตอนมีคนเปิดดูล็อก/จอง/ดูการจอง (fallback ข้อ 7.6 ใน PLAN)
- ถ้าอยากให้หมดเวลาตรงเวลาจริง: สร้าง schedule `rate(5 minutes)` ใน Console ให้เรียก expire-booking **โดยไม่ส่ง input** (โค้ดรองรับโหมดกวาดแล้ว ไม่ต้องแก้) role = LabRole — ⚠️ เป็น resource ใหม่ ต้องถามทีมก่อน

---

## 8. Frontend บน Amplify Hosting

Vite อ่านค่า `VITE_*` **ตอน build** (ฝังลงในไฟล์ JS) ไม่ได้อ่านตอนเปิดหน้าเว็บ เปลี่ยนค่าแล้วต้อง build/deploy ใหม่ทุกครั้ง

### 8.1 ค่า env ของ frontend
| Key | Value |
|---|---|
| `VITE_API_URL` | Invoke URL ข้อ 6 (ไม่มี `/` ท้าย) |
| `VITE_AUTH_MODE` | **`cognito`** ⚠️ ห้ามลืม ถ้าไม่ใส่ หน้าเว็บจะใช้โหมด `dev` แล้วเรียก `/_dev/sign-in` ที่ไม่มีบน AWS → ล็อกอินไม่ได้ |
| `VITE_USER_POOL_ID` | User Pool ID ข้อ 4 |
| `VITE_USER_POOL_CLIENT_ID` | Client ID ข้อ 4 |
| `VITE_REGION` | `us-east-1` |

### 8.2 สร้าง app (เลือกทางใดทางหนึ่ง)
ค้นหา **AWS Amplify** → **Create new app** (หรือ **Deploy an app**)

> ⚠️ ยังไม่เคยทดสอบ Amplify Hosting ใน Learner Lab (ไม่อยู่ใน spike) ลองทาง A ก่อน ถ้าเชื่อม GitHub ไม่ได้หรือถูกบังคับให้สร้าง service role ให้ใช้ทาง B

**ทาง A — เชื่อม GitHub (build อัตโนมัติทุกครั้งที่ push)**
1. เลือก **GitHub** → Authorize → เลือก repository `BookMyBooth` และ branch `main`
2. ติ๊ก **My app is a monorepo** → Monorepo root directory = **`Frontend`**
3. **App settings → Build settings** → Edit YAML แล้ววาง:
   ```yaml
   version: 1
   applications:
     - appRoot: Frontend
       frontend:
         phases:
           preBuild:
             commands:
               - nvm install 22
               - nvm use 22
               - npm ci
           build:
             commands:
               - npm run build
         artifacts:
           baseDirectory: dist
           files:
             - '**/*'
         cache:
           paths:
             - node_modules/**/*
   ```
4. **Advanced settings → Environment variables** → ใส่ทั้ง 5 ค่าในข้อ 8.1 (ใส่ตอนนี้เลย ไม่งั้น build แรกจะได้ค่าผิด)
5. Service role = ไม่ต้องเลือก / ใช้ค่าเริ่มต้นที่ไม่สร้าง role ใหม่ → **Save and deploy**
6. รอจนขั้น Provision → Build → Deploy เป็นสีเขียว (3–5 นาที) ถ้า Build แดง กดเข้าไปดู log
7. เปลี่ยน env ทีหลัง: **Hosting → Environment variables** → Manage variables → Save → **Deployments → Redeploy this version**

**ทาง B — Deploy without Git (build ในเครื่องแล้วอัปโหลด)**
1. ในเครื่องสร้างไฟล์ `Frontend/.env.production.local` (ไฟล์ `*.local` ไม่ถูก commit) ใส่ค่าข้อ 8.1:
   ```
   VITE_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com
   VITE_AUTH_MODE=cognito
   VITE_USER_POOL_ID=us-east-1_xxxxxxxxx
   VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
   VITE_REGION=us-east-1
   ```
2. build:
   ```powershell
   cd Frontend
   npm ci
   npm run build
   Compress-Archive -Path dist\* -DestinationPath dist.zip -Force
   ```
   (zip **ไฟล์ข้างใน** `dist` ไม่ใช่ตัวโฟลเดอร์ `dist` — ใน zip ต้องเห็น `index.html` ที่ชั้นแรก)
3. Amplify → **Deploy without Git** → App name `bookmybooth-dev` → Branch name `main` → ลาก `dist.zip` ใส่ → **Save and deploy**
4. ทางนี้ **env ใน Amplify Console ไม่มีผล** (build ไปแล้วในเครื่อง) เปลี่ยนค่าต้องแก้ `.env.production.local` → build → zip → **Deploy updates** ใหม่

### 8.3 Rewrite สำหรับ react-router (ทำทั้งสองทาง)
**Hosting → Rewrites and redirects** → **Manage redirects** → **Add rewrite**:
| Source address | Target address | Type |
|---|---|---|
| `/<*>` | `/index.html` | **200 (Rewrite)** |

→ Save · ถ้าไม่ตั้ง เปิดหน้าแรกได้ แต่กด refresh ที่หน้าอื่น (เช่น `/my-bookings`) จะได้ 404

### 8.4 เอาโดเมนไปเพิ่มใน CORS
1. จดโดเมนจากหน้า app (เช่น `https://main.d1abc234.amplifyapp.com`) ลงใบจดค่า
2. กลับไปเพิ่มโดเมนนี้ (ไม่มี `/` ท้าย) ใน **S3 CORS (ข้อ 3 ขั้น 7)** และ **API Gateway CORS (ข้อ 6.2)**
3. ถ้าข้ามขั้นนี้ หน้าเว็บบน Amplify จะเรียก API ไม่ได้ (error CORS) แม้ `localhost` จะใช้ได้

งานฝั่ง frontend ทั้งหมดอยู่ใน PLAN หัวข้อ 15 (F1–F36)

---

## 9. ข้อมูลเดโม (seed)

`scripts/seed.py` สร้างบัญชี `admin@`, `organizer@`, `seller@bookmybooth.test` (ACTIVE ทุกบัญชี) และงานเปิดรับจอง `demo-event` 12 ล็อก รันซ้ำได้ · ต้องรันในเครื่องที่มี venv (ข้อ 0.3) เพราะสคริปต์ import โค้ด `src/` และใช้ Python 3.13 (CloudShell ไม่มี Python เวอร์ชันนี้)

### 9.1 ตั้ง credentials ของ Lab ในเครื่อง (ทุก session)
1. หน้า Learner Lab → **AWS Details** → **AWS CLI: Show** → คัดลอกทั้งก้อน หน้าตาประมาณนี้
   ```
   [default]
   aws_access_key_id=ASIA...
   aws_secret_access_key=...
   aws_session_token=IQoJb3JpZ2luX2VjE...
   ```
2. วางทับลงไฟล์ `%USERPROFILE%\.aws\credentials` (Windows) หรือ `~/.aws/credentials` (สร้างโฟลเดอร์ `.aws` เองถ้ายังไม่มี) — ต้องมี **`aws_session_token`** ด้วย ไม่งั้นได้ `UnrecognizedClientException`
3. ตรวจ (ถ้ามี AWS CLI): `aws sts get-caller-identity` ต้องเห็น Account ID และ `assumed-role/voclabs/...`
4. credentials หมดอายุพร้อม session (ประมาณ 4 ชม.) ถ้าเจอ `ExpiredTokenException` ให้ Start Lab แล้วคัดลอกใหม่

### 9.2 รัน seed
PowerShell:
```powershell
cd Backend
.venv\Scripts\Activate.ps1
$env:SEED_PASSWORD = "Demo1234"
python scripts/seed.py --user-pool-id us-east-1_xxxxxxxxx --stage dev
```
Git Bash: `SEED_PASSWORD=Demo1234 python scripts/seed.py --user-pool-id us-east-1_xxxxxxxxx --stage dev`
- รหัสผ่านต้องผ่าน password policy (ยาว ≥ 8 มีตัวเล็ก + ตัวเลข) และ **อย่า commit** รหัสผ่านลงไฟล์ใด ๆ
- ตรวจ: DynamoDB → `bookmybooth-dev-users` → **Explore table items** ต้องเห็น 3 บัญชี · `bookmybooth-dev-events` มี `demo-event` · Cognito → Users มี 3 คน และอยู่ใน group ตามบทบาท

---

## 10. จุดในโค้ด Backend ที่เกี่ยวกับ AWS

### 10.1 แผนที่: ค่าใน AWS ↔ ไฟล์ในโค้ด
| ค่าใน AWS | ไฟล์ที่เกี่ยวข้อง | ต้องตรงกันอย่างไร |
|---|---|---|
| ชื่อตาราง | `src/shared/db.py` (`_TABLE_ENV`) | อ่านจาก env ไม่ hardcode — เปลี่ยนชื่อตารางได้โดยแก้แค่ env |
| key / GSI ของตาราง | `tests/tables.py`, `src/functions/*`, `src/shared/booking_ops.py` (ชื่อ `IndexName`) | ชื่อ attribute และ index ต้องตรงทุกตัว |
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
| เพิ่ม route ใหม่ | ✅ | `@app.xxx` ใน function + สร้าง route ใน Console (ข้อ 6.1) + `ROUTES` ใน `scripts/local_api.py` + PLAN หัวข้อ 6 — ถามทีมก่อน |
| เพิ่ม env ใหม่ | ✅ | โค้ดที่อ่าน + ข้อ 5.3 ของเอกสารนี้ + PLAN 3.4 |
| ขยายขนาดสลิป | ✅ | `src/domain/schemas.py` `SLIP_MAX_BYTES` |
| Scheduler ใช้ไม่ได้ (PassRole) | ❌ ไม่ต้อง | สร้าง schedule `rate(5 minutes)` ใน Console (ถามก่อน) |

### 10.3 อัปเดตโค้ดหลังขึ้น AWS แล้ว
```powershell
cd Backend
pytest
ruff check .
python scripts/build_zip.py
```
แล้วอัปโหลด `build/lambda.zip` ใหม่ (หน้า function → Code → Upload from → .zip file) — **ถ้าแก้ไฟล์ใน `shared/` หรือ `domain/` ต้องอัปโหลดให้ครบทั้ง 6 function** เพราะทุกตัวใช้โค้ดร่วมกัน ถ้าแก้แค่ `functions/<ชื่อ>/` อัปโหลดเฉพาะตัวนั้นได้ · Handler, layer, env ไม่หายเมื่ออัปโหลด zip ใหม่

---

## 11. ตรวจหลังสร้างเสร็จ (smoke test)

ทำตามลำดับ ถ้าข้อไหนไม่ผ่าน ดูข้อ 12 ก่อนทำข้อถัดไป

| # | ทดสอบ | ผลที่ต้องได้ |
|---|---|---|
| 1 | เปิด `<Invoke URL>/health` ในเบราว์เซอร์ | `{"status":"ok"}` |
| 2 | เปิด `<Invoke URL>/events` | `{"items":[...]}` มี `demo-event` (ถ้า seed แล้ว) |
| 3 | เปิด `<Invoke URL>/me` โดยไม่มี token | 401 `{"message":"Unauthorized"}` (authorizer ทำงาน) |
| 4 | เปิดหน้าเว็บ Amplify → ล็อกอิน `seller@bookmybooth.test` | เข้าได้ หน้า "ร้านของฉัน" แสดงข้อมูลร้าน |
| 5 | สมัครผู้ขายใหม่ด้วยอีเมลจริง แล้วกรอก OTP จากอีเมล | ตาราง users มี item `SELLER#ACTIVE` และผู้ใช้อยู่ใน group `Seller` |
| 6 | สมัครผู้จัดงานใหม่ | users มี `ORGANIZER#PENDING` และ Admin เห็นแจ้งเตือน |
| 7 | Admin อนุมัติ → ผู้จัดงานกด "ตรวจสอบสถานะอีกครั้ง" → สร้างงาน | สร้างได้ (201) |
| 8 | ผู้ขายจอง 2 ล็อก | Scheduler มี `expire-<groupId>` (ถ้าไม่มี ดูข้อ 7) |
| 9 | อัปโหลดสลิปจากหน้าเว็บ | ไม่มี error CORS, ไฟล์อยู่ใน bucket `slips/...` |
| 10 | ผู้จัดงานอนุมัติทั้งชุด / ย้ายบางล็อก | สถานะ ผัง และแจ้งเตือนตรงทั้งสองฝั่ง |
| 11 | ตั้งงานที่ `slipDeadlineMinutes = 2` จองแล้วรอ 3 นาที | การจองทั้งชุดเป็น "หมดเวลา" ล็อกกลับเป็นว่าง แจ้งเตือน 1 ข้อความ |
| 12 | race test (ข้อ 11.1) | 201 × 1, 409 × 4 |
| 13 | ไล่ checklist INTEGRATION-PLAN หัวข้อ 6 ทั้ง 11 ข้อ | ผ่านทุกข้อ |

### 11.1 race test — จองล็อกเดียวกันพร้อมกัน
1. หาล็อกที่ว่างใน `demo-event` (เช่น `B05`) และผู้ขายที่ยังไม่เต็มโควตาของงาน (`demo-event` จำกัด 2 ล็อกต่อร้าน)
2. เอา access token: ล็อกอินเป็นผู้ขายในหน้าเว็บ → กด F12 → แท็บ **Application** → **Local Storage** → โดเมนเว็บ → คัดลอกค่าของ key ที่ลงท้ายด้วย **`.accessToken`**
3. รัน (venv):
   ```powershell
   cd Backend
   python scripts/race_test.py --api-url <Invoke URL> --event-id demo-event --lot-id B05 --token <accessToken>
   ```
4. ผ่าน = `สรุป: {201: 1, 409: 4}` และ `ผ่าน ✔` · ถ้าได้ `QUOTA_EXCEEDED` ทุก request = ผู้ขายเต็มโควตา เปลี่ยนผู้ขาย
5. หลังทดสอบ ให้ผู้ขายยกเลิกการจองที่ได้ในหน้า "การจองของฉัน" เพื่อคืนล็อก
6. ทดสอบกับ API จำลองในเครื่องก่อนได้: `--api-url http://localhost:3001 --token dev.<userId>`

---

## 12. อาการที่เจอบ่อย

| อาการ | สาเหตุที่น่าจะเป็น | แก้ |
|---|---|---|
| 404 `ROUTE_NOT_FOUND` ทุก route | ใช้ stage ชื่ออื่นที่ไม่ใช่ `$default` | ใช้ `$default` หรือแก้ `strip_prefixes` (10.2) |
| 404 ของ API Gateway (`{"message":"Not Found"}`) | ยังไม่ได้สร้าง route นั้น หรือพิมพ์ path ผิด | ข้อ 6.1, 6.5 |
| 401 ทั้งที่ล็อกอินแล้ว | ไม่ได้ส่ง header / Issuer URL หรือ Audience ผิด | ตรวจ `Authorization: Bearer <accessToken>`, ข้อ 6.3 |
| 401 ที่ route สาธารณะ (`/events`) | เผลอผูก authorizer ให้ route #1–#4 | ข้อ 6.6 เอา authorizer ออก |
| 403 `ACCOUNT_NOT_FOUND` | ไม่มี item ใน users — PostConfirmation trigger ไม่ได้ตั้งหรือล้ม | ข้อ 4 ขั้น 10 แล้วดู Logs ของ post-confirmation |
| 403 `FORBIDDEN` หลัง Admin อนุมัติ | token เก่ายังไม่มี group `Organizer` | กด "ตรวจสอบสถานะอีกครั้ง" หรือล็อกอินใหม่ |
| 500 + `KeyError` ใน Logs | ลืม env | ข้อ 5.3 |
| `Runtime.ImportModuleError: No module named 'aws_lambda_powertools'` | ลืมใส่ layer | ข้อ 5.2 ขั้น 3 |
| `Runtime.ImportModuleError: No module named 'functions'` | Handler ผิด หรือ zip โครงสร้างผิด | ใช้ zip จาก `build_zip.py` และ Handler ตามตาราง |
| Lambda timeout 10 วินาที ทุกครั้ง | เผลอผูก VPC | Configuration → VPC → Edit → เลือก **No VPC** (ข้อ 0.2) |
| `ResourceNotFoundException` ของ DynamoDB | ชื่อตารางใน env ไม่ตรง หรือสร้างคนละ region | ข้อ 5.3 และตรวจ region us-east-1 |
| `ValidationException ... index` | ชื่อ GSI ไม่ตรง | ข้อ 2.6 |
| เบราว์เซอร์ฟ้อง CORS ตอนเรียก API | ไม่ได้เพิ่มโดเมนใน CORS ของ API | ข้อ 6.2, 8.4 |
| เบราว์เซอร์ฟ้อง CORS ตอนอัปโหลดสลิป | CORS ของ bucket | ข้อ 3 ขั้น 7, 8.4 |
| หน้าเว็บ Amplify ล็อกอินไม่ได้ / เรียก `/_dev/...` | ไม่ได้ตั้ง `VITE_AUTH_MODE=cognito` หรือตั้งแล้วไม่ได้ build ใหม่ | ข้อ 8.1 แล้ว redeploy |
| refresh หน้าอื่นบน Amplify แล้ว 404 | ไม่ได้ตั้ง rewrite | ข้อ 8.3 |
| สมัครแล้วไม่ได้อีเมล OTP | เกินโควตา 50 ฉบับ/วันของ Cognito หรือติด spam | รอวันถัดไป / ใช้บัญชี seed |
| seed ได้ `UnrecognizedClientException` / `ExpiredTokenException` | ไม่มี session token หรือ session หมด | ข้อ 9.1 |
| Lambda timeout / 503 ช่วงคนใช้เยอะ | เกิน 10 concurrent ของ Lab | throttling ข้อ 6.7 |

## 13. เมื่อบัญชี Lab ถูก reset
ทุกอย่างหายหมด ให้ทำข้อ 2 → 9 ใหม่ตามลำดับ แล้วอัปเดตค่าใน Amplify (ข้อ 8) และตาราง "Resource ที่สร้างจริง" ใน PROGRESS.md

---

## 14. ย้ายจาก API จำลองในเครื่องไป AWS

ก่อนขึ้น AWS ทีมพัฒนาและเชื่อม frontend กับ `Backend/scripts/local_api.py` (ดู [INTEGRATION-PLAN.md](INTEGRATION-PLAN.md) หัวข้อ 4) ตอนสลับไป AWS ให้ทำตามนี้

### 14.1 ฝั่ง Backend — **ไม่ต้องแก้โค้ดใน `src/`**
| เรื่อง | API จำลอง | AWS | ต้องทำ |
|---|---|---|---|
| โค้ด Lambda | `local_api.py` import handler จาก `src/` ตรง ๆ | `build/lambda.zip` | รัน `build_zip.py` แล้วอัปโหลด (ข้อ 5) — zip **ไม่มี** `scripts/` จึงไม่มีโค้ด dev ติดไป |
| ตาราง / bucket / user pool | moto server สร้างให้ตอนเปิด จาก `tests/tables.py` | สร้างใน Console (ข้อ 2–4) | สร้างให้ **ตรงกับ `tests/tables.py`** ทุก key และ index |
| `AWS_ENDPOINT_URL` | `http://127.0.0.1:5000` (ชี้ไป moto server ต้องติดตั้ง `requirements-dev.txt` ที่มี `moto[server]`) | **ต้องไม่มี** | ห้ามใส่ env นี้ใน Lambda ไม่งั้น boto3 จะไปหา localhost |
| ชื่อตาราง / env | `local_api.py` ตั้งให้เอง | ข้อ 5.3 | ตั้ง env ของ Lambda ให้ครบ |
| ตรวจ token | `local_api.py` แปลง `Bearer dev.<userId>` เป็น claims | API Gateway JWT authorizer (ข้อ 6.3) | ผูก authorizer ทุก route ที่ไม่ใช่สาธารณะ |
| CORS | `local_api.py` ใส่ header ให้ | API Gateway CORS (ข้อ 6.2) + S3 CORS (ข้อ 3) | ใส่โดเมน Amplify (ข้อ 8.4) |
| route ใหม่ | เพิ่มในตาราง `ROUTES` ของ `local_api.py` | สร้างใน Console ข้อ 6.1 | แก้ทั้งสองที่ให้ตรงกัน |
| สมัคร / ยืนยัน / ล็อกอิน / ลืมรหัสผ่าน | `/_dev/sign-up`, `/_dev/confirm`, `/_dev/sign-in`, `/_dev/reset-password` | Cognito จริง + PostConfirmation trigger (ข้อ 4 ขั้น 10) | ตั้ง trigger — endpoint `/_dev/*` ไม่มีบน AWS |
| หมดเวลาจอง | `POST /_dev/expire` (กดเอง) | EventBridge Scheduler (ข้อ 7) | ทดสอบ `iam:PassRole` |
| ข้อมูลเดโม | seed ให้ทุกครั้งที่เปิด (หายเมื่อปิด) | `scripts/seed.py` (ข้อ 9) ครั้งเดียว | รัน seed ด้วย credentials ของ Lab |

### 14.2 ฝั่ง Frontend — เปลี่ยนแค่ค่า env
| Key | API จำลอง (`.env.local`) | AWS (ข้อ 8.1) |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` | Invoke URL (ข้อ 6) |
| `VITE_AUTH_MODE` | `dev` | `cognito` |
| `VITE_USER_POOL_ID` | ไม่ใช้ | User Pool ID (ข้อ 4) |
| `VITE_USER_POOL_CLIENT_ID` | ไม่ใช้ | Client ID (ข้อ 4) |
| `VITE_REGION` | ไม่ใช้ | `us-east-1` |

โค้ด frontend เลือก auth adapter จาก `VITE_AUTH_MODE` (`src/auth/devAdapter.ts` ↔ `src/auth/cognitoAdapter.ts`) ส่วนเรียก API ใช้ `src/api/client.ts` ตัวเดียวกันทั้งสองโหมด
ทดสอบหน้าเว็บในเครื่องกับ AWS จริงก่อนขึ้น Amplify ได้: ใส่ค่าโหมด AWS ใน `Frontend/.env.local` แล้ว `npm run dev` (CORS ของ API และ S3 มี `localhost:5173` อยู่แล้ว)

### 14.3 สิ่งที่ทำงานต่างกันระหว่างสองโหมด (ต้องทดสอบซ้ำบน AWS)
| เรื่อง | API จำลอง | AWS |
|---|---|---|
| OTP ยืนยันอีเมล / รีเซ็ตรหัสผ่าน | ไม่มีอีเมลจริง (ข้ามรหัส) | Cognito ส่งอีเมลจริง (วันละ 50 ฉบับ) |
| token หมดอายุ | ไม่หมด | access token 1 ชม. → frontend refresh ผ่าน Amplify |
| group หลังอนุมัติผู้จัดงาน | มีผลทันที (อ่านจาก Cognito จำลองทุก request) | ต้อง `fetchAuthSession({ forceRefresh: true })` ก่อน |
| error 401 จาก authorizer | `{"message":"Unauthorized"}` เลียนแบบ API Gateway (route ไม่มี → `404 {"message":"Not Found"}`) | เหมือนกัน — frontend เช็ก status code อย่างเดียว |
| หมดเวลาจองอัตโนมัติ | ต้องกด `/_dev/expire` หรือรอ fallback | Scheduler ยิงเอง |
| ข้อมูล | หายเมื่อปิดเซิร์ฟเวอร์ | อยู่ถาวรใน DynamoDB/S3 |

ไล่ checklist ใน INTEGRATION-PLAN หัวข้อ 6 ซ้ำอีกรอบบน AWS
