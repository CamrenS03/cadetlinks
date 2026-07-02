import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import SignIn from './pages/sign-in/SignIn';
import Dashboard from './pages/dashboard/Dashboard';
import DocumentExplorer from './pages/documentExplorer/DocumentExplorer';

export default function App() {
    return (
        <Routes>
            <Route path='/' element={<SignIn />} />

            {/* Protected Routes */}
            <Route path='/dashboard' element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path='/documents' element={<ProtectedRoute><DocumentExplorer /></ProtectedRoute>} />
        </Routes>
    )
}