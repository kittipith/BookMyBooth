# BookMyBooth — Frontend

หน้าเว็บของ BookMyBooth (React 19 + Vite 8 + TypeScript + Tailwind CSS 4) ข้อมูลทั้งหมดมาจาก Backend API (Lambda บน AWS หรือ API จำลองในเครื่อง) ภาพรวมทั้งโปรเจกต์อยู่ที่ [README ของ repo](../README.md)

- **ผู้ขาย** ดูผังงาน เลือกได้หลายล็อก จองทั้งงานเป็นชุดเดียว แนบสลิปใบเดียว QR เช็กอิน
- **ผู้จัดงาน** วาดผัง ตั้งโซนและราคา ตรวจและอนุมัติการจองทีละชุด (ย้ายบางล็อกได้) เช็กอินวันงาน (ต้องรอผู้ดูแลระบบอนุมัติบัญชี)
- **ผู้ดูแลระบบ** อนุมัติผู้จัดงาน และจัดการผู้ใช้

หนึ่งบัญชีมีบทบาทเดียว และเปิดได้เฉพาะหน้าของบทบาทนั้น

## เริ่มใช้งาน

ต้องมี Node.js 22 ขึ้นไป

```bash
cp .env.example .env.local   # PowerShell: copy .env.example .env.local
npm install
npm run dev                  # เปิดที่ http://localhost:5173
npm run build                # ตรวจ TypeScript แล้ว build ลง dist/
npm run lint
```

ค่าเริ่มต้นใน `.env.example` ชี้ไป **API จำลองในเครื่อง** ต้องเปิดก่อน: `cd ../Backend` แล้ว `python scripts/local_api.py` (ดู [README ของ repo](../README.md#รันในเครื่อง))

## ค่าตั้งค่า (`.env.local` / Amplify → Environment variables)

Vite อ่านค่าเหล่านี้ตอน build เปลี่ยนแล้วต้องรัน `npm run dev` / build ใหม่

| Key | API จำลองในเครื่อง | AWS |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` | Invoke URL ของ API Gateway |
| `VITE_AUTH_MODE` | `dev` | `cognito` |
| `VITE_USER_POOL_ID` | ไม่ใช้ | User Pool ID |
| `VITE_USER_POOL_CLIENT_ID` | ไม่ใช้ | App client ID |
| `VITE_REGION` | ไม่ใช้ | `us-east-1` |
| `VITE_DEMO_PASSWORD` | ไม่ใช้ (ปุ่มเดโมดึงจาก API จำลอง) | ไม่บังคับ: รหัสเดียวกับ `SEED_PASSWORD` → แสดงปุ่มบัญชีเดโม ⚠️ ทุกคนเห็นรหัสนี้ |

ไม่ตั้ง `VITE_AUTH_MODE` = โหมด `dev` · รายละเอียดการสลับไป AWS อยู่ที่ [AWS-SETUP.md](../AWS-SETUP.md) หัวข้อ 8 และ 14

| | โหมด `dev` (API จำลอง) | โหมด `cognito` (AWS) |
|---|---|---|
| ล็อกอิน / สมัคร | `/_dev/*` ของ API จำลอง token เป็น `dev.<userId>` | Amazon Cognito ผ่าน `aws-amplify` |
| รหัส OTP | ไม่มีอีเมลจริง กรอกตัวเลขอะไรก็ได้ 6 หลัก | ส่งทางอีเมลจริง |
| ปุ่มบัญชีเดโม | มีเสมอ (จาก `GET /_dev/accounts`) | มีเมื่อตั้ง `VITE_DEMO_PASSWORD` |

## โครงสร้าง

| โฟลเดอร์ | เก็บอะไร |
|---|---|
| `src/pages` | หน้าเว็บ แยก `user` (ผู้ขาย) `organizer` และ `admin` |
| `src/components` | คอมโพเนนต์ แยกตามส่วน popup ทั้งหมดอยู่ใน `popup` ส่วน `ui` เป็นคอมโพเนนต์จาก shadcn/ui |
| `src/api` | เรียก Backend API: `client.ts` (แนบ token, แปลง error), `dto.ts` (รูปแบบ JSON), `mappers.ts` (แปลง DTO เป็น type ของหน้าเว็บ) |
| `src/auth` | ล็อกอิน 2 แบบ: `devAdapter.ts` (API จำลอง) และ `cognitoAdapter.ts` (Cognito) เลือกตาม `VITE_AUTH_MODE` |
| `src/queries` | TanStack Query hooks ของแต่ละ API (cache, โหลดใหม่หลังแก้ข้อมูล, poll แจ้งเตือนทุก 30 วินาที) |
| `src/store` | `AuthProvider` (บัญชีที่เข้าสู่ระบบ, `/me`) และ toast |
| `src/services` | คำนวณข้อมูลจาก API เช่น รวมการจองเป็นชุด (`groupBookings`) ล็อกว่าง สถิติร้าน ร่างการจอง |
| `src/data` | ค่าตั้งค่า (`settings.ts`) ตัวเลือกและไอคอน (`options.ts`) ข้อความในหน้าเว็บ (`content.ts`) |
| `src/utils` | ฟังก์ชันช่วย เช่น ผังล็อก ราคาโซน วันที่ |
| `src/config.ts` | อ่านค่า `VITE_*` |

## Deploy

push ขึ้น `main` แล้ว Amplify Hosting build ให้เอง (`appRoot: Frontend`, `npm ci && npm run build`, ส่ง `dist/`) · ตั้ง env ตามตารางด้านบน และ rewrite `/<*>` → `/index.html` ตาม [AWS-SETUP.md](../AWS-SETUP.md) หัวข้อ 8
