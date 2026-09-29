import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute, { GuestOnly, HomeRedirect } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import PassengerHomePage from './pages/passenger/PassengerHomePage';
import DriverDashboardPage from './pages/driver/DriverDashboardPage';

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
        </Route>

        <Route path="driver" element={<ProtectedRoute role="DRIVER" />}>
          <Route index element={<DriverDashboardPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
