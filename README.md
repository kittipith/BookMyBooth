# BookMyBooth

ระบบจองล็อกขายสินค้าและพื้นที่บูธออนไลน์สำหรับงานมหาวิทยาลัย ตลาดนัด และงานแฟร์ ทำงานบน AWS แบบ Serverless

**เว็บ (ชุด dev):** https://main.d1tvp6kz9uh3dp.amplifyapp.com — หน้าเข้าสู่ระบบมีปุ่มบัญชีเดโม (ผู้ดูแลระบบ / ผู้จัดงาน / ผู้ขาย)

---

## ทำอะไรได้บ้าง

| บทบาท | ความสามารถหลัก |
|---|---|
| **ผู้ขาย** | ดูงานที่เปิดรับจอง · เลือกล็อกบนผังงาน จองได้หลายล็อกในครั้งเดียว · แนบสลิปใบเดียวทั้งชุดภายในเวลาที่กำหนด · ดูสถานะ / ยกเลิก · QR เช็กอินหน้างาน · แจ้งเตือนในเว็บ |
| **ผู้จัดงาน** (รอ Admin อนุมัติ) | สร้างงาน วาดผังกริด ตั้งโซนและราคา · ตรวจสลิป อนุมัติ / ย้ายบางล็อก / ปฏิเสธ / ยกเลิก ทีละชุด · เช็กอินวันงาน · สรุปยอดและสถิติร้าน |
| **ผู้ดูแลระบบ** | อนุมัติ / ปฏิเสธผู้จัดงาน · ดูผู้ใช้ทั้งหมด · ระงับ / ยกเลิกระงับบัญชี · ดูงานทั้งหมดพร้อมยอด |

กฎสำคัญ: ล็อกเดียวจองซ้ำไม่ได้ (DynamoDB transaction) · 1 การจอง = 1 ชุดล็อกที่จองพร้อมกัน ตัดสินทั้งชุด · ไม่แนบสลิปตามเวลา ระบบปล่อยล็อกคืนเอง (EventBridge Scheduler) · การคืนเงินทำนอกระบบ

รายละเอียดขอบเขตทั้งหมด: [BookMtBooth-scope.md](BookMtBooth-scope.md)

---

## สถาปัตยกรรม

```
เบราว์เซอร์ ──► AWS Amplify Hosting (React + Vite)
   │                └── aws-amplify ──► Amazon Cognito (สมัคร / ล็อกอิน / OTP / Groups)
   │
   ├──► API Gateway (HTTP API + JWT authorizer) ──► AWS Lambda × 6 (Python 3.13)
   │                                                     │
   │                                   DynamoDB 5 ตาราง · S3 (สลิป) · EventBridge Scheduler
   └──► S3 (อัปโหลด / ดูสลิปผ่าน presigned URL)
```

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 19, Vite 8, TypeScript, Tailwind CSS 4, TanStack Query, aws-amplify (Auth), lucide-react |
| Backend | Python 3.13, AWS Lambda Powertools (router, logger), pydantic v2, boto3 |
| AWS | Amplify Hosting, Cognito, API Gateway (HTTP API), Lambda, DynamoDB (On-demand), S3, EventBridge Scheduler, CloudWatch |
| ทดสอบ | pytest + moto, ruff, ESLint |
| สภาพแวดล้อม | AWS Academy Learner Lab (`us-east-1`, ทุกอย่างใช้ `LabRole`) |

---

## โครงสร้าง repo

```
BookMyBooth/
├── README.md                 ← ไฟล์นี้
├── BookMtBooth-scope.md      ← ขอบเขตโปรเจค
├── AWS-SETUP.md              ← คู่มือสร้าง AWS ทีละขั้น + แก้ปัญหา
├── INTEGRATION-PLAN.md       ← แผนเชื่อม frontend กับ backend + checklist ทดสอบร่วม
├── Backend/
│   ├── PLAN.md               ← ออกแบบ backend (ตาราง, API, booking flow)
│   ├── PROGRESS.md           ← ความคืบหน้า + การตัดสินใจ (D1–D7, I1–I5, F1–F36)
│   ├── src/
│   │   ├── functions/        ← Lambda 6 ตัว: events, bookings, admin, me, post_confirmation, expire_booking
│   │   ├── domain/           ← business logic (สถานะการจอง, ล็อก, ผู้ใช้, ข้อความแจ้งเตือน)
│   │   └── shared/           ← db, auth, s3, scheduler, notify, http
│   ├── scripts/
│   │   ├── local_api.py      ← API จำลองในเครื่อง (moto) ใช้พัฒนา frontend
│   │   ├── build_zip.py      ← สร้าง build/lambda.zip สำหรับอัปโหลด Lambda
│   │   ├── seed.py           ← สร้างบัญชีเดโม + งานตัวอย่างบน AWS
│   │   └── race_test.py      ← ทดสอบจองล็อกเดียวกันพร้อมกัน
│   └── tests/                ← pytest + moto
└── Frontend/
    └── src/
        ├── api/              ← เรียก API (client, DTO, mapper)
        ├── auth/             ← devAdapter (API จำลอง) / cognitoAdapter (AWS)
        ├── queries/          ← TanStack Query hooks
        ├── pages/            ← หน้าเว็บแยกตามบทบาท (user / organizer / admin)
        └── components/
```

---

## รันในเครื่อง

ต้องมี **Python 3.13** และ **Node.js 22+** ไม่ต้องมีบัญชี AWS — ใช้ API จำลองในเครื่อง

### 1. Backend (API จำลอง)
```powershell
cd Backend
py -V:3.13 -m venv .venv
.venv\Scripts\Activate.ps1          # Git Bash: source .venv/Scripts/activate
pip install -r requirements-dev.txt
python scripts/local_api.py         # http://localhost:3001
```
API จำลองรันโค้ด Lambda จริงกับ AWS จำลอง (moto) สร้างบัญชีเดโมและงาน `demo-event` ให้ทุกครั้งที่เปิด ข้อมูลหายเมื่อปิด

### 2. Frontend
```powershell
cd Frontend
copy .env.example .env.local        # ค่าเริ่มต้นชี้ไป API จำลอง (VITE_AUTH_MODE=dev)
npm install
npm run dev                         # http://localhost:5173
```
หน้าเข้าสู่ระบบมีปุ่มบัญชีเดโม · โหมดนี้ไม่ส่งอีเมลจริง รหัส OTP กรอกตัวเลขอะไรก็ได้ 6 หลัก · หมดเวลาจองกดได้ที่ `POST http://localhost:3001/_dev/expire`

### 3. ทดสอบ
```powershell
cd Backend
pytest                              # 163 tests
ruff check .
ruff format --check .

cd ..\Frontend
npm run build                       # ตรวจ TypeScript + build
npm run lint
```

---

## ขึ้น AWS

ทำตาม [AWS-SETUP.md](AWS-SETUP.md) ทีละข้อ (DynamoDB → S3 → Cognito → Lambda → API Gateway → seed → Amplify → smoke test) สรุปสั้น ๆ:

1. `python Backend/scripts/build_zip.py` แล้วอัปโหลด `build/lambda.zip` ให้ Lambda ทั้ง 6 ตัว (ไฟล์เดียวกัน ต่างกันแค่ Handler)
2. ตั้ง env ของ Amplify แล้ว redeploy (ค่ามีผลตอน build เท่านั้น):

| Key | ค่า |
|---|---|
| `VITE_API_URL` | Invoke URL ของ API Gateway |
| `VITE_AUTH_MODE` | `cognito` |
| `VITE_USER_POOL_ID` | User Pool ID |
| `VITE_USER_POOL_CLIENT_ID` | App client ID |
| `VITE_REGION` | `us-east-1` |
| `VITE_DEMO_PASSWORD` | (ไม่บังคับ) รหัสเดียวกับ `SEED_PASSWORD` → แสดงปุ่มบัญชีเดโม ⚠️ ทุกคนเห็นรหัสนี้ เอาออกก่อนใช้งานจริง |

3. อัปเดตโค้ดครั้งต่อไป: build zip ใหม่แล้วอัปโหลด (แก้ `shared/` หรือ `domain/` ต้องอัปโหลดครบ 6 ตัว) · frontend push ขึ้น `main` แล้ว Amplify build ให้เอง

ID ของ resource ชุด dev ที่สร้างจริงอยู่ใน [Backend/PROGRESS.md](Backend/PROGRESS.md) หัวข้อ "Resource ที่สร้างจริง"

---

## เอกสาร

| ไฟล์ | อ่านเมื่อ |
|---|---|
| [BookMtBooth-scope.md](BookMtBooth-scope.md) | อยากรู้ว่าระบบทำอะไร / ไม่ทำอะไร |
| [Backend/PLAN.md](Backend/PLAN.md) | ออกแบบตาราง, API ทั้ง 32 route, booking flow, งานฝั่ง frontend (F1–F36) |
| [Backend/PROGRESS.md](Backend/PROGRESS.md) | ทำอะไรไปแล้ว ตัดสินใจอะไร เหลืออะไร |
| [AWS-SETUP.md](AWS-SETUP.md) | สร้าง / แก้ resource บน AWS และแก้ปัญหาที่เจอบ่อย |
| [INTEGRATION-PLAN.md](INTEGRATION-PLAN.md) | API จำลองในเครื่อง และ checklist ทดสอบร่วม |

---

## สถานะ (2026-10-28)

- ✅ สัปดาห์ 1–10 โค้ด backend + frontend และเทสต์ในเครื่อง
- ✅ สัปดาห์ 11 ขึ้นชุด `dev` บน AWS + Amplify ทดสอบบน AWS ผ่านครบ
- ⬜ สัปดาห์ 12 ชุด `prod`, เอกสาร API, นำเสนอ

---

## ทีม

| สมาชิก | รหัส | หน้าที่หลัก |
|---|---|---|
| นายกิตติพิชญ์ หิรัญวงศ์ | 66070018 | Cloud Infrastructure (Cognito, S3, Lambda, API Gateway, Amplify, Deploy) |
| นายปณวัฒน์ ธรรมเจริญ | 66070113 | Backend: Booking flow, DynamoDB transaction, EventBridge |
| นายสรวิชญ์ กาญจนสันติศักดิ์ | 66070199 | Backend: Event/Lot API, Admin API, Notification |
| นางสาวอิสรีย์ แม้นถาวรสิริ | 66070323 | Frontend (React + Vite), UI/UX, เชื่อมต่อ API และ Cognito |
