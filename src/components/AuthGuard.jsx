import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthGuard({ allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>読み込み中...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Fallback: If they try to access something they can't, send them to their dashboard/history
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
