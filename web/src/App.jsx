import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute, { GuestOnly, HomeRedirect } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import PassengerHomePage from './pages/passenger/PassengerHomePage';
import PassengerHistoryPage from './pages/passenger/PassengerHistoryPage';
import RequestDetailPage from './pages/passenger/RequestDetailPage';
import DriverDashboardPage from './pages/driver/DriverDashboardPage';
import DriverHistoryPage from './pages/driver/DriverHistoryPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomeRedirect />} />
        <Route
          path="login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="register"
          element={
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          }
        />

        <Route path="ride" element={<ProtectedRoute role="PASSENGER" />}>
          <Route index element={<PassengerHomePage />} />
          <Route path="history" element={<PassengerHistoryPage />} />
          <Route path="history/:id" element={<RequestDetailPage />} />
        </Route>

        <Route path="driver" element={<ProtectedRoute role="DRIVER" />}>
          <Route index element={<DriverDashboardPage />} />
          <Route path="history" element={<DriverHistoryPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
