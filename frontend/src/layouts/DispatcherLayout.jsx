import '../css/shared-layout.css';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../api';

export function DispatcherLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    auth.clearAuth();
    navigate('/login');
  };

  const navItems = [
    { path: '/dispatcher', label: 'Dashboard', end: true },
    { path: '/dispatcher/fleet', label: 'Fleet' },
    { path: '/dispatcher/queue', label: 'Dispatch Queue' },
    { path: '/dispatcher/routes', label: 'Routes' },
  ];

  return (
    <div className="dispatcher-app-shell dispatcher-layout">
      <aside className="dispatcher-sidebar">
        <div className="dispatcher-brand-lockup">
          <span className="dispatcher-brand-mark" aria-hidden="true">S</span>
          <span className="dispatcher-brand-copy">
            <span className="dispatcher-brand-name">Sambast</span>
            <span className="dispatcher-brand-context">Dispatcher Console</span>
          </span>
        </div>
        <p className="dispatcher-nav-label">Workspace</p>
        <nav className="dispatcher-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `dispatcher-nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={handleLogout} className="btn btn-ghost btn-sm dispatcher-logout">Logout</button>
      </aside>
      <main className="page-container dispatcher-workspace">
        <Outlet />
      </main>
    </div>
  );
}
