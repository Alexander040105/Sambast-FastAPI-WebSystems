import { Link, Outlet, useNavigate } from 'react-router-dom';
import { clearAuth, getUser } from '../auth/storage';

function CustomerLayout() {
  const navigate = useNavigate();
  const user = getUser();

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link
            to="/customer"
            className="text-xl font-bold text-indigo-600"
          >
            Sambast
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              to="/customer"
              className="text-sm font-medium text-gray-700 hover:text-indigo-600"
            >
              Dashboard
            </Link>

            <span className="text-sm text-gray-500">
              {user?.email || 'Customer'}
            </span>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default CustomerLayout;