import { Link } from 'react-router'
import Logo from '../components/common/Logo'

export default function NotFoundPage() {
  return (
    <section className="min-h-screen grid place-items-center px-5 text-center">
      <div>
        <div className="flex justify-center">
          <Logo />
        </div>
        <p className="mt-6 font-display text-7xl font-bold text-cobalt">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold">ไม่พบหน้านี้</h1>
        <p className="mt-2 text-muted">ลิงก์อาจผิด หรือหน้านี้ถูกย้ายไปแล้ว</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="bg-cobalt text-oncobalt rounded-xl px-5 py-3 font-semibold">
            กลับหน้าแรก
          </Link>
          <Link to="/organizer" className="border-[1.5px] border-cobalt text-cobalt rounded-xl px-5 py-3 font-semibold hover:bg-cobalt/5">
            หน้าผู้จัดงาน
          </Link>
        </div>
      </div>
    </section>
  )
}
