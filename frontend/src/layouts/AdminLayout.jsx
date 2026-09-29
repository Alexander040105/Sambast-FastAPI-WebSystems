import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearAuth, getUser } from '../auth/storage';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  const links = [
    {
      label: 'Catalog',
      description: 'Products & categories',
      path: '/admin/catalog',
      icon: '📦',
    },
    {
      label: 'Orders',
      description: 'Customer orders',
      path: '/admin/orders',
      icon: '🛒',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="border-b border-slate-200 px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ruby-600 text-xl text-white shadow-sm">
                S
              </div>

              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  Sambast
                </h1>
                <p className="text-xs font-medium text-slate-500">
                  Admin Portal
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 py-6">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Management
            </p>

            <div className="space-y-2">
              {links.map((link) => {
                const active = location.pathname.startsWith(link.path);

                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition ${
                      active
                        ? 'bg-ruby-50 text-ruby-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg ${
                        active
                          ? 'bg-ruby-600 text-white'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                      }`}
                    >
                      {link.icon}
                    </span>

                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">
                        {link.label}
                      </span>

                      <span className="block truncate text-xs text-slate-400">
                        {link.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-slate-200 p-4">
            <div className="mb-3 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-400">
                Signed in as
              </p>

              <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                {user?.name || 'Administrator'}
              </p>

              <p className="mt-0.5 text-xs capitalize text-slate-500">
                {user?.role || 'admin'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between px-5 py-4 sm:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ruby-600">
                  Delivery Management
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {location.pathname.startsWith('/admin/orders')
                    ? 'Orders'
                    : 'Catalog'}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-slate-800">
                    {user?.name || 'Administrator'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Administrator
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ruby-100 font-bold text-ruby-700">
                  {(user?.name || 'A').charAt(0).toUpperCase()}
                </div>
              </div>
            </div>

            {/* Mobile navigation */}
            <div className="border-t border-slate-100 px-5 py-3 lg:hidden">
              <div className="flex gap-2 overflow-x-auto">
                {links.map((link) => {
                  const active = location.pathname.startsWith(link.path);

                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${
                        active
                          ? 'bg-ruby-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {link.icon} {link.label}
                    </Link>
                  );
                })}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="whitespace-nowrap rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Sign out
                </button>
              </div>
            </div>
          </header>

          {/* Page */}
          <main className="flex-1">
            <div className="mx-auto w-full max-w-7xl p-5 sm:p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}