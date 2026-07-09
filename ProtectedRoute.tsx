import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/firebase';
import { useUser } from './hooks/useUser';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { loading, hasPermission } = useUser();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!hasPermission('admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function AttendanceRoute({ children }: { children: React.ReactNode }) {
  const { loading, hasPermission } = useUser();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!hasPermission('manage_attendance') && !hasPermission('admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
