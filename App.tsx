import { Route, Routes } from 'react-router-dom';
import ProtectedRoute, { AdminRoute, AttendanceRoute } from './ProtectedRoute';
import Admin from './pages/admin/Admin';
import Attendance from './pages/attendance/Attendance';
import Dashboard from './pages/dashboard/Dashboard';
import DocumentExplorer from './pages/documentExplorer/DocumentExplorer';
import ProfileLookup from './pages/profileLookup/ProfileLookup';
import SignIn from './pages/sign-in/SignIn';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SignIn />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <DocumentExplorer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profileLookup"
        element={
          <ProtectedRoute>
            <ProfileLookup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <AttendanceRoute>
              <div>
                <Attendance />
              </div>
            </AttendanceRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <Admin />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
