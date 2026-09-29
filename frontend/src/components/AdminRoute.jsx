import { Navigate, Outlet } from 'react-router-dom';
import { getUser, isAuthenticated } from '../auth/storage';

export default function AdminRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const user = getUser();

  if (!user || user.role !== 'admin') {
    return <Navigate to="/customer" replace />;
  }

  return <Outlet />;
}