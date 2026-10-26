import type { Organizer } from '../types'

export const ORGANIZERS: Organizer[] = [
  {
    id: 'o1', name: 'กลุ่มตลาดเขียว', contactName: 'มาลี ศรีสุข', email: 'malee@taladkeaw.example', phone: '089 123 4455',
    payment: { bank: 'พร้อมเพย์', accountName: 'กลุ่มตลาดเขียว', accountNo: '089 123 4455' },
  },
  {
    id: 'o2', name: 'ชมรมคนรักหนังสือเก่า', contactName: 'วิทยา บุญส่ง', email: 'contact@oldbooks.example', phone: '081 990 2231',
    payment: { bank: 'กสิกรไทย', accountName: 'ชมรมคนรักหนังสือเก่า', accountNo: '123-4-56789-0' },
  },
  {
    id: 'o3', name: 'สโมสรนิสิตคณะวิศวกรรมศาสตร์', contactName: 'ปกรณ์ ใจกล้า', email: 'club@eng.example',
    payment: { bank: 'ไทยพาณิชย์', accountName: 'สโมสรนิสิตวิศวะ', accountNo: '402-1-11223-4' },
  },
  {
    id: 'o4', name: 'กลุ่มคราฟต์ล้านนา', contactName: 'คำปุน ศรีใส', email: 'hello@lannacraft.example',
    payment: { bank: 'พร้อมเพย์', accountName: 'คำปุน ศรีใส', accountNo: '086 554 1209' },
  },
  {
    id: 'o5', name: 'สมาคมกาแฟอีสาน', contactName: 'อนุชา พลซื่อ', email: 'info@isancoffee.example',
    payment: { bank: 'กรุงไทย', accountName: 'สมาคมกาแฟอีสาน', accountNo: '551-0-33445-6' },
  },
  {
    id: 'o6', name: 'องค์การนักศึกษา ม.ศิลปากร', contactName: 'ศิรินทร์ ทองคำ', email: 'su@silpakorn.example',
    payment: { bank: 'ออมสิน', accountName: 'องค์การนักศึกษา ม.ศิลปากร', accountNo: '0201-2233-4455' },
  },
  // สมัครเข้ามาแล้ว รอผู้ดูแลระบบอนุมัติ
  { id: 'o7', name: 'ชมรมดนตรีสากล', contactName: 'ภาคิน สุขสันต์', email: 'music.club@example.com', phone: '092 334 7781' },
]
