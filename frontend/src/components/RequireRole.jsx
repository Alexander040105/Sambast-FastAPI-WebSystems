import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getUser, isAuthenticated } from '../auth/storage';
import { homeForRole } from '../auth/roles';

function RequireRole({ allow }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  const user = getUser();

  if (!user || (allow && !allow.includes(user.role))) {
    return <Navigate to={homeForRole(user?.role)} replace />;
  }

  return <Outlet />;
}

export default RequireRole;
