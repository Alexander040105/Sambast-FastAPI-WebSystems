import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useCart } from '../cart/CartContext';
import { clearAuth, getUser } from '../auth/storage';

export default function CustomerLayout() {
  const navigate = useNavigate();
  const { totalItems } = useCart();
  const user = getUser();

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            to="/customer"
            className="text-xl font-bold"
          >
            Sambast
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              to="/customer"
              className="text-sm font-medium hover:text-blue-600"
            >
              Store
            </Link>

            <Link
              to="/customer/orders"
              className="text-sm font-medium hover:text-blue-600"
            >
              My Orders
            </Link>

            <Link
              to="/customer/notifications"
              className="text-sm font-medium hover:text-blue-600"
            >
              Notifications
            </Link>

            <Link
              to="/customer/cart"
              className="text-sm font-medium hover:text-blue-600"
            >
              Cart ({totalItems})
            </Link>

            {user?.email && (
              <span className="hidden text-sm text-gray-500 md:inline">
                {user.email}
              </span>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-100"
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