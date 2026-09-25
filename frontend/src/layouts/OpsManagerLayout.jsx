import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../api';

export function OpsManagerLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    auth.clearAuth();
    navigate('/login');
  };

  const navItems = [
    { path: '/ops', label: 'Dashboard' },
    { path: '/ops/drivers', label: 'Driver Performance' },
    { path: '/ops/costs', label: 'Delivery Costs' },
    { path: '/ops/failures', label: 'Failed Deliveries' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Ops Manager Dashboard</h1>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex gap-6">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button
              onClick={handleLogout}
              className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}