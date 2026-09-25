import '../css/shared-layout.css';
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
    <div className="min-h-screen driver-layout" style={{ backgroundColor: 'var(--bg-page)' }}>
      <header className="header-bar" style={{ padding: '0.75rem 1rem' }}>
        <div className="header-inner" style={{ maxWidth: 'none' }}>
          <h1 className="header-title" style={{ fontSize: '1rem' }}>Driver App</h1>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm">Logout</button>
        </div>
        <nav className="fleet-tabs" role="tablist" aria-label="Driver navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              role="tab"
              className={({ isActive }) => `fleet-tab ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="page-container" style={{ maxWidth: 'none', paddingLeft: '1rem', paddingRight: '1rem' }}>
        <Outlet />
      </main>
    </div>
  );
}
