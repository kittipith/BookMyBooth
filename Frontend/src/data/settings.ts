/** ค่าตั้งค่าของระบบ */

export const SITE = {
  name: 'BookmyBooth',
  footer: 'BookmyBooth ระบบจองล็อกขายสินค้าและพื้นที่บูธออนไลน์สำหรับงานมหาวิทยาลัย',
  supportEmail: 'help@bookmybooth.example',
}

export const FEES = {
  /** ค่าธรรมเนียมระบบต่อการจอง */
  service: 20,
  /** ค่าไฟฟ้า 15A ต่อวัน */
  power: 50,
}

export const POLICY = {
  /** คืนเงินภายในกี่วันทำการ เมื่อไม่อนุมัติหรือยกเลิก */
  refundBusinessDays: 3,
  /** ผู้จัดงานตรวจคำขอภายในกี่ชั่วโมง */
  reviewHours: 24,
}

/** ปรับราคาวันเสาร์อาทิตย์เริ่มต้น (เปอร์เซ็นต์) */
export const WEEKEND_SURCHARGE = 20

/** ค่าตั้งต้นของงานใหม่ */
export const EVENT_DEFAULTS = {
  /** เปิดรับจองก่อนวันงานกี่วัน */
  opensDaysBefore: 30,
  /** ปิดรับจองก่อนวันงานกี่วัน */
  closesDaysBefore: 3,
  /** จำนวนล็อกสูงสุดต่อผู้ขายต่องาน (null = ไม่จำกัด ผู้จัดงานกำหนดเองได้) */
  maxLotsPerSeller: null as number | null,
}

export const LIMITS = {
  maxEventDays: 14,
  maxSlipMB: 5,
  /** ร้านที่มาตามนัดต่ำกว่านี้จะถูกเตือน */
  lowShowRate: 60,
  /** จำนวนวันย้อนหลังในกราฟการจองรายวัน */
  chartDays: 14,
  /** จำนวนคำขอในหน้าภาพรวม */
  overviewQueue: 4,
  /** จำนวนงานในหน้าแรก */
  homeEvents: 4,
  /** ตัวกรอง "งานที่เหลือมากกว่า N ล็อก" */
  manyFreeLots: 10,
  /** จำนวนการแจ้งเตือนที่แสดงในกระดิ่ง */
  bellItems: 20,
}

/** ดึงข้อมูลใหม่ทุกกี่วินาที (polling การแจ้งเตือนและข้อมูลที่เปลี่ยนจากแท็บอื่น) */
export const POLL_SECONDS = 30

/** ขนาดผังที่ปรับได้ในตัววาดผัง (หน่วยเป็นช่อง หนึ่งช่องเท่ากับล็อกมาตรฐาน 2×2 ม.) */
export const GRID_LIMITS = {
  defaultCols: 16,
  defaultRows: 10,
  minCols: 6,
  maxCols: 30,
  minRows: 4,
  maxRows: 30,
  /** หนึ่งช่องบนผังแทนพื้นที่กี่เมตร (ล็อกมาตรฐาน 2×2 ม. = 1 ช่อง ล็อก 4×2 ม. = กว้าง 2 ช่อง) */
  cellMeters: 2,
}

export const AUTH_RULES = {
  minPasswordLength: 8,
  otpLength: 6,
  /** รหัส OTP ใช้ได้กี่นาที */
  otpMinutes: 10,
}

/**
 * ยังไม่มีหลังบ้านส่งอีเมล จึงแสดงรหัส OTP บนหน้าจอให้ทดสอบได้
 * ตอนเชื่อม Cognito แล้วให้ปิดเป็น false
 */
export const SHOW_OTP_ON_SCREEN = true
