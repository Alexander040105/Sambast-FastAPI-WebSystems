import { Navigate, Outlet } from 'react-router-dom';
import { getUser, isAuthenticated } from '../auth/storage';
import { homeForRole } from '../auth/roles';

export default function AdminRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const user = getUser();

  if (!user || user.role !== 'admin') {
    return <Navigate to={homeForRole(user?.role)} replace />;
  }

  return <Outlet />;
}
