import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import SignIn from './sign-in/SignIn';
import Dashboard from './dashboard/Dashboard';

export default function App() {
    return (
        <Routes>
            <Route path='/' element={<SignIn />} />

            {/* Protected Routes */}
            <Route path='/dashboard' element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        </Routes>
    )
}