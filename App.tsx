import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import SignIn from './pages/sign-in/SignIn';
import Dashboard from './pages/dashboard/Dashboard';
import DocumentExplorer from './pages/documentExplorer/DocumentExplorer';
import Admin from './pages/admin/Admin'

export default function App() {
    return (
        <Routes>
            <Route path='/' element={<SignIn />} />

            {/* Protected Routes */}
            <Route path='/dashboard' element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path='/documents' element={<ProtectedRoute><DocumentExplorer /></ProtectedRoute>} />
            <Route path='/admin' element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        </Routes>
    )
}