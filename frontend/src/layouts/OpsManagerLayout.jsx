import '../css/shared-layout.css';
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
    <div className="min-h-screen ops-manager-layout" style={{ backgroundColor: 'var(--bg-page)' }}>
      <header className="header-bar">
        <div className="header-inner">
          <h1 className="header-title">Ops Manager Dashboard</h1>
          <div className="flex items-center gap-3">
            <nav className="nav-main hidden md:flex" aria-label="Ops navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-main-item ${isActive ? 'active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">Logout</button>
          </div>
        </div>
      </header>
      <main className="page-container">
        <Outlet />
      </main>
    </div>
  );
}
