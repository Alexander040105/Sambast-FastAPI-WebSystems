import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../api';

export function DriverLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    auth.clearAuth();
    navigate('/login');
  };

  const navItems = [
    { path: '/driver', label: 'Manifest' },
    { path: '/driver/route', label: 'Route' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Driver App</h1>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Logout
          </button>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4" role="tablist">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              role="tab"
              className={({ isActive }) =>
                `whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-screen-xl mx-auto px-4 py-4 pb-20">
        <Outlet />
      </main>
    </div>
  );
}