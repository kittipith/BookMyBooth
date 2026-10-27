import { BrowserRouter, Outlet, Route, Routes } from 'react-router'
import ApiErrorToaster from './components/common/ApiErrorToaster'
import NotificationWatcher from './components/common/NotificationWatcher'
import RequireAuth from './components/common/RequireAuth'
import ScrollToTop from './components/common/ScrollToTop'
import ToastProvider from './components/common/ToastProvider'
import AdminLayout from './components/layout/AdminLayout'
import OrganizerLayout from './components/layout/OrganizerLayout'
import UserLayout from './components/layout/UserLayout'
import LoginPopup from './components/popup/LoginPopup'
import AllEventsPage from './pages/admin/AllEventsPage'
import OrganizerApprovalsPage from './pages/admin/OrganizerApprovalsPage'
import UsersPage from './pages/admin/UserPage'
import BookingsPage from './pages/organizer/BookingsPage'
import MapEditorPage from './pages/organizer/MapEditorPage'
import MyEventsPage from './pages/organizer/MyEventsPage'
import OrganizerProfilePage from './pages/organizer/OrganizerProfilePage'
import OverviewPage from './pages/organizer/OverviewPage'
import VendorsPage from './pages/organizer/VendorsPage'
import NotFoundPage from './pages/NotFoundPage'
import BookingPaymentPage from './pages/user/BookingPaymentPage'
import BookingSentPage from './pages/user/BookingSentPage'
import BookingShopInfoPage from './pages/user/BookingShopInfoPage'
import EventMapPage from './pages/user/EventMapPage'
import EventsPage from './pages/user/EventPage'
import HomePage from './pages/user/HomePage'
import MyBookingsPage from './pages/user/MyBookingsPage'
import ShopProfilePage from './pages/user/ShopProfilePage'
import { AuthProvider } from './store/AuthProvider'

function App() {
  return (
    <AuthProvider>
        <ToastProvider>
          <ApiErrorToaster />
          <NotificationWatcher />
          <BrowserRouter>
            <ScrollToTop />
            <LoginPopup />
            <Routes>
              {/* ฝั่งผู้ขาย */}
              <Route element={<UserLayout />}>
                <Route index element={<HomePage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="events/:eventId" element={<EventMapPage />} />

                {/* ต้องเข้าสู่ระบบด้วยบัญชีผู้ขาย */}
                <Route
                  element={
                    <RequireAuth role="seller">
                      <Outlet />
                    </RequireAuth>
                  }
                >
                  <Route path="booking/shop-info" element={<BookingShopInfoPage />} />
                  <Route path="booking/payment/:groupId" element={<BookingPaymentPage />} />
                  <Route path="booking/sent/:groupId" element={<BookingSentPage />} />
                  <Route path="my-bookings" element={<MyBookingsPage />} />
                  <Route path="profile" element={<ShopProfilePage />} />
                </Route>
              </Route>

              {/* ฝั่งผู้จัดงาน ต้องเข้าสู่ระบบด้วยบัญชีผู้จัดงาน */}
              <Route
                path="organizer"
                element={
                  <RequireAuth role="organizer" fullScreen>
                    <OrganizerLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<OverviewPage />} />
                <Route path="events" element={<MyEventsPage />} />
                <Route path="editor/:eventId?" element={<MapEditorPage />} />
                <Route path="bookings" element={<BookingsPage />} />
                <Route path="vendors" element={<VendorsPage />} />
                <Route path="profile" element={<OrganizerProfilePage />} />
              </Route>

              {/* ผู้ดูแลระบบ (บัญชีสร้างโดยทีมพัฒนา) */}
              <Route
                path="admin"
                element={
                  <RequireAuth role="admin" fullScreen>
                    <AdminLayout />
                  </RequireAuth>
                }
              >
                <Route index element={<OrganizerApprovalsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="events" element={<AllEventsPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
    </AuthProvider>
  )
}

export default App
